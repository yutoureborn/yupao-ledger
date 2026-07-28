import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRequest } from '../build/worker/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function bytesToBase64Url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  return new Uint8Array(Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
}

async function deriveProof(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64UrlToBytes(salt), iterations }, key, 256);
  return bytesToBase64Url(new Uint8Array(bits));
}

async function newCredential(password, iterations = 100000) {
  const salt = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  return { proof: await deriveProof(password, salt, iterations), salt, iterations };
}

class LocalStatement {
  constructor(statement, values = []) { this.statement = statement; this.values = values; }
  bind(...values) { return new LocalStatement(this.statement, values); }
  async first(column) { const row = this.statement.get(...this.values) || null; return column && row ? row[column] : row; }
  async all() { return { success: true, results: this.statement.all(...this.values) }; }
  async run() { const result = this.statement.run(...this.values); return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid || 0) } }; }
}

async function setup({ bypass = true } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(await readFile(path.join(root, 'migrations/0001_init.sql'), 'utf8'));
  db.exec(await readFile(path.join(root, 'migrations/0002_internal_auth.sql'), 'utf8'));
  const d1 = {
    prepare(sql) { return new LocalStatement(db.prepare(sql)); },
    async batch(statements) {
      db.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); db.exec('COMMIT'); return results; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  const env = {
    DB: d1,
    ASSETS: { fetch: async () => new Response('asset') },
    AUTH_BYPASS: bypass ? 'true' : 'false',
    DEV_USER_EMAIL: 'one@example.test',
    HOUSEHOLD_NAME: '测试之家',
    SETUP_TOKEN: 'test-setup-token-with-enough-entropy',
    PASSWORD_PEPPER: 'test-password-pepper-with-enough-entropy',
    PASSWORD_ITERATIONS: '100000',
  };
  async function call(pathname, options = {}) {
    const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) };
    const request = new Request(`https://test.local${pathname}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const response = await handleRequest(request, env);
    const payload = await response.json();
    return { response, payload };
  }
  return { db, env, call };
}

async function initializeAccounts(call) {
  const [ownerCredential, memberCredential] = await Promise.all([
    newCredential('TaroLedger2026!'),
    newCredential('CannonLedger2026!'),
  ]);
  const setupResult = await call('/api/auth/setup', {
    method: 'POST',
    body: {
      setupToken: 'test-setup-token-with-enough-entropy',
      householdName: '测试之家',
      ownerName: '阿芋', ownerEmail: 'owner@example.test', ownerCredential,
      memberName: '小炮', memberEmail: 'member@example.test', memberCredential,
    },
  });
  assert.equal(setupResult.response.status, 201);
  return setupResult.payload.data;
}

async function login(call, email = 'owner@example.test', password = 'TaroLedger2026!') {
  const params = await call('/api/auth/password-params', { method: 'POST', body: { email } });
  const passwordProof = await deriveProof(password, params.payload.data.salt, params.payload.data.iterations);
  const result = await call('/api/auth/login', { method: 'POST', body: { email, passwordProof, rememberMe: true } });
  const cookie = result.response.headers.get('set-cookie')?.split(';')[0] || '';
  return { ...result, cookie, csrf: result.payload.data?.csrfToken || '' };
}

test('bootstrap creates the private household, accounts and categories', async () => {
  const { call } = await setup();
  const { response, payload } = await call('/api/bootstrap?month=2026-07');
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.household.name, '测试之家');
  assert.ok(payload.data.accounts.length >= 4);
  assert.ok(payload.data.categories.some((item) => item.name === '餐饮'));
});

test('create, update, delete and restore a transaction', async () => {
  const { call } = await setup();
  const bootstrap = (await call('/api/bootstrap?month=2026-07')).payload.data;
  const account = bootstrap.accounts[0];
  const category = bootstrap.categories.find((item) => item.type === 'expense');
  const createdResult = await call('/api/transactions', {
    method: 'POST',
    body: { type: 'expense', amountCents: 2580, accountId: account.id, categoryId: category.id, occurredAt: '2026-07-20', merchant: '测试商户', note: '测试记录' },
  });
  assert.equal(createdResult.response.status, 201);
  const created = createdResult.payload.data;
  assert.equal(created.amount_cents, 2580);
  const updatedResult = await call(`/api/transactions/${created.id}`, {
    method: 'PATCH',
    body: { type: 'expense', amountCents: 3000, accountId: account.id, categoryId: category.id, occurredAt: '2026-07-20', merchant: '修改后', note: '', version: created.version },
  });
  assert.equal(updatedResult.response.status, 200);
  assert.equal(updatedResult.payload.data.amount_cents, 3000);
  assert.equal(updatedResult.payload.data.version, 2);
  const conflict = await call(`/api/transactions/${created.id}`, {
    method: 'PATCH',
    body: { type: 'expense', amountCents: 100, accountId: account.id, categoryId: category.id, occurredAt: '2026-07-20', version: 1 },
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.payload.error.code, 'VERSION_CONFLICT');
  assert.equal((await call(`/api/transactions/${created.id}`, { method: 'DELETE' })).response.status, 200);
  assert.equal((await call('/api/transactions?month=2026-07')).payload.data.items.length, 0);
  assert.equal((await call(`/api/transactions/${created.id}/restore`, { method: 'POST' })).response.status, 200);
  assert.equal((await call('/api/transactions?month=2026-07')).payload.data.items.length, 1);
});

test('transfers change account balances but do not count as income or expense', async () => {
  const { call } = await setup();
  const bootstrap = (await call('/api/bootstrap?month=2026-07')).payload.data;
  const [source, target] = bootstrap.accounts;
  await call('/api/transactions', { method: 'POST', body: { type: 'transfer', amountCents: 10000, accountId: source.id, targetAccountId: target.id, occurredAt: '2026-07-21', note: '转账测试' } });
  const overview = (await call('/api/stats/overview?month=2026-07')).payload.data;
  assert.equal(overview.incomeCents, 0);
  assert.equal(overview.expenseCents, 0);
  const accounts = (await call('/api/accounts')).payload.data;
  assert.equal(accounts.find((item) => item.id === source.id).balance_cents, -10000);
  assert.equal(accounts.find((item) => item.id === target.id).balance_cents, 10000);
});

test('development mode creates a second member', async () => {
  const { env } = await setup();
  assert.equal((await handleRequest(new Request('https://test.local/api/bootstrap', { headers: { 'x-dev-user-email': 'one@example.test' } }), env)).status, 200);
  const second = await handleRequest(new Request('https://test.local/api/bootstrap', { headers: { 'x-dev-user-email': 'two@example.test' } }), env);
  const payload = await second.json();
  assert.equal(payload.data.user.role, 'member');
});

test('internal authentication setup creates exactly two accounts and recovery codes', async () => {
  const { call, db } = await setup({ bypass: false });
  const status = await call('/api/auth/setup-status');
  assert.equal(status.payload.data.schemaReady, true);
  assert.equal(status.payload.data.configured, false);
  assert.equal(status.payload.data.secretsReady, true);
  const result = await initializeAccounts(call);
  assert.equal(result.accounts.length, 2);
  assert.equal(result.accounts[0].role, 'owner');
  assert.equal(result.accounts[1].role, 'member');
  assert.equal(result.accounts[0].recoveryCodes.length, 8);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM auth_credentials').get().count, 2);
  const repeated = await call('/api/auth/setup', { method: 'POST', body: { setupToken: 'test-setup-token-with-enough-entropy' } });
  assert.equal(repeated.response.status, 409);
});


test('旧版初始化页面会收到明确的刷新提示', async () => {
  const { call } = await setup({ bypass: false });
  const result = await call('/api/auth/setup', {
    method: 'POST',
    body: {
      setupToken: 'test-setup-token-with-enough-entropy',
      householdName: '测试之家',
      ownerName: '阿芋', ownerEmail: 'owner@example.test', ownerPassword: 'OldClientPassword2026!',
      memberName: '小炮', memberEmail: 'member@example.test', memberPassword: 'OldClientPassword2027!',
    },
  });
  assert.equal(result.response.status, 409);
  assert.equal(result.payload.error.code, 'CLIENT_UPDATE_REQUIRED');
});

test('login issues an HttpOnly session and protected APIs require CSRF for writes', async () => {
  const { call } = await setup({ bypass: false });
  await initializeAccounts(call);
  const loggedIn = await login(call);
  assert.equal(loggedIn.response.status, 200);
  assert.match(loggedIn.response.headers.get('set-cookie') || '', /HttpOnly/);
  assert.match(loggedIn.response.headers.get('set-cookie') || '', /SameSite=Strict/);
  const session = await call('/api/auth/session', { headers: { cookie: loggedIn.cookie } });
  assert.equal(session.response.status, 200);
  assert.equal(session.payload.data.user.role, 'owner');
  const bootstrap = await call('/api/bootstrap?month=2026-07', { headers: { cookie: loggedIn.cookie } });
  const account = bootstrap.payload.data.accounts[0];
  const category = bootstrap.payload.data.categories.find((item) => item.type === 'expense');
  const rejected = await call('/api/transactions', { method: 'POST', headers: { cookie: loggedIn.cookie }, body: { type: 'expense', amountCents: 100, accountId: account.id, categoryId: category.id, occurredAt: '2026-07-20' } });
  assert.equal(rejected.response.status, 403);
  assert.equal(rejected.payload.error.code, 'CSRF_INVALID');
  const accepted = await call('/api/transactions', { method: 'POST', headers: { cookie: loggedIn.cookie, 'x-csrf-token': loggedIn.csrf, origin: 'https://test.local' }, body: { type: 'expense', amountCents: 100, accountId: account.id, categoryId: category.id, occurredAt: '2026-07-20' } });
  assert.equal(accepted.response.status, 201);
});

test('recovery code resets the password once and revokes old sessions', async () => {
  const { call } = await setup({ bypass: false });
  const setupData = await initializeAccounts(call);
  const oldLogin = await login(call);
  const recoveryCode = setupData.accounts[0].recoveryCodes[0];
  const recovered = await call('/api/auth/recover', { method: 'POST', body: { email: 'owner@example.test', recoveryCode, newCredential: await newCredential('NewTaroLedger2026!') } });
  assert.equal(recovered.response.status, 200);
  const oldSession = await call('/api/auth/session', { headers: { cookie: oldLogin.cookie } });
  assert.equal(oldSession.response.status, 401);
  const newLogin = await login(call, 'owner@example.test', 'NewTaroLedger2026!');
  assert.equal(newLogin.response.status, 200);
  const reused = await call('/api/auth/recover', { method: 'POST', body: { email: 'owner@example.test', recoveryCode, newCredential: await newCredential('AnotherTaroLedger2026!') } });
  assert.equal(reused.response.status, 401);
});

test('production mode rejects requests without an internal session', async () => {
  const { env } = await setup({ bypass: false });
  const response = await handleRequest(new Request('https://test.local/api/bootstrap'), env);
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.error.code, 'AUTH_REQUIRED');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
});
