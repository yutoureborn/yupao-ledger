import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRequest } from '../build/worker/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class LocalStatement {
  constructor(statement, values = []) { this.statement = statement; this.values = values; }
  bind(...values) { return new LocalStatement(this.statement, values); }
  async first(column) { const row = this.statement.get(...this.values) || null; return column && row ? row[column] : row; }
  async all() { return { success: true, results: this.statement.all(...this.values) }; }
  async run() { const result = this.statement.run(...this.values); return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid || 0) } }; }
}

async function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(await readFile(path.join(root, 'migrations/0001_init.sql'), 'utf8'));
  const env = {
    DB: { prepare(sql) { return new LocalStatement(db.prepare(sql)); } },
    ASSETS: { fetch: async () => new Response('asset') },
    AUTH_BYPASS: 'true',
    DEV_USER_EMAIL: 'one@example.test',
    ALLOWED_EMAILS: 'one@example.test,two@example.test',
    HOUSEHOLD_NAME: '测试之家'
  };
  async function call(pathname, options = {}) {
    const request = new Request(`http://test.local${pathname}`, {
      method: options.method || 'GET',
      headers: options.body ? { 'content-type': 'application/json', ...(options.headers || {}) } : options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const response = await handleRequest(request, env);
    const payload = await response.json();
    return { response, payload };
  }
  return { db, env, call };
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
    body: { type: 'expense', amountCents: 2580, accountId: account.id, categoryId: category.id, occurredAt: '2026-07-20', merchant: '测试商户', note: '测试记录' }
  });
  assert.equal(createdResult.response.status, 201);
  const created = createdResult.payload.data;
  assert.equal(created.amount_cents, 2580);

  const updatedResult = await call(`/api/transactions/${created.id}`, {
    method: 'PATCH',
    body: { type: 'expense', amountCents: 3000, accountId: account.id, categoryId: category.id, occurredAt: '2026-07-20', merchant: '修改后', note: '', version: created.version }
  });
  assert.equal(updatedResult.response.status, 200);
  assert.equal(updatedResult.payload.data.amount_cents, 3000);
  assert.equal(updatedResult.payload.data.version, 2);

  const conflict = await call(`/api/transactions/${created.id}`, {
    method: 'PATCH',
    body: { type: 'expense', amountCents: 100, accountId: account.id, categoryId: category.id, occurredAt: '2026-07-20', version: 1 }
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.payload.error.code, 'VERSION_CONFLICT');

  assert.equal((await call(`/api/transactions/${created.id}`, { method: 'DELETE' })).response.status, 200);
  const listAfterDelete = (await call('/api/transactions?month=2026-07')).payload.data.items;
  assert.equal(listAfterDelete.length, 0);
  assert.equal((await call(`/api/transactions/${created.id}/restore`, { method: 'POST' })).response.status, 200);
  const listAfterRestore = (await call('/api/transactions?month=2026-07')).payload.data.items;
  assert.equal(listAfterRestore.length, 1);
});

test('transfers change account balances but do not count as income or expense', async () => {
  const { call } = await setup();
  const bootstrap = (await call('/api/bootstrap?month=2026-07')).payload.data;
  const [source, target] = bootstrap.accounts;
  await call('/api/transactions', {
    method: 'POST',
    body: { type: 'transfer', amountCents: 10000, accountId: source.id, targetAccountId: target.id, occurredAt: '2026-07-21', note: '转账测试' }
  });
  const overview = (await call('/api/stats/overview?month=2026-07')).payload.data;
  assert.equal(overview.incomeCents, 0);
  assert.equal(overview.expenseCents, 0);
  const accounts = (await call('/api/accounts')).payload.data;
  assert.equal(accounts.find((item) => item.id === source.id).balance_cents, -10000);
  assert.equal(accounts.find((item) => item.id === target.id).balance_cents, 10000);
});

test('a second authenticated email joins as a member', async () => {
  const { env } = await setup();
  const first = await handleRequest(new Request('http://test.local/api/bootstrap', { headers: { 'x-dev-user-email': 'one@example.test' } }), env);
  assert.equal(first.status, 200);
  const second = await handleRequest(new Request('http://test.local/api/bootstrap', { headers: { 'x-dev-user-email': 'two@example.test' } }), env);
  const payload = await second.json();
  assert.equal(payload.data.user.role, 'member');
});

test('production mode rejects requests without an Access token', async () => {
  const { env } = await setup();
  env.AUTH_BYPASS = 'false';
  env.ACCESS_TEAM_DOMAIN = 'https://example.cloudflareaccess.com';
  env.ACCESS_AUD = 'test-aud';
  const response = await handleRequest(new Request('http://test.local/api/bootstrap'), env);
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
});

test('the API applies its own email allowlist after authentication', async () => {
  const { env } = await setup();
  env.DEV_USER_EMAIL = 'not-allowed@example.test';
  const response = await handleRequest(new Request('http://test.local/api/bootstrap'), env);
  const payload = await response.json();
  assert.equal(response.status, 403);
  assert.equal(payload.error.code, 'EMAIL_NOT_ALLOWED');
});
