interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success?: boolean;
  meta?: { changes?: number; last_row_id?: number | string };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch?<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  DB: D1Database;
  ASSETS: AssetsBinding;
  AUTH_BYPASS?: string;
  DEV_USER_EMAIL?: string;
  HOUSEHOLD_NAME?: string;
  SETUP_TOKEN?: string;
  PASSWORD_PEPPER?: string;
  PASSWORD_ITERATIONS?: string;
}

type TransactionType = 'expense' | 'income' | 'transfer';
type CategoryType = 'expense' | 'income';
type InvoiceType = 'received' | 'issued';
type InvoiceStatus = 'recorded' | 'void';

type UserContext = {
  userId: string;
  email: string;
  displayName: string;
  householdId: string;
  householdName: string;
  role: 'owner' | 'member';
  sessionId?: string;
  csrfToken?: string;
};

class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'x-permitted-cross-domain-policies': 'none',
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...SECURITY_HEADERS, ...extraHeaders },
  });
}

function ok<T>(data: T, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return json({ ok: true, data }, status, extraHeaders);
}

function fail(error: HttpError, extraHeaders: Record<string, string> = {}): Response {
  return json(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      },
    },
    error.status,
    extraHeaders,
  );
}

function applySecurityHeaders(response: Response, pathname = '/'): Response {
  const headers = new Headers(response.headers);
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => headers.set(key, value));
  if (!headers.has('cache-control')) {
    const isShell = pathname === '/' || pathname.endsWith('.html') || pathname.endsWith('/sw.js') || pathname.endsWith('.webmanifest');
    headers.set('cache-control', isShell ? 'no-cache, max-age=0, must-revalidate' : 'public, max-age=3600');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const SESSION_COOKIE = '__Host-yupao_session';
const SESSION_SECONDS = 12 * 60 * 60;
const REMEMBER_SESSION_SECONDS = 30 * 24 * 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_EMAIL_LIMIT = 5;
const LOGIN_IP_LIMIT = 20;
const RECOVERY_CODE_COUNT = 8;
const MAX_JSON_BODY_BYTES = 32 * 1024;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
  return output;
}

function base64UrlEncode(value: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function parseCookies(request: Request): Map<string, string> {
  const cookies = new Map<string, string>();
  const raw = request.headers.get('cookie') || '';
  for (const segment of raw.split(';')) {
    const index = segment.indexOf('=');
    if (index <= 0) continue;
    const name = segment.slice(0, index).trim();
    const encoded = segment.slice(index + 1).trim();
    try { cookies.set(name, decodeURIComponent(encoded)); } catch { continue; }
  }
  return cookies;
}

function sessionCookie(token: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict; Priority=High`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Priority=High`;
}

function secretIsReady(value: string | undefined): boolean {
  const normalized = value?.trim();
  return Boolean(normalized && !normalized.includes('REPLACE_WITH'));
}

function requiredSecret(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized || normalized.includes('REPLACE_WITH')) {
    throw new HttpError(500, 'AUTH_NOT_CONFIGURED', `认证密钥 ${name} 尚未配置`);
  }
  return normalized;
}

function passwordIterations(env: Env): number {
  const value = Number(env.PASSWORD_ITERATIONS || 120000);
  if (!Number.isSafeInteger(value) || value < 100000 || value > 600000) return 120000;
  return value;
}

async function sha256Bytes(value: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function secretHash(value: string, env: Env): Promise<string> {
  const pepper = requiredSecret(env.PASSWORD_PEPPER, 'PASSWORD_PEPPER');
  return base64UrlEncode(await sha256Bytes(`${value}\u0000${pepper}`));
}

function constantTimeEqual(a: Uint8Array<ArrayBuffer>, b: Uint8Array<ArrayBuffer>): boolean {
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}

async function constantTimeTextEqual(a: string, b: string): Promise<boolean> {
  return constantTimeEqual(await sha256Bytes(a), await sha256Bytes(b));
}

type ClientCredential = { proof: string; salt: string; iterations: number };

function assertBase64UrlBytes(value: unknown, field: string, expectedBytes: number): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new HttpError(400, 'CREDENTIAL_INVALID', `${field}格式不正确`);
  }
  try {
    if (base64UrlDecode(value).byteLength !== expectedBytes) throw new Error('length');
  } catch {
    throw new HttpError(400, 'CREDENTIAL_INVALID', `${field}格式不正确`);
  }
  return value;
}

function assertClientCredential(value: unknown): ClientCredential {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'CREDENTIAL_INVALID', '密码凭据格式不正确');
  const input = value as Record<string, unknown>;
  const iterations = Number(input.iterations);
  if (!Number.isSafeInteger(iterations) || iterations < 100000 || iterations > 600000) {
    throw new HttpError(400, 'CREDENTIAL_INVALID', '密码计算参数不正确');
  }
  return {
    proof: assertBase64UrlBytes(input.proof, '密码凭据', 32),
    salt: assertBase64UrlBytes(input.salt, '密码盐值', 16),
    iterations,
  };
}

async function storedCredentialHash(proof: string, env: Env): Promise<string> {
  return secretHash(`credential:${proof}`, env);
}

async function verifyCredentialProof(
  proofValue: unknown,
  credential: { password_hash: string } | null,
  env: Env,
): Promise<boolean> {
  let proof = '';
  try {
    proof = assertBase64UrlBytes(proofValue, '密码凭据', 32);
  } catch {
    proof = base64UrlEncode(await sha256Bytes('invalid-yupao-password-proof'));
  }
  const actual = await storedCredentialHash(proof, env);
  const expected = credential?.password_hash || await storedCredentialHash(base64UrlEncode(await sha256Bytes('missing-yupao-account-proof')), env);
  return constantTimeTextEqual(actual, expected);
}

function normalizeRecoveryCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function generateRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let text = '';
  for (let index = 0; index < 16; index += 1) text += alphabet[bytes[index] % alphabet.length];
  return `YP-${text.slice(0, 4)}-${text.slice(4, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}`;
}

function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

async function clientIpHash(request: Request, env: Env): Promise<string> {
  return secretHash(`ip:${clientIp(request)}`, env);
}

function currentEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

async function recordLoginAttempt(db: D1Database, email: string, ipHash: string, success: boolean): Promise<void> {
  await run(db, 'INSERT INTO login_attempts (id, email, ip_hash, success, attempted_at) VALUES (?, ?, ?, ?, ?)', crypto.randomUUID(), email, ipHash, success ? 1 : 0, currentEpoch());
}

async function enforceLoginRateLimit(request: Request, env: Env, email: string): Promise<string> {
  const now = currentEpoch();
  const since = now - LOGIN_WINDOW_SECONDS;
  const ipHash = await clientIpHash(request, env);
  await run(env.DB, 'DELETE FROM login_attempts WHERE attempted_at < ?', now - 24 * 60 * 60);
  const emailFailures = await queryFirst<{ count: number }>(env.DB, 'SELECT COUNT(*) AS count FROM login_attempts WHERE email = ? AND success = 0 AND attempted_at >= ?', email, since);
  const ipFailures = await queryFirst<{ count: number }>(env.DB, 'SELECT COUNT(*) AS count FROM login_attempts WHERE ip_hash = ? AND success = 0 AND attempted_at >= ?', ipHash, since);
  if ((emailFailures?.count ?? 0) >= LOGIN_EMAIL_LIMIT || (ipFailures?.count ?? 0) >= LOGIN_IP_LIMIT) {
    throw new HttpError(429, 'LOGIN_LOCKED', '尝试次数太多，请 15 分钟后再试');
  }
  return ipHash;
}

async function replaceRecoveryCodes(userId: string, env: Env): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
  const now = currentEpoch();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM recovery_codes WHERE user_id = ? AND used_at IS NULL').bind(userId),
  ];
  for (const code of codes) {
    statements.push(env.DB.prepare('INSERT INTO recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)').bind(
      crypto.randomUUID(), userId, await secretHash(`recovery:${normalizeRecoveryCode(code)}`, env), now,
    ));
  }
  await executeBatch(env.DB, statements);
  return codes;
}

async function createSession(userId: string, request: Request, env: Env, rememberMe: boolean): Promise<{ token: string; csrfToken: string; maxAge: number }> {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const maxAge = rememberMe ? REMEMBER_SESSION_SECONDS : SESSION_SECONDS;
  const now = currentEpoch();
  await run(env.DB, 'DELETE FROM auth_sessions WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND revoked_at <= ?)', now, now - 7 * 24 * 60 * 60);
  await run(
    env.DB,
    `INSERT INTO auth_sessions (id, token_hash, user_id, csrf_token, expires_at, created_at, last_seen_at, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(), await secretHash(`session:${token}`, env), userId, csrfToken, now + maxAge, now, now,
    await clientIpHash(request, env), (request.headers.get('user-agent') || '').slice(0, 240),
  );
  return { token, csrfToken, maxAge };
}

async function getSessionContext(request: Request, env: Env): Promise<UserContext> {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) throw new HttpError(401, 'AUTH_REQUIRED', '请先登录芋炮小账本');
  const tokenHash = await secretHash(`session:${token}`, env);
  const now = currentEpoch();
  const row = await queryFirst<{
    session_id: string; csrf_token: string; expires_at: number; last_seen_at: number;
    user_id: string; email: string; display_name: string; household_id: string; household_name: string; role: 'owner' | 'member';
  }>(env.DB, `SELECT s.id AS session_id, s.csrf_token, s.expires_at, s.last_seen_at,
      u.id AS user_id, u.email, u.display_name, h.id AS household_id, h.name AS household_name, hm.role
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN household_members hm ON hm.user_id = u.id
    JOIN households h ON h.id = hm.household_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
    LIMIT 1`, tokenHash, now);
  if (!row) throw new HttpError(401, 'AUTH_REQUIRED', '登录已失效，请重新登录');
  if (now - Number(row.last_seen_at || 0) > 600) await run(env.DB, 'UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?', now, row.session_id);
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    householdId: row.household_id,
    householdName: row.household_name,
    role: row.role,
    sessionId: row.session_id,
    csrfToken: row.csrf_token,
  };
}

async function getDevelopmentContext(request: Request, env: Env): Promise<UserContext> {
  const email = normalizeEmail(request.headers.get('x-dev-user-email') || env.DEV_USER_EMAIL || 'dev1@yupao.local');
  let user = await queryFirst<{ id: string; display_name: string }>(env.DB, 'SELECT id, display_name FROM users WHERE email = ?', email);
  if (!user) {
    const userId = crypto.randomUUID();
    const displayName = displayNameFromEmail(email);
    await run(env.DB, 'INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)', userId, email, displayName);
    user = { id: userId, display_name: displayName };
  }
  const householdId = 'home';
  const householdName = env.HOUSEHOLD_NAME || '芋炮之家';
  await run(env.DB, 'INSERT OR IGNORE INTO households (id, name, base_currency, timezone) VALUES (?, ?, ?, ?)', householdId, householdName, 'CNY', 'Asia/Shanghai');
  let membership = await queryFirst<{ role: 'owner' | 'member' }>(env.DB, 'SELECT role FROM household_members WHERE household_id = ? AND user_id = ?', householdId, user.id);
  if (!membership) {
    const count = await queryFirst<{ count: number }>(env.DB, 'SELECT COUNT(*) AS count FROM household_members WHERE household_id = ?', householdId);
    const role = (count?.count ?? 0) === 0 ? 'owner' : 'member';
    await run(env.DB, 'INSERT INTO household_members (id, household_id, user_id, role) VALUES (?, ?, ?, ?)', crypto.randomUUID(), householdId, user.id, role);
    membership = { role };
  }
  await seedHousehold(env.DB, householdId);
  return { userId: user.id, email, displayName: user.display_name, householdId, householdName, role: membership.role };
}

function enforceRequestOrigin(request: Request): void {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (origin && origin !== expectedOrigin) throw new HttpError(403, 'ORIGIN_MISMATCH', '请求来源不正确');
  if (!origin && fetchSite && !['same-origin', 'none'].includes(fetchSite)) {
    throw new HttpError(403, 'ORIGIN_MISMATCH', '请求来源不正确');
  }
}

async function enforceCsrf(request: Request, context: UserContext): Promise<void> {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  if (!context.csrfToken) return;
  enforceRequestOrigin(request);
  const submitted = request.headers.get('x-csrf-token') || '';
  if (!(await constantTimeTextEqual(submitted, context.csrfToken))) throw new HttpError(403, 'CSRF_INVALID', '页面验证已失效，请刷新后再试');
}

function displayNameFromEmail(email: string): string {
  const prefix = email.split('@')[0] || '家庭成员';
  return prefix.length > 12 ? `${prefix.slice(0, 12)}…` : prefix;
}

async function queryFirst<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  return db.prepare(sql).bind(...params).first<T>();
}

async function queryAll<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const result = await db.prepare(sql).bind(...params).all<T>();
  return result.results ?? [];
}

async function run(db: D1Database, sql: string, ...params: unknown[]): Promise<D1Result> {
  return db.prepare(sql).bind(...params).run();
}

const DEFAULT_EXPENSE_CATEGORIES = [
  ['餐饮', 'bowl', '#EFA67C'], ['买菜', 'basket', '#7BBE91'], ['零食饮品', 'cup', '#D89CC8'],
  ['日用百货', 'bag', '#E4B65E'], ['交通出行', 'car', '#76A9D8'], ['房租房贷', 'home', '#9D8BD7'],
  ['水电燃气', 'bolt', '#77BFC6'], ['宠物', 'paw', '#C49473'], ['购物', 'shopping', '#E58A9B'],
  ['娱乐', 'game', '#8F9FDE'], ['医疗', 'medical', '#E57878'], ['旅行', 'plane', '#6FC2B0'],
  ['人情往来', 'gift', '#D79C64'], ['其他支出', 'dots', '#AAA2B3'],
] as const;

const DEFAULT_INCOME_CATEGORIES = [
  ['工资', 'wallet', '#55A77A'], ['奖金', 'star', '#65B98B'], ['报销', 'receipt', '#6EB399'],
  ['兼职', 'briefcase', '#8DBB74'], ['生意收入', 'store', '#4E9D7C'], ['理财收益', 'trend', '#73AFA1'],
  ['其他收入', 'dots', '#9AB4A3'],
] as const;

async function seedHousehold(db: D1Database, householdId: string): Promise<void> {
  const categoryCount = await queryFirst<{ count: number }>(db, 'SELECT COUNT(*) AS count FROM categories WHERE household_id = ?', householdId);
  if ((categoryCount?.count ?? 0) === 0) {
    for (const [name, icon, color] of DEFAULT_EXPENSE_CATEGORIES) {
      await run(db, `INSERT INTO categories (id, household_id, type, name, icon, color, sort_order) VALUES (?, ?, 'expense', ?, ?, ?, ?)`, crypto.randomUUID(), householdId, name, icon, color, DEFAULT_EXPENSE_CATEGORIES.findIndex((item) => item[0] === name));
    }
    for (const [name, icon, color] of DEFAULT_INCOME_CATEGORIES) {
      await run(db, `INSERT INTO categories (id, household_id, type, name, icon, color, sort_order) VALUES (?, ?, 'income', ?, ?, ?, ?)`, crypto.randomUUID(), householdId, name, icon, color, DEFAULT_INCOME_CATEGORIES.findIndex((item) => item[0] === name));
    }
  }

  const accountCount = await queryFirst<{ count: number }>(db, 'SELECT COUNT(*) AS count FROM accounts WHERE household_id = ?', householdId);
  if ((accountCount?.count ?? 0) === 0) {
    const accounts = [
      ['现金', 'cash', '#D6A45C'], ['微信', 'wechat', '#61B889'], ['支付宝', 'alipay', '#5B9FE2'], ['银行卡', 'card', '#8D7DD3'],
    ];
    for (let index = 0; index < accounts.length; index += 1) {
      const [name, icon, color] = accounts[index];
      await run(db, 'INSERT INTO accounts (id, household_id, name, type, currency, opening_balance_cents, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)', crypto.randomUUID(), householdId, name, icon === 'card' ? 'bank' : icon, 'CNY', icon, color, index);
    }
  }
}

function authBypassEnabled(request: Request, env: Env): boolean {
  if (env.AUTH_BYPASS !== 'true') return false;
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local');
}

async function ensureUserContext(request: Request, env: Env): Promise<UserContext> {
  if (authBypassEnabled(request, env)) return getDevelopmentContext(request, env);
  return getSessionContext(request, env);
}

function assertString(value: unknown, field: string, maxLength = 120, required = true): string {
  if (value == null || value === '') {
    if (!required) return '';
    throw new HttpError(400, 'VALIDATION_ERROR', `${field}不能为空`, { field });
  }
  if (typeof value !== 'string') throw new HttpError(400, 'VALIDATION_ERROR', `${field}格式不正确`, { field });
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, 'VALIDATION_ERROR', `${field}不能为空`, { field });
  if (trimmed.length > maxLength) throw new HttpError(400, 'VALIDATION_ERROR', `${field}内容太长`, { field, maxLength });
  return trimmed;
}

function assertInteger(value: unknown, field: string, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field}格式不正确`, { field, min, max });
  }
  return number;
}

function assertDate(value: unknown, field = '日期'): string {
  const date = assertString(value, field, 30);
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(date)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field}格式不正确`, { field });
  }
  const normalized = date.length === 10 ? `${date}T12:00:00` : date;
  const parsed = new Date(`${normalized}Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized.slice(0, 10)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field}不是有效日期`, { field });
  }
  return normalized;
}

function assertEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field}选项不正确`, { field, allowed });
  }
  return value as T;
}

function assertColor(value: unknown, field = '颜色'): string {
  const color = assertString(value, field, 7);
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new HttpError(400, 'VALIDATION_ERROR', `${field}格式不正确`, { field });
  return color.toUpperCase();
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new HttpError(415, 'CONTENT_TYPE_REQUIRED', '请使用 JSON 格式提交数据');
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '提交内容过大');
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '提交内容过大');
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'INVALID_JSON', '提交内容无法读取');
  }
}

function parseMonth(value: string | null): string {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' });
  const parts = formatter.formatToParts(now);
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

function monthRange(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = monthNumber === 12 ? `${year + 1}-01-01T00:00:00` : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01T00:00:00`;
  return { start: `${month}-01T00:00:00`, end: next };
}

function previousMonth(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, '0')}`;
}

async function audit(env: Env, context: UserContext, action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown): Promise<void> {
  await run(
    env.DB,
    'INSERT INTO audit_logs (id, household_id, actor_user_id, action, entity_type, entity_id, before_data, after_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    crypto.randomUUID(), context.householdId, context.userId, action, entityType, entityId,
    beforeData == null ? null : JSON.stringify(beforeData),
    afterData == null ? null : JSON.stringify(afterData),
  );
}

async function accountExists(env: Env, householdId: string, accountId: string): Promise<boolean> {
  return Boolean(await queryFirst(env.DB, 'SELECT id FROM accounts WHERE id = ? AND household_id = ? AND is_archived = 0', accountId, householdId));
}

async function categoryExists(env: Env, householdId: string, categoryId: string, type: CategoryType): Promise<boolean> {
  return Boolean(await queryFirst(env.DB, 'SELECT id FROM categories WHERE id = ? AND household_id = ? AND type = ? AND is_archived = 0', categoryId, householdId, type));
}

function accountBalanceExpression(alias = 'a'): string {
  return `
    ${alias}.opening_balance_cents + COALESCE((
      SELECT SUM(
        CASE
          WHEN t.type = 'income' AND t.account_id = ${alias}.id THEN t.amount_cents
          WHEN t.type = 'expense' AND t.account_id = ${alias}.id THEN -t.amount_cents
          WHEN t.type = 'transfer' AND t.account_id = ${alias}.id THEN -t.amount_cents
          WHEN t.type = 'transfer' AND t.target_account_id = ${alias}.id THEN t.amount_cents
          ELSE 0
        END
      )
      FROM transactions t
      WHERE t.household_id = ${alias}.household_id AND t.deleted_at IS NULL
        AND (t.account_id = ${alias}.id OR t.target_account_id = ${alias}.id)
    ), 0)`;
}

async function getAccounts(env: Env, context: UserContext, includeArchived = false): Promise<unknown[]> {
  return queryAll(
    env.DB,
    `SELECT a.*, ${accountBalanceExpression('a')} AS balance_cents
     FROM accounts a
     WHERE a.household_id = ? ${includeArchived ? '' : 'AND a.is_archived = 0'}
     ORDER BY a.is_archived, a.sort_order, a.created_at`,
    context.householdId,
  );
}

async function getCategories(env: Env, context: UserContext, includeArchived = false): Promise<unknown[]> {
  return queryAll(env.DB, `SELECT * FROM categories WHERE household_id = ? ${includeArchived ? '' : 'AND is_archived = 0'} ORDER BY type, sort_order, created_at`, context.householdId);
}

async function handleBootstrap(env: Env, context: UserContext, url: URL): Promise<Response> {
  const month = parseMonth(url.searchParams.get('month'));
  const [accounts, categories, budgets] = await Promise.all([
    getAccounts(env, context),
    getCategories(env, context),
    queryAll(env.DB, 'SELECT * FROM budgets WHERE household_id = ? AND period = ? ORDER BY created_at', context.householdId, month),
  ]);
  return ok({
    user: { id: context.userId, email: context.email, displayName: context.displayName, role: context.role },
    household: { id: context.householdId, name: context.householdName, baseCurrency: 'CNY', timezone: 'Asia/Shanghai' },
    accounts,
    categories,
    budgets,
    month,
  });
}

async function listTransactions(env: Env, context: UserContext, url: URL): Promise<Response> {
  const month = url.searchParams.get('month');
  const type = url.searchParams.get('type');
  const accountId = url.searchParams.get('accountId');
  const categoryId = url.searchParams.get('categoryId');
  const memberId = url.searchParams.get('memberId');
  const search = (url.searchParams.get('search') || '').trim();
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 300);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const clauses = ['t.household_id = ?'];
  const params: unknown[] = [context.householdId];
  if (!includeDeleted) clauses.push('t.deleted_at IS NULL');
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const range = monthRange(month);
    clauses.push('t.occurred_at >= ? AND t.occurred_at < ?');
    params.push(range.start, range.end);
  }
  if (type && ['income', 'expense', 'transfer'].includes(type)) {
    clauses.push('t.type = ?');
    params.push(type);
  }
  if (accountId) {
    clauses.push('(t.account_id = ? OR t.target_account_id = ?)');
    params.push(accountId, accountId);
  }
  if (categoryId) {
    clauses.push('t.category_id = ?');
    params.push(categoryId);
  }
  if (memberId) {
    clauses.push('t.created_by = ?');
    params.push(memberId);
  }
  if (search) {
    clauses.push("(COALESCE(t.merchant, '') LIKE ? OR COALESCE(t.note, '') LIKE ?)");
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    params.push(pattern, pattern);
  }

  const rows = await queryAll(
    env.DB,
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
            a.name AS account_name, ta.name AS target_account_name,
            u.display_name AS creator_name,
            (SELECT COUNT(*) FROM invoices i WHERE i.household_id = t.household_id AND i.transaction_id = t.id AND i.status = 'recorded') AS invoice_count
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.target_account_id
     LEFT JOIN users u ON u.id = t.created_by
     WHERE ${clauses.join(' AND ')}
     ORDER BY t.occurred_at DESC, t.created_at DESC
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  const count = await queryFirst<{ count: number }>(env.DB, `SELECT COUNT(*) AS count FROM transactions t WHERE ${clauses.join(' AND ')}`, ...params);
  return ok({ items: rows, total: count?.count ?? rows.length, limit, offset });
}

function parseTransactionBody(body: Record<string, unknown>): {
  type: TransactionType;
  amountCents: number;
  accountId: string;
  targetAccountId: string | null;
  categoryId: string | null;
  occurredAt: string;
  merchant: string | null;
  note: string | null;
} {
  const type = assertEnum(body.type, '类型', ['expense', 'income', 'transfer'] as const);
  const amountCents = assertInteger(body.amountCents, '金额', 1, 999_999_999_99);
  const accountId = assertString(body.accountId, '账户', 80);
  const occurredAt = assertDate(body.occurredAt);
  const merchant = assertString(body.merchant, '商户', 80, false) || null;
  const note = assertString(body.note, '备注', 300, false) || null;
  const targetAccountId = type === 'transfer' ? assertString(body.targetAccountId, '转入账户', 80) : null;
  const categoryId = type === 'transfer' ? null : assertString(body.categoryId, '分类', 80);
  if (type === 'transfer' && targetAccountId === accountId) throw new HttpError(400, 'SAME_ACCOUNT_TRANSFER', '转出和转入账户不能相同');
  return { type, amountCents, accountId, targetAccountId, categoryId, occurredAt, merchant, note };
}

async function validateTransactionRelations(env: Env, context: UserContext, data: ReturnType<typeof parseTransactionBody>): Promise<void> {
  if (!(await accountExists(env, context.householdId, data.accountId))) throw new HttpError(400, 'ACCOUNT_NOT_FOUND', '所选账户不存在或已归档');
  if (data.targetAccountId && !(await accountExists(env, context.householdId, data.targetAccountId))) throw new HttpError(400, 'TARGET_ACCOUNT_NOT_FOUND', '转入账户不存在或已归档');
  if (data.categoryId && !(await categoryExists(env, context.householdId, data.categoryId, data.type as CategoryType))) throw new HttpError(400, 'CATEGORY_NOT_FOUND', '所选分类不存在或已归档');
}

async function createTransaction(request: Request, env: Env, context: UserContext): Promise<Response> {
  const body = await readJson(request);
  const data = parseTransactionBody(body);
  await validateTransactionRelations(env, context, data);
  const id = crypto.randomUUID();
  await run(
    env.DB,
    `INSERT INTO transactions
      (id, household_id, type, amount_cents, currency, account_id, target_account_id, category_id, merchant, note, occurred_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, 'CNY', ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, context.householdId, data.type, data.amountCents, data.accountId, data.targetAccountId, data.categoryId,
    data.merchant, data.note, data.occurredAt, context.userId, context.userId,
  );
  const created = await queryFirst(env.DB, 'SELECT * FROM transactions WHERE id = ? AND household_id = ?', id, context.householdId);
  await audit(env, context, 'create', 'transaction', id, null, created);
  return ok(created, 201);
}

async function getTransaction(env: Env, context: UserContext, id: string): Promise<Record<string, unknown>> {
  const item = await queryFirst<Record<string, unknown>>(
    env.DB,
    `SELECT t.*, c.name AS category_name, a.name AS account_name, ta.name AS target_account_name, u.display_name AS creator_name,
            (SELECT COUNT(*) FROM invoices i WHERE i.household_id = t.household_id AND i.transaction_id = t.id AND i.status = 'recorded') AS invoice_count
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.target_account_id
     LEFT JOIN users u ON u.id = t.created_by
     WHERE t.id = ? AND t.household_id = ?`,
    id,
    context.householdId,
  );
  if (!item) throw new HttpError(404, 'TRANSACTION_NOT_FOUND', '没有找到这笔记录');
  return item;
}

async function updateTransaction(request: Request, env: Env, context: UserContext, id: string): Promise<Response> {
  const before = await getTransaction(env, context, id);
  if (before.deleted_at) throw new HttpError(409, 'TRANSACTION_DELETED', '这笔记录已经删除');
  const body = await readJson(request);
  const data = parseTransactionBody(body);
  const version = assertInteger(body.version, '版本', 1);
  await validateTransactionRelations(env, context, data);
  const result = await run(
    env.DB,
    `UPDATE transactions SET type = ?, amount_cents = ?, account_id = ?, target_account_id = ?, category_id = ?,
       merchant = ?, note = ?, occurred_at = ?, updated_by = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND household_id = ? AND version = ? AND deleted_at IS NULL`,
    data.type, data.amountCents, data.accountId, data.targetAccountId, data.categoryId, data.merchant, data.note,
    data.occurredAt, context.userId, id, context.householdId, version,
  );
  if ((result.meta?.changes ?? 0) === 0) throw new HttpError(409, 'VERSION_CONFLICT', '这笔记录刚刚被另一台设备修改，请刷新后再试');
  const after = await getTransaction(env, context, id);
  await audit(env, context, 'update', 'transaction', id, before, after);
  return ok(after);
}

async function deleteTransaction(env: Env, context: UserContext, id: string): Promise<Response> {
  const before = await getTransaction(env, context, id);
  if (!before.deleted_at) {
    await run(env.DB, 'UPDATE transactions SET deleted_at = CURRENT_TIMESTAMP, updated_by = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?', context.userId, id, context.householdId);
    await audit(env, context, 'delete', 'transaction', id, before, null);
  }
  return ok({ id, deleted: true });
}

async function restoreTransaction(env: Env, context: UserContext, id: string): Promise<Response> {
  const before = await getTransaction(env, context, id);
  if (before.deleted_at) {
    await run(env.DB, 'UPDATE transactions SET deleted_at = NULL, updated_by = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?', context.userId, id, context.householdId);
  }
  const after = await getTransaction(env, context, id);
  await audit(env, context, 'restore', 'transaction', id, before, after);
  return ok(after);
}


function invoiceExpectedTransactionType(type: InvoiceType): 'expense' | 'income' {
  return type === 'received' ? 'expense' : 'income';
}

async function validateInvoiceTransaction(env: Env, context: UserContext, type: InvoiceType, transactionId: string | null): Promise<void> {
  if (!transactionId) return;
  const transaction = await queryFirst<{ type: string }>(
    env.DB,
    'SELECT type FROM transactions WHERE id = ? AND household_id = ? AND deleted_at IS NULL',
    transactionId,
    context.householdId,
  );
  if (!transaction) throw new HttpError(400, 'TRANSACTION_NOT_FOUND', '所选收支记录不存在或已删除');
  const expected = invoiceExpectedTransactionType(type);
  if (transaction.type !== expected) {
    throw new HttpError(400, 'INVOICE_TRANSACTION_TYPE_MISMATCH', type === 'received' ? '收到的发票只能关联支出记录' : '开出的发票只能关联收入记录');
  }
}

function parseInvoiceBody(body: Record<string, unknown>): {
  type: InvoiceType;
  invoiceNumber: string;
  invoiceCode: string | null;
  title: string;
  counterpartyName: string;
  amountCents: number;
  taxAmountCents: number;
  invoiceDate: string;
  transactionId: string | null;
  note: string | null;
} {
  const type = assertEnum(body.type, '发票类型', ['received', 'issued'] as const);
  const invoiceNumber = assertString(body.invoiceNumber, '发票号码', 80);
  const invoiceCode = assertString(body.invoiceCode, '发票代码', 80, false) || null;
  const title = assertString(body.title, '发票抬头/内容', 120);
  const counterpartyName = assertString(body.counterpartyName, type === 'received' ? '开票方' : '客户名称', 120);
  const amountCents = assertInteger(body.amountCents, '发票金额', 1, 999_999_999_99);
  const taxAmountCents = assertInteger(body.taxAmountCents ?? 0, '税额', 0, amountCents);
  const invoiceDate = assertDate(body.invoiceDate, '开票日期');
  const transactionId = assertString(body.transactionId, '关联记录', 80, false) || null;
  const note = assertString(body.note, '备注', 500, false) || null;
  return { type, invoiceNumber, invoiceCode, title, counterpartyName, amountCents, taxAmountCents, invoiceDate, transactionId, note };
}

async function getInvoice(env: Env, context: UserContext, id: string): Promise<Record<string, unknown>> {
  const item = await queryFirst<Record<string, unknown>>(
    env.DB,
    `SELECT i.*, t.type AS transaction_type, t.amount_cents AS transaction_amount_cents,
      t.occurred_at AS transaction_occurred_at, t.merchant AS transaction_merchant,
      c.name AS transaction_category_name, a.name AS transaction_account_name
     FROM invoices i
     LEFT JOIN transactions t ON t.id = i.transaction_id AND t.household_id = i.household_id
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE i.id = ? AND i.household_id = ?`,
    id,
    context.householdId,
  );
  if (!item) throw new HttpError(404, 'INVOICE_NOT_FOUND', '没有找到这张发票');
  return item;
}

async function listInvoices(env: Env, context: UserContext, url: URL): Promise<Response> {
  const month = url.searchParams.get('month');
  const type = url.searchParams.get('type');
  const status = url.searchParams.get('status');
  const linked = url.searchParams.get('linked');
  const search = (url.searchParams.get('search') || '').trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 300);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  const clauses = ['i.household_id = ?'];
  const params: unknown[] = [context.householdId];
  if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    const range = monthRange(month);
    clauses.push('i.invoice_date >= ? AND i.invoice_date < ?');
    params.push(range.start, range.end);
  }
  if (type && ['received', 'issued'].includes(type)) { clauses.push('i.type = ?'); params.push(type); }
  if (status && ['recorded', 'void'].includes(status)) { clauses.push('i.status = ?'); params.push(status); }
  else clauses.push("i.status = 'recorded'");
  if (linked === 'true') clauses.push('i.transaction_id IS NOT NULL');
  if (linked === 'false') clauses.push('i.transaction_id IS NULL');
  if (search) {
    clauses.push("(i.invoice_number LIKE ? OR COALESCE(i.invoice_code, '') LIKE ? OR i.title LIKE ? OR i.counterparty_name LIKE ? OR COALESCE(i.note, '') LIKE ?)");
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }
  const select = `SELECT i.*, t.type AS transaction_type, t.amount_cents AS transaction_amount_cents,
      t.occurred_at AS transaction_occurred_at, t.merchant AS transaction_merchant,
      c.name AS transaction_category_name, a.name AS transaction_account_name
    FROM invoices i
    LEFT JOIN transactions t ON t.id = i.transaction_id AND t.household_id = i.household_id
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN accounts a ON a.id = t.account_id`;
  const rows = await queryAll(env.DB, `${select} WHERE ${clauses.join(' AND ')} ORDER BY i.invoice_date DESC, i.created_at DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
  const count = await queryFirst<{ count: number }>(env.DB, `SELECT COUNT(*) AS count FROM invoices i WHERE ${clauses.join(' AND ')}`, ...params);
  return ok({ items: rows, total: count?.count ?? rows.length, limit, offset });
}

async function createInvoice(request: Request, env: Env, context: UserContext): Promise<Response> {
  const body = await readJson(request);
  const data = parseInvoiceBody(body);
  await validateInvoiceTransaction(env, context, data.type, data.transactionId);
  const id = crypto.randomUUID();
  try {
    await run(env.DB, `INSERT INTO invoices
      (id, household_id, type, status, invoice_number, invoice_code, title, counterparty_name, amount_cents, tax_amount_cents, currency, invoice_date, transaction_id, note, created_by, updated_by)
      VALUES (?, ?, ?, 'recorded', ?, ?, ?, ?, ?, ?, 'CNY', ?, ?, ?, ?, ?)`,
      id, context.householdId, data.type, data.invoiceNumber, data.invoiceCode, data.title, data.counterpartyName,
      data.amountCents, data.taxAmountCents, data.invoiceDate, data.transactionId, data.note, context.userId, context.userId);
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) throw new HttpError(409, 'INVOICE_NUMBER_EXISTS', '同类型下已经记录过这个发票号码');
    throw error;
  }
  const created = await getInvoice(env, context, id);
  await audit(env, context, 'create', 'invoice', id, null, created);
  return ok(created, 201);
}

async function updateInvoice(request: Request, env: Env, context: UserContext, id: string): Promise<Response> {
  const before = await getInvoice(env, context, id);
  if (before.status === 'void') throw new HttpError(409, 'INVOICE_VOID', '这张发票已经作废');
  const body = await readJson(request);
  const data = parseInvoiceBody(body);
  const version = assertInteger(body.version, '版本', 1);
  await validateInvoiceTransaction(env, context, data.type, data.transactionId);
  let result: D1Result;
  try {
    result = await run(env.DB, `UPDATE invoices SET type = ?, invoice_number = ?, invoice_code = ?, title = ?, counterparty_name = ?,
      amount_cents = ?, tax_amount_cents = ?, invoice_date = ?, transaction_id = ?, note = ?, updated_by = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND household_id = ? AND version = ? AND status = 'recorded'`,
      data.type, data.invoiceNumber, data.invoiceCode, data.title, data.counterpartyName, data.amountCents, data.taxAmountCents,
      data.invoiceDate, data.transactionId, data.note, context.userId, id, context.householdId, version);
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) throw new HttpError(409, 'INVOICE_NUMBER_EXISTS', '同类型下已经记录过这个发票号码');
    throw error;
  }
  if ((result.meta?.changes ?? 0) === 0) throw new HttpError(409, 'VERSION_CONFLICT', '这张发票刚刚被另一台设备修改，请刷新后再试');
  const after = await getInvoice(env, context, id);
  await audit(env, context, 'update', 'invoice', id, before, after);
  return ok(after);
}

async function voidInvoice(env: Env, context: UserContext, id: string): Promise<Response> {
  const before = await getInvoice(env, context, id);
  if (before.status !== 'void') {
    await run(env.DB, "UPDATE invoices SET status = 'void', updated_by = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?", context.userId, id, context.householdId);
    await audit(env, context, 'void', 'invoice', id, before, null);
  }
  return ok({ id, void: true });
}

async function restoreInvoice(env: Env, context: UserContext, id: string): Promise<Response> {
  const before = await getInvoice(env, context, id);
  if (before.status === 'void') {
    try {
      await run(env.DB, "UPDATE invoices SET status = 'recorded', updated_by = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?", context.userId, id, context.householdId);
    } catch (error) {
      if (String(error).toLowerCase().includes('unique')) throw new HttpError(409, 'INVOICE_NUMBER_EXISTS', '同类型下已经存在相同发票号码，无法恢复');
      throw error;
    }
  }
  const after = await getInvoice(env, context, id);
  await audit(env, context, 'restore', 'invoice', id, before, after);
  return ok(after);
}

async function invoiceSummary(env: Env, context: UserContext, url: URL): Promise<Response> {
  const month = parseMonth(url.searchParams.get('month'));
  const range = monthRange(month);
  const rows = await queryAll<{ type: InvoiceType; amount_cents: number; count: number; linked_count: number }>(env.DB, `SELECT type,
      COALESCE(SUM(amount_cents), 0) AS amount_cents, COUNT(*) AS count,
      COALESCE(SUM(CASE WHEN transaction_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS linked_count
    FROM invoices WHERE household_id = ? AND status = 'recorded' AND invoice_date >= ? AND invoice_date < ? GROUP BY type`,
    context.householdId, range.start, range.end);
  const received = rows.find((item) => item.type === 'received');
  const issued = rows.find((item) => item.type === 'issued');
  return ok({ month,
    received: { amountCents: Number(received?.amount_cents || 0), count: Number(received?.count || 0), linkedCount: Number(received?.linked_count || 0) },
    issued: { amountCents: Number(issued?.amount_cents || 0), count: Number(issued?.count || 0), linkedCount: Number(issued?.linked_count || 0) },
  });
}

async function handleAccounts(request: Request, env: Env, context: UserContext, id?: string): Promise<Response> {
  if (request.method === 'GET' && !id) return ok(await getAccounts(env, context, new URL(request.url).searchParams.get('includeArchived') === 'true'));
  if (request.method === 'POST' && !id) {
    const body = await readJson(request);
    const name = assertString(body.name, '账户名称', 30);
    const type = assertEnum(body.type, '账户类型', ['cash', 'wechat', 'alipay', 'bank', 'credit', 'stored', 'other'] as const);
    const openingBalanceCents = assertInteger(body.openingBalanceCents ?? 0, '期初余额', -999_999_999_99, 999_999_999_99);
    const icon = assertString(body.icon || type, '图标', 30);
    const color = assertColor(body.color || '#8E7CDA');
    const sort = await queryFirst<{ max_sort: number | null }>(env.DB, 'SELECT MAX(sort_order) AS max_sort FROM accounts WHERE household_id = ?', context.householdId);
    const newId = crypto.randomUUID();
    await run(env.DB, 'INSERT INTO accounts (id, household_id, name, type, currency, opening_balance_cents, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', newId, context.householdId, name, type, 'CNY', openingBalanceCents, icon, color, (sort?.max_sort ?? -1) + 1);
    const created = await queryFirst(env.DB, 'SELECT * FROM accounts WHERE id = ?', newId);
    await audit(env, context, 'create', 'account', newId, null, created);
    return ok(created, 201);
  }
  if (!id) throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支持这个操作');
  const before = await queryFirst<Record<string, unknown>>(env.DB, 'SELECT * FROM accounts WHERE id = ? AND household_id = ?', id, context.householdId);
  if (!before) throw new HttpError(404, 'ACCOUNT_NOT_FOUND', '没有找到这个账户');
  if (request.method === 'PATCH') {
    const body = await readJson(request);
    const name = assertString(body.name ?? before.name, '账户名称', 30);
    const type = assertEnum(body.type ?? before.type, '账户类型', ['cash', 'wechat', 'alipay', 'bank', 'credit', 'stored', 'other'] as const);
    const openingBalanceCents = assertInteger(body.openingBalanceCents ?? before.opening_balance_cents, '期初余额', -999_999_999_99, 999_999_999_99);
    const icon = assertString(body.icon ?? before.icon, '图标', 30);
    const color = assertColor(body.color ?? before.color);
    await run(env.DB, 'UPDATE accounts SET name = ?, type = ?, opening_balance_cents = ?, icon = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?', name, type, openingBalanceCents, icon, color, id, context.householdId);
    const after = await queryFirst(env.DB, 'SELECT * FROM accounts WHERE id = ?', id);
    await audit(env, context, 'update', 'account', id, before, after);
    return ok(after);
  }
  if (request.method === 'DELETE') {
    await run(env.DB, 'UPDATE accounts SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?', id, context.householdId);
    const after = await queryFirst(env.DB, 'SELECT * FROM accounts WHERE id = ?', id);
    await audit(env, context, 'archive', 'account', id, before, after);
    return ok(after);
  }
  throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支持这个操作');
}

async function handleCategories(request: Request, env: Env, context: UserContext, id?: string): Promise<Response> {
  if (request.method === 'GET' && !id) return ok(await getCategories(env, context, new URL(request.url).searchParams.get('includeArchived') === 'true'));
  if (request.method === 'POST' && !id) {
    const body = await readJson(request);
    const type = assertEnum(body.type, '分类类型', ['expense', 'income'] as const);
    const name = assertString(body.name, '分类名称', 20);
    const icon = assertString(body.icon || 'dots', '图标', 30);
    const color = assertColor(body.color || '#8E7CDA');
    const sort = await queryFirst<{ max_sort: number | null }>(env.DB, 'SELECT MAX(sort_order) AS max_sort FROM categories WHERE household_id = ? AND type = ?', context.householdId, type);
    const newId = crypto.randomUUID();
    await run(env.DB, 'INSERT INTO categories (id, household_id, type, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)', newId, context.householdId, type, name, icon, color, (sort?.max_sort ?? -1) + 1);
    const created = await queryFirst(env.DB, 'SELECT * FROM categories WHERE id = ?', newId);
    await audit(env, context, 'create', 'category', newId, null, created);
    return ok(created, 201);
  }
  if (!id) throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支持这个操作');
  const before = await queryFirst<Record<string, unknown>>(env.DB, 'SELECT * FROM categories WHERE id = ? AND household_id = ?', id, context.householdId);
  if (!before) throw new HttpError(404, 'CATEGORY_NOT_FOUND', '没有找到这个分类');
  if (request.method === 'PATCH') {
    const body = await readJson(request);
    const name = assertString(body.name ?? before.name, '分类名称', 20);
    const icon = assertString(body.icon ?? before.icon, '图标', 30);
    const color = assertColor(body.color ?? before.color);
    await run(env.DB, 'UPDATE categories SET name = ?, icon = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?', name, icon, color, id, context.householdId);
    const after = await queryFirst(env.DB, 'SELECT * FROM categories WHERE id = ?', id);
    await audit(env, context, 'update', 'category', id, before, after);
    return ok(after);
  }
  if (request.method === 'DELETE') {
    await run(env.DB, 'UPDATE categories SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?', id, context.householdId);
    const after = await queryFirst(env.DB, 'SELECT * FROM categories WHERE id = ?', id);
    await audit(env, context, 'archive', 'category', id, before, after);
    return ok(after);
  }
  throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支持这个操作');
}

async function handleBudgets(request: Request, env: Env, context: UserContext, id?: string): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET' && !id) {
    const period = parseMonth(url.searchParams.get('period'));
    return ok(await queryAll(env.DB, `SELECT b.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
      FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
      WHERE b.household_id = ? AND b.period = ? ORDER BY CASE WHEN b.category_id IS NULL THEN 0 ELSE 1 END, c.sort_order`, context.householdId, period));
  }
  if (request.method === 'POST' && !id) {
    const body = await readJson(request);
    const period = parseMonth(typeof body.period === 'string' ? body.period : null);
    const categoryId = body.categoryId == null || body.categoryId === '' ? null : assertString(body.categoryId, '分类', 80);
    const amountCents = assertInteger(body.amountCents, '预算金额', 0, 999_999_999_99);
    if (categoryId && !(await categoryExists(env, context.householdId, categoryId, 'expense'))) throw new HttpError(400, 'CATEGORY_NOT_FOUND', '所选支出分类不存在');
    const existing = await queryFirst<{ id: string }>(env.DB, `SELECT id FROM budgets WHERE household_id = ? AND period = ? AND ${categoryId ? 'category_id = ?' : 'category_id IS NULL'}`, ...(categoryId ? [context.householdId, period, categoryId] : [context.householdId, period]));
    const budgetId = existing?.id || crypto.randomUUID();
    if (existing) {
      await run(env.DB, 'UPDATE budgets SET amount_cents = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?', amountCents, budgetId, context.householdId);
    } else {
      await run(env.DB, 'INSERT INTO budgets (id, household_id, period, category_id, amount_cents) VALUES (?, ?, ?, ?, ?)', budgetId, context.householdId, period, categoryId, amountCents);
    }
    const saved = await queryFirst(env.DB, 'SELECT * FROM budgets WHERE id = ?', budgetId);
    await audit(env, context, existing ? 'update' : 'create', 'budget', budgetId, existing, saved);
    return ok(saved, existing ? 200 : 201);
  }
  if (!id) throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支持这个操作');
  if (request.method === 'DELETE') {
    const before = await queryFirst(env.DB, 'SELECT * FROM budgets WHERE id = ? AND household_id = ?', id, context.householdId);
    if (!before) throw new HttpError(404, 'BUDGET_NOT_FOUND', '没有找到这项预算');
    await run(env.DB, 'DELETE FROM budgets WHERE id = ? AND household_id = ?', id, context.householdId);
    await audit(env, context, 'delete', 'budget', id, before, null);
    return ok({ id, deleted: true });
  }
  throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支持这个操作');
}

async function overviewStats(env: Env, context: UserContext, url: URL): Promise<Response> {
  const month = parseMonth(url.searchParams.get('month'));
  const range = monthRange(month);
  const previous = previousMonth(month);
  const previousRange = monthRange(previous);

  const sums = await queryFirst<{ income_cents: number; expense_cents: number }>(env.DB, `SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END), 0) AS income_cents,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0) AS expense_cents
    FROM transactions WHERE household_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?`, context.householdId, range.start, range.end);
  const previousSums = await queryFirst<{ income_cents: number; expense_cents: number }>(env.DB, `SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END), 0) AS income_cents,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0) AS expense_cents
    FROM transactions WHERE household_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?`, context.householdId, previousRange.start, previousRange.end);
  const recent = await queryAll(env.DB, `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
      a.name AS account_name, ta.name AS target_account_name, u.display_name AS creator_name,
      (SELECT COUNT(*) FROM invoices i WHERE i.household_id = t.household_id AND i.transaction_id = t.id AND i.status = 'recorded') AS invoice_count
    FROM transactions t LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN accounts ta ON ta.id = t.target_account_id LEFT JOIN users u ON u.id = t.created_by
    WHERE t.household_id = ? AND t.deleted_at IS NULL ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT 6`, context.householdId);
  const accounts = await getAccounts(env, context);
  const totalBalanceCents = (accounts as Array<{ balance_cents?: number }>).reduce((sum, account) => sum + Number(account.balance_cents || 0), 0);
  const totalBudget = await queryFirst<{ amount_cents: number }>(env.DB, `SELECT COALESCE(SUM(amount_cents), 0) AS amount_cents FROM budgets WHERE household_id = ? AND period = ? AND category_id IS NULL`, context.householdId, month);
  const categoryBudget = await queryFirst<{ amount_cents: number }>(env.DB, `SELECT COALESCE(SUM(amount_cents), 0) AS amount_cents FROM budgets WHERE household_id = ? AND period = ? AND category_id IS NOT NULL`, context.householdId, month);
  const budgetCents = Number(totalBudget?.amount_cents || categoryBudget?.amount_cents || 0);

  return ok({
    month,
    incomeCents: Number(sums?.income_cents || 0),
    expenseCents: Number(sums?.expense_cents || 0),
    balanceCents: Number(sums?.income_cents || 0) - Number(sums?.expense_cents || 0),
    previousIncomeCents: Number(previousSums?.income_cents || 0),
    previousExpenseCents: Number(previousSums?.expense_cents || 0),
    totalBalanceCents,
    budgetCents,
    budgetUsedCents: Number(sums?.expense_cents || 0),
    recent,
    accounts,
  });
}

async function trendStats(env: Env, context: UserContext, url: URL): Promise<Response> {
  const month = parseMonth(url.searchParams.get('month'));
  const range = monthRange(month);
  const rows = await queryAll<{ date: string; income_cents: number; expense_cents: number }>(env.DB, `SELECT substr(occurred_at, 1, 10) AS date,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END), 0) AS income_cents,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0) AS expense_cents
    FROM transactions WHERE household_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?
    GROUP BY substr(occurred_at, 1, 10) ORDER BY date`, context.householdId, range.start, range.end);
  return ok({ month, items: rows });
}

async function categoryBreakdown(env: Env, context: UserContext, url: URL): Promise<Response> {
  const month = parseMonth(url.searchParams.get('month'));
  const range = monthRange(month);
  const rows = await queryAll(env.DB, `SELECT c.id AS category_id, COALESCE(c.name, '未分类') AS name, COALESCE(c.icon, 'dots') AS icon,
      COALESCE(c.color, '#AAA2B3') AS color, SUM(t.amount_cents) AS amount_cents, COUNT(*) AS count
    FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.household_id = ? AND t.deleted_at IS NULL AND t.type = 'expense' AND t.occurred_at >= ? AND t.occurred_at < ?
    GROUP BY c.id, c.name, c.icon, c.color ORDER BY amount_cents DESC`, context.householdId, range.start, range.end);
  return ok({ month, items: rows });
}

async function monthComparison(env: Env, context: UserContext, url: URL): Promise<Response> {
  const endMonth = parseMonth(url.searchParams.get('month'));
  const months: string[] = [];
  let cursor = endMonth;
  for (let i = 0; i < 6; i += 1) {
    months.unshift(cursor);
    cursor = previousMonth(cursor);
  }
  const rows = await queryAll<{ month: string; income_cents: number; expense_cents: number }>(env.DB, `SELECT substr(occurred_at, 1, 7) AS month,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END), 0) AS income_cents,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0) AS expense_cents
    FROM transactions WHERE household_id = ? AND deleted_at IS NULL AND substr(occurred_at, 1, 7) >= ? AND substr(occurred_at, 1, 7) <= ?
    GROUP BY substr(occurred_at, 1, 7) ORDER BY month`, context.householdId, months[0], months[months.length - 1]);
  const map = new Map(rows.map((item) => [item.month, item]));
  return ok({ items: months.map((month) => ({ month, income_cents: Number(map.get(month)?.income_cents || 0), expense_cents: Number(map.get(month)?.expense_cents || 0) })) });
}

async function budgetProgress(env: Env, context: UserContext, url: URL): Promise<Response> {
  const month = parseMonth(url.searchParams.get('month'));
  const range = monthRange(month);
  const rows = await queryAll(env.DB, `SELECT b.id, b.category_id, b.amount_cents, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
      COALESCE((SELECT SUM(t.amount_cents) FROM transactions t WHERE t.household_id = b.household_id AND t.deleted_at IS NULL
        AND t.type = 'expense' AND t.category_id = b.category_id AND t.occurred_at >= ? AND t.occurred_at < ?), 0) AS used_cents
    FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
    WHERE b.household_id = ? AND b.period = ? AND b.category_id IS NOT NULL ORDER BY c.sort_order`, range.start, range.end, context.householdId, month);
  return ok({ month, items: rows });
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function exportData(env: Env, context: UserContext, format: 'csv' | 'json'): Promise<Response> {
  const rows = await queryAll<Record<string, unknown>>(env.DB, `SELECT t.occurred_at, t.type, t.amount_cents, t.currency, c.name AS category,
      a.name AS account, ta.name AS target_account, t.merchant, t.note, u.display_name AS created_by, t.created_at, t.updated_at
    FROM transactions t LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN accounts ta ON ta.id = t.target_account_id LEFT JOIN users u ON u.id = t.created_by
    WHERE t.household_id = ? AND t.deleted_at IS NULL ORDER BY t.occurred_at DESC`, context.householdId);
  const timestamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    const invoices = await queryAll<Record<string, unknown>>(env.DB, `SELECT i.type, i.status, i.invoice_number, i.invoice_code, i.title, i.counterparty_name, i.amount_cents, i.tax_amount_cents, i.currency, i.invoice_date, i.transaction_id, i.note, i.created_at, i.updated_at
      FROM invoices i WHERE i.household_id = ? ORDER BY i.invoice_date DESC, i.created_at DESC`, context.householdId);
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), household: context.householdName, transactions: rows, invoices }, null, 2), {
      headers: { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="yupao-ledger-${timestamp}.json"`, 'cache-control': 'no-store' },
    });
  }
  const columns = ['occurred_at', 'type', 'amount_cents', 'currency', 'category', 'account', 'target_account', 'merchant', 'note', 'created_by', 'created_at', 'updated_at'];
  const lines = [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))];
  return new Response(`\uFEFF${lines.join('\n')}`, {
    headers: { ...SECURITY_HEADERS, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="yupao-ledger-${timestamp}.csv"`, 'cache-control': 'no-store' },
  });
}


function assertEmail(value: unknown, field = '邮箱'): string {
  const email = normalizeEmail(assertString(value, field, 160));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'VALIDATION_ERROR', `${field}格式不正确`, { field });
  return email;
}

async function authConfigured(env: Env): Promise<boolean> {
  const row = await queryFirst<{ count: number }>(env.DB, `SELECT COUNT(*) AS count
    FROM auth_credentials c
    JOIN household_members hm ON hm.user_id = c.user_id
    WHERE hm.household_id = 'home'`);
  return (row?.count ?? 0) >= 2;
}

async function executeBatch(db: D1Database, statements: D1PreparedStatement[]): Promise<void> {
  if (db.batch) {
    const results = await db.batch(statements);
    if (results.some((result) => result.success === false)) throw new HttpError(500, 'DATABASE_ERROR', '账号初始化失败，请稍后再试');
    return;
  }
  for (const statement of statements) await statement.run();
}

async function handleSetupStatus(request: Request, env: Env): Promise<Response> {
  let schemaReady = true;
  let configured = false;
  try {
    configured = authBypassEnabled(request, env) || await authConfigured(env);
  } catch {
    schemaReady = false;
  }
  const pepperReady = secretIsReady(env.PASSWORD_PEPPER);
  const setupTokenReady = secretIsReady(env.SETUP_TOKEN);
  return ok({
    schemaReady,
    configured,
    secretsReady: pepperReady && (configured || setupTokenReady),
    setupTokenReady,
    pepperReady,
    passwordIterations: passwordIterations(env),
  });
}

async function handleAuthSetup(request: Request, env: Env): Promise<Response> {
  if (await authConfigured(env)) throw new HttpError(409, 'SETUP_COMPLETE', '小账本已经完成初始化');
  requiredSecret(env.PASSWORD_PEPPER, 'PASSWORD_PEPPER');
  const configuredSetupToken = requiredSecret(env.SETUP_TOKEN, 'SETUP_TOKEN');
  const body = await readJson(request);
  const submittedToken = assertString(body.setupToken, '初始化密钥', 256);
  const setupIdentity = 'setup@yupao.local';
  const setupIpHash = await enforceLoginRateLimit(request, env, setupIdentity);
  const setupTokenValid = await constantTimeTextEqual(submittedToken, configuredSetupToken);
  await recordLoginAttempt(env.DB, setupIdentity, setupIpHash, setupTokenValid);
  if (!setupTokenValid) throw new HttpError(403, 'SETUP_TOKEN_INVALID', '初始化密钥不正确');
  await run(env.DB, 'DELETE FROM login_attempts WHERE email = ? AND success = 0', setupIdentity);

  const householdName = assertString(body.householdName || env.HOUSEHOLD_NAME || '芋炮之家', '家庭名称', 40);
  const ownerEmail = assertEmail(body.ownerEmail, '管理员邮箱');
  const memberEmail = assertEmail(body.memberEmail, '家庭成员邮箱');
  if (ownerEmail === memberEmail) throw new HttpError(400, 'VALIDATION_ERROR', '两个账号需要使用不同邮箱');
  const ownerName = assertString(body.ownerName, '管理员昵称', 24);
  const memberName = assertString(body.memberName, '家庭成员昵称', 24);
  if (!body.ownerCredential || !body.memberCredential) {
    throw new HttpError(409, 'CLIENT_UPDATE_REQUIRED', '页面仍在使用旧版本，请清除该网站缓存并重新打开后再创建账号');
  }
  const ownerCredential = assertClientCredential(body.ownerCredential);
  const memberCredential = assertClientCredential(body.memberCredential);
  if (ownerCredential.iterations !== passwordIterations(env) || memberCredential.iterations !== passwordIterations(env)) {
    throw new HttpError(400, 'CREDENTIAL_INVALID', '密码计算参数已变化，请刷新页面后重试');
  }

  const existingOwner = await queryFirst<{ id: string }>(env.DB, 'SELECT id FROM users WHERE email = ?', ownerEmail);
  const existingMember = await queryFirst<{ id: string }>(env.DB, 'SELECT id FROM users WHERE email = ?', memberEmail);
  const ownerId = existingOwner?.id || crypto.randomUUID();
  const memberId = existingMember?.id || crypto.randomUUID();
  const householdId = 'home';
  const ownerPasswordRecord = { hash: await storedCredentialHash(ownerCredential.proof, env), salt: ownerCredential.salt, iterations: ownerCredential.iterations };
  const memberPasswordRecord = { hash: await storedCredentialHash(memberCredential.proof, env), salt: memberCredential.salt, iterations: memberCredential.iterations };
  const ownerCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
  const memberCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
  const now = currentEpoch();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, updated_at = CURRENT_TIMESTAMP`).bind(ownerId, ownerEmail, ownerName),
    env.DB.prepare(`INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, updated_at = CURRENT_TIMESTAMP`).bind(memberId, memberEmail, memberName),
    env.DB.prepare(`INSERT INTO households (id, name, base_currency, timezone) VALUES (?, ?, 'CNY', 'Asia/Shanghai')
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = CURRENT_TIMESTAMP`).bind(householdId, householdName),
    env.DB.prepare(`INSERT INTO household_members (id, household_id, user_id, role) VALUES (?, ?, ?, 'owner')
      ON CONFLICT(household_id, user_id) DO UPDATE SET role = 'owner'`).bind(crypto.randomUUID(), householdId, ownerId),
    env.DB.prepare(`INSERT INTO household_members (id, household_id, user_id, role) VALUES (?, ?, ?, 'member')
      ON CONFLICT(household_id, user_id) DO UPDATE SET role = 'member'`).bind(crypto.randomUUID(), householdId, memberId),
    env.DB.prepare(`INSERT INTO auth_credentials (user_id, password_hash, password_salt, password_iterations, password_changed_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash,
      password_salt = excluded.password_salt, password_iterations = excluded.password_iterations, password_changed_at = excluded.password_changed_at`).bind(
      ownerId, ownerPasswordRecord.hash, ownerPasswordRecord.salt, ownerPasswordRecord.iterations, now,
    ),
    env.DB.prepare(`INSERT INTO auth_credentials (user_id, password_hash, password_salt, password_iterations, password_changed_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash,
      password_salt = excluded.password_salt, password_iterations = excluded.password_iterations, password_changed_at = excluded.password_changed_at`).bind(
      memberId, memberPasswordRecord.hash, memberPasswordRecord.salt, memberPasswordRecord.iterations, now,
    ),
    env.DB.prepare('DELETE FROM recovery_codes WHERE user_id IN (?, ?)').bind(ownerId, memberId),
  ];
  for (const [userId, codes] of [[ownerId, ownerCodes], [memberId, memberCodes]] as const) {
    for (const code of codes) {
      statements.push(env.DB.prepare('INSERT INTO recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)').bind(
        crypto.randomUUID(), userId, await secretHash(`recovery:${normalizeRecoveryCode(code)}`, env), now,
      ));
    }
  }
  await executeBatch(env.DB, statements);
  await seedHousehold(env.DB, householdId);
  return ok({
    householdName,
    accounts: [
      { email: ownerEmail, displayName: ownerName, role: 'owner', recoveryCodes: ownerCodes },
      { email: memberEmail, displayName: memberName, role: 'member', recoveryCodes: memberCodes },
    ],
  }, 201);
}

async function authUserSummary(env: Env, userId: string): Promise<{ id: string; email: string; displayName: string; role: string; householdName: string }> {
  const row = await queryFirst<{ id: string; email: string; display_name: string; role: string; household_name: string }>(env.DB, `SELECT u.id, u.email, u.display_name, hm.role, h.name AS household_name
    FROM users u JOIN household_members hm ON hm.user_id = u.id JOIN households h ON h.id = hm.household_id
    WHERE u.id = ? LIMIT 1`, userId);
  if (!row) throw new HttpError(401, 'AUTH_REQUIRED', '账号尚未加入家庭空间');
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role, householdName: row.household_name };
}

async function handlePasswordParams(request: Request, env: Env): Promise<Response> {
  requiredSecret(env.PASSWORD_PEPPER, 'PASSWORD_PEPPER');
  const body = await readJson(request);
  const email = assertEmail(body.email);
  const row = await queryFirst<{ password_salt: string; password_iterations: number }>(env.DB, `SELECT c.password_salt, c.password_iterations
    FROM users u JOIN auth_credentials c ON c.user_id = u.id WHERE u.email = ?`, email);
  if (row) return ok({ salt: row.password_salt, iterations: Number(row.password_iterations) });
  const fakeBytes = base64UrlDecode(await secretHash(`password-params:${email}`, env)).slice(0, 16);
  return ok({ salt: base64UrlEncode(fakeBytes), iterations: passwordIterations(env) });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  requiredSecret(env.PASSWORD_PEPPER, 'PASSWORD_PEPPER');
  if (!(await authConfigured(env))) throw new HttpError(409, 'SETUP_REQUIRED', '请先完成小账本初始化');
  const body = await readJson(request);
  const email = assertEmail(body.email);
  const passwordProof = body.passwordProof;
  const rememberMe = body.rememberMe === true;
  const ipHash = await enforceLoginRateLimit(request, env, email);
  const row = await queryFirst<{ user_id: string; password_hash: string }>(env.DB, `SELECT u.id AS user_id, c.password_hash
    FROM users u JOIN auth_credentials c ON c.user_id = u.id WHERE u.email = ?`, email);
  const valid = await verifyCredentialProof(passwordProof, row || null, env);
  await recordLoginAttempt(env.DB, email, ipHash, valid);
  if (!valid || !row) throw new HttpError(401, 'LOGIN_FAILED', '邮箱或密码不正确');
  await run(env.DB, 'DELETE FROM login_attempts WHERE email = ? AND success = 0', email);
  const session = await createSession(row.user_id, request, env, rememberMe);
  const user = await authUserSummary(env, row.user_id);
  return ok({ user, csrfToken: session.csrfToken }, 200, { 'set-cookie': sessionCookie(session.token, session.maxAge) });
}

async function handleAuthSession(request: Request, env: Env): Promise<Response> {
  if (authBypassEnabled(request, env)) {
    const context = await getDevelopmentContext(request, env);
    return ok({ user: { id: context.userId, email: context.email, displayName: context.displayName, role: context.role, householdName: context.householdName }, csrfToken: '' });
  }
  const context = await getSessionContext(request, env);
  return ok({ user: { id: context.userId, email: context.email, displayName: context.displayName, role: context.role, householdName: context.householdName }, csrfToken: context.csrfToken });
}

async function handleLogout(env: Env, context: UserContext): Promise<Response> {
  if (context.sessionId) await run(env.DB, 'UPDATE auth_sessions SET revoked_at = ? WHERE id = ?', currentEpoch(), context.sessionId);
  return ok({ loggedOut: true }, 200, { 'set-cookie': clearSessionCookie() });
}

async function handleChangePassword(request: Request, env: Env, context: UserContext): Promise<Response> {
  const body = await readJson(request);
  const credential = await queryFirst<{ password_hash: string }>(env.DB, 'SELECT password_hash FROM auth_credentials WHERE user_id = ?', context.userId);
  if (!(await verifyCredentialProof(body.currentPasswordProof, credential, env))) throw new HttpError(401, 'CURRENT_PASSWORD_INVALID', '当前密码不正确');
  const next = assertClientCredential(body.newCredential);
  if (next.iterations !== passwordIterations(env)) throw new HttpError(400, 'CREDENTIAL_INVALID', '密码计算参数已变化，请刷新页面后重试');
  const existingSession = context.sessionId ? await queryFirst<{ created_at: number; expires_at: number }>(env.DB, 'SELECT created_at, expires_at FROM auth_sessions WHERE id = ?', context.sessionId) : null;
  const rememberMe = Boolean(existingSession && Number(existingSession.expires_at) - Number(existingSession.created_at) > SESSION_SECONDS);
  const record = { hash: await storedCredentialHash(next.proof, env), salt: next.salt, iterations: next.iterations };
  const now = currentEpoch();
  await run(env.DB, 'UPDATE auth_credentials SET password_hash = ?, password_salt = ?, password_iterations = ?, password_changed_at = ? WHERE user_id = ?', record.hash, record.salt, record.iterations, now, context.userId);
  await run(env.DB, 'UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', now, context.userId);
  const session = await createSession(context.userId, request, env, rememberMe);
  await audit(env, context, 'security.password_changed', 'user', context.userId, null, { sessionsRotated: true });
  return ok({ changed: true, csrfToken: session.csrfToken }, 200, { 'set-cookie': sessionCookie(session.token, session.maxAge) });
}

async function handleRevokeOtherSessions(env: Env, context: UserContext): Promise<Response> {
  const result = await run(env.DB, 'UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL', currentEpoch(), context.userId, context.sessionId || '');
  await audit(env, context, 'security.sessions_revoked', 'user', context.userId, null, { revokedCount: Number(result.meta?.changes || 0) });
  return ok({ revoked: true, revokedCount: Number(result.meta?.changes || 0) });
}

async function handleRegenerateRecoveryCodes(request: Request, env: Env, context: UserContext): Promise<Response> {
  const body = await readJson(request);
  const credential = await queryFirst<{ password_hash: string }>(env.DB, 'SELECT password_hash FROM auth_credentials WHERE user_id = ?', context.userId);
  if (!(await verifyCredentialProof(body.currentPasswordProof, credential, env))) throw new HttpError(401, 'CURRENT_PASSWORD_INVALID', '当前密码不正确');
  const recoveryCodes = await replaceRecoveryCodes(context.userId, env);
  await audit(env, context, 'security.recovery_codes_regenerated', 'user', context.userId, null, { count: recoveryCodes.length });
  return ok({ recoveryCodes });
}

async function handleRecover(request: Request, env: Env): Promise<Response> {
  requiredSecret(env.PASSWORD_PEPPER, 'PASSWORD_PEPPER');
  const body = await readJson(request);
  const email = assertEmail(body.email);
  const code = normalizeRecoveryCode(assertString(body.recoveryCode, '恢复码', 80));
  const next = assertClientCredential(body.newCredential);
  if (next.iterations !== passwordIterations(env)) throw new HttpError(400, 'CREDENTIAL_INVALID', '密码计算参数已变化，请刷新页面后重试');
  const ipHash = await enforceLoginRateLimit(request, env, email);
  const user = await queryFirst<{ id: string }>(env.DB, 'SELECT id FROM users WHERE email = ?', email);
  let matchedId = '';
  if (user) {
    const expected = await secretHash(`recovery:${code}`, env);
    const codes = await queryAll<{ id: string; code_hash: string }>(env.DB, 'SELECT id, code_hash FROM recovery_codes WHERE user_id = ? AND used_at IS NULL', user.id);
    for (const item of codes) {
      if (await constantTimeTextEqual(item.code_hash, expected)) { matchedId = item.id; break; }
    }
  }
  const valid = Boolean(user && matchedId);
  await recordLoginAttempt(env.DB, email, ipHash, valid);
  if (!user || !matchedId) throw new HttpError(401, 'RECOVERY_FAILED', '邮箱或恢复码不正确');
  const record = { hash: await storedCredentialHash(next.proof, env), salt: next.salt, iterations: next.iterations };
  const now = currentEpoch();
  await run(env.DB, 'UPDATE auth_credentials SET password_hash = ?, password_salt = ?, password_iterations = ?, password_changed_at = ? WHERE user_id = ?', record.hash, record.salt, record.iterations, now, user.id);
  await run(env.DB, 'UPDATE recovery_codes SET used_at = ? WHERE id = ?', now, matchedId);
  await run(env.DB, 'UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', now, user.id);
  await run(env.DB, 'DELETE FROM login_attempts WHERE email = ?', email);
  return ok({ recovered: true }, 200, { 'set-cookie': clearSessionCookie() });
}

async function routeApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: SECURITY_HEADERS });
  if (url.pathname === '/api/health') return ok({ service: 'yupao-ledger', auth: 'internal-session', time: new Date().toISOString() });

  if (url.pathname === '/api/auth/setup-status' && request.method === 'GET') return handleSetupStatus(request, env);
  if (request.method === 'POST' && ['/api/auth/setup', '/api/auth/password-params', '/api/auth/login', '/api/auth/recover'].includes(url.pathname)) enforceRequestOrigin(request);
  if (url.pathname === '/api/auth/setup' && request.method === 'POST') return handleAuthSetup(request, env);
  if (url.pathname === '/api/auth/password-params' && request.method === 'POST') return handlePasswordParams(request, env);
  if (url.pathname === '/api/auth/login' && request.method === 'POST') return handleLogin(request, env);
  if (url.pathname === '/api/auth/recover' && request.method === 'POST') return handleRecover(request, env);
  if (url.pathname === '/api/auth/session' && request.method === 'GET') return handleAuthSession(request, env);

  const context = await ensureUserContext(request, env);
  await enforceCsrf(request, context);

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') return handleLogout(env, context);
  if (url.pathname === '/api/auth/change-password' && request.method === 'POST') return handleChangePassword(request, env, context);
  if (url.pathname === '/api/auth/revoke-other-sessions' && request.method === 'POST') return handleRevokeOtherSessions(env, context);
  if (url.pathname === '/api/auth/recovery-codes' && request.method === 'POST') return handleRegenerateRecoveryCodes(request, env, context);

  if (url.pathname === '/api/me' && request.method === 'GET') return ok({ id: context.userId, email: context.email, displayName: context.displayName, role: context.role, householdName: context.householdName });
  if (url.pathname === '/api/bootstrap' && request.method === 'GET') return handleBootstrap(env, context, url);

  if (url.pathname === '/api/transactions' && request.method === 'GET') return listTransactions(env, context, url);
  if (url.pathname === '/api/transactions' && request.method === 'POST') return createTransaction(request, env, context);
  const transactionMatch = url.pathname.match(/^\/api\/transactions\/([^/]+)(?:\/(restore))?$/);
  if (transactionMatch) {
    const id = decodeURIComponent(transactionMatch[1]);
    if (transactionMatch[2] === 'restore' && request.method === 'POST') return restoreTransaction(env, context, id);
    if (request.method === 'GET') return ok(await getTransaction(env, context, id));
    if (request.method === 'PATCH') return updateTransaction(request, env, context, id);
    if (request.method === 'DELETE') return deleteTransaction(env, context, id);
  }

  if (url.pathname === '/api/invoices/summary' && request.method === 'GET') return invoiceSummary(env, context, url);
  if (url.pathname === '/api/invoices' && request.method === 'GET') return listInvoices(env, context, url);
  if (url.pathname === '/api/invoices' && request.method === 'POST') return createInvoice(request, env, context);
  const invoiceMatch = url.pathname.match(/^\/api\/invoices\/([^/]+)(?:\/(restore))?$/);
  if (invoiceMatch) {
    const id = decodeURIComponent(invoiceMatch[1]);
    if (invoiceMatch[2] === 'restore' && request.method === 'POST') return restoreInvoice(env, context, id);
    if (request.method === 'GET') return ok(await getInvoice(env, context, id));
    if (request.method === 'PATCH') return updateInvoice(request, env, context, id);
    if (request.method === 'DELETE') return voidInvoice(env, context, id);
  }

  const accountMatch = url.pathname.match(/^\/api\/accounts(?:\/([^/]+))?$/);
  if (accountMatch) return handleAccounts(request, env, context, accountMatch[1] ? decodeURIComponent(accountMatch[1]) : undefined);
  const categoryMatch = url.pathname.match(/^\/api\/categories(?:\/([^/]+))?$/);
  if (categoryMatch) return handleCategories(request, env, context, categoryMatch[1] ? decodeURIComponent(categoryMatch[1]) : undefined);
  const budgetMatch = url.pathname.match(/^\/api\/budgets(?:\/([^/]+))?$/);
  if (budgetMatch) return handleBudgets(request, env, context, budgetMatch[1] ? decodeURIComponent(budgetMatch[1]) : undefined);

  if (url.pathname === '/api/stats/overview' && request.method === 'GET') return overviewStats(env, context, url);
  if (url.pathname === '/api/stats/trend' && request.method === 'GET') return trendStats(env, context, url);
  if (url.pathname === '/api/stats/category-breakdown' && request.method === 'GET') return categoryBreakdown(env, context, url);
  if (url.pathname === '/api/stats/month-comparison' && request.method === 'GET') return monthComparison(env, context, url);
  if (url.pathname === '/api/stats/budget-progress' && request.method === 'GET') return budgetProgress(env, context, url);

  if (url.pathname === '/api/export/csv' && request.method === 'GET') return exportData(env, context, 'csv');
  if (url.pathname === '/api/export/json' && request.method === 'GET') return exportData(env, context, 'json');

  throw new HttpError(404, 'NOT_FOUND', '没有找到这个接口');
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (url.pathname.startsWith('/api/')) return await routeApi(request, env);
    const response = await env.ASSETS.fetch(request);
    return applySecurityHeaders(response, url.pathname);
  } catch (error) {
    if (error instanceof HttpError) return fail(error);
    console.error('Unhandled error', { path: url.pathname, message: error instanceof Error ? error.message : String(error) });
    return fail(new HttpError(500, 'INTERNAL_ERROR', '系统暂时出了点问题，请稍后再试'));
  }
}

export default {
  fetch: handleRequest,
};
