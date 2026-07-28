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
  ALLOWED_EMAILS?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  HOUSEHOLD_NAME?: string;
}

type TransactionType = 'expense' | 'income' | 'transfer';
type CategoryType = 'expense' | 'income';

type UserContext = {
  userId: string;
  email: string;
  displayName: string;
  householdId: string;
  householdName: string;
  role: 'owner' | 'member';
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
};

let cachedJwks: { expiresAt: number; keys: JsonWebKey[] } | null = null;

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...SECURITY_HEADERS, ...extraHeaders },
  });
}

function ok<T>(data: T, status = 200): Response {
  return json({ ok: true, data }, status);
}

function fail(error: HttpError): Response {
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
  );
}

function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => headers.set(key, value));
  if (!headers.has('cache-control')) headers.set('cache-control', 'public, max-age=300');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseAllowedEmails(env: Env): string[] {
  return (env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean)
    .filter((email) => !email.startsWith('replace_with'));
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
  return output;
}

function decodeJwtPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(value))) as T;
}

async function loadAccessJwks(teamDomain: string): Promise<JsonWebKey[]> {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.keys;
  const endpoint = `${teamDomain.replace(/\/$/, '')}/cdn-cgi/access/certs`;
  const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new HttpError(503, 'AUTH_KEYS_UNAVAILABLE', '暂时无法验证登录状态');
  const payload = (await response.json()) as { keys?: JsonWebKey[] };
  if (!payload.keys?.length) throw new HttpError(503, 'AUTH_KEYS_INVALID', '登录验证配置不完整');
  cachedJwks = { keys: payload.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return payload.keys;
}

async function verifyAccessJwt(token: string, env: Env): Promise<{ email: string }> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.replace(/\/$/, '');
  const expectedAudience = env.ACCESS_AUD;
  if (!teamDomain || !expectedAudience || teamDomain.includes('REPLACE_WITH') || expectedAudience.includes('REPLACE_WITH')) {
    throw new HttpError(500, 'AUTH_NOT_CONFIGURED', 'Cloudflare Access 尚未完成配置');
  }

  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'INVALID_TOKEN', '登录状态无效');
  const header = decodeJwtPart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodeJwtPart<{
    email?: string;
    aud?: string | string[];
    iss?: string;
    exp?: number;
    nbf?: number;
  }>(parts[1]);

  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'INVALID_TOKEN', '登录状态无效');
  const keys = await loadAccessJwks(teamDomain);
  const jwk = keys.find((item) => (item as JsonWebKey & { kid?: string }).kid === header.kid);
  if (!jwk) {
    cachedJwks = null;
    throw new HttpError(401, 'TOKEN_KEY_NOT_FOUND', '登录状态已更新，请重新进入');
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const verified = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    base64UrlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new HttpError(401, 'INVALID_TOKEN', '登录状态无效');

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) throw new HttpError(401, 'TOKEN_EXPIRED', '登录已过期，请重新进入');
  if (payload.nbf && payload.nbf > now + 30) throw new HttpError(401, 'TOKEN_NOT_ACTIVE', '登录状态暂未生效');
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud].filter(Boolean);
  if (!audiences.includes(expectedAudience)) throw new HttpError(401, 'INVALID_AUDIENCE', '登录应用不匹配');
  if (payload.iss?.replace(/\/$/, '') !== teamDomain) throw new HttpError(401, 'INVALID_ISSUER', '登录来源不匹配');
  if (!payload.email) throw new HttpError(401, 'EMAIL_MISSING', '登录信息中缺少邮箱');
  return { email: normalizeEmail(payload.email) };
}

async function getAuthenticatedEmail(request: Request, env: Env): Promise<string> {
  if (env.AUTH_BYPASS === 'true') {
    return normalizeEmail(request.headers.get('x-dev-user-email') || env.DEV_USER_EMAIL || 'dev1@yupao.local');
  }
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) throw new HttpError(401, 'AUTH_REQUIRED', '请先完成身份验证');
  return (await verifyAccessJwt(token, env)).email;
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

async function ensureUserContext(request: Request, env: Env): Promise<UserContext> {
  const email = await getAuthenticatedEmail(request, env);
  const allowed = parseAllowedEmails(env);
  if (env.AUTH_BYPASS !== 'true' && allowed.length === 0) {
    throw new HttpError(500, 'EMAIL_ALLOWLIST_NOT_CONFIGURED', '允许访问的邮箱尚未配置');
  }
  if (allowed.length > 0 && !allowed.includes(email)) {
    throw new HttpError(403, 'EMAIL_NOT_ALLOWED', '这个账号没有芋炮小账本的访问权限');
  }

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

  return {
    userId: user.id,
    email,
    displayName: user.display_name,
    householdId,
    householdName,
    role: membership.role,
  };
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
  return date.length === 10 ? `${date}T12:00:00` : date;
}

function assertEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field}选项不正确`, { field, allowed });
  }
  return value as T;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new HttpError(415, 'CONTENT_TYPE_REQUIRED', '请使用 JSON 格式提交数据');
  try {
    const data = await request.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');
    return data as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'INVALID_JSON', '提交内容无法读取');
  }
}

function parseMonth(value: string | null): string {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value;
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
            u.display_name AS creator_name
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
    `SELECT t.*, c.name AS category_name, a.name AS account_name, ta.name AS target_account_name, u.display_name AS creator_name
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

async function handleAccounts(request: Request, env: Env, context: UserContext, id?: string): Promise<Response> {
  if (request.method === 'GET' && !id) return ok(await getAccounts(env, context, new URL(request.url).searchParams.get('includeArchived') === 'true'));
  if (request.method === 'POST' && !id) {
    const body = await readJson(request);
    const name = assertString(body.name, '账户名称', 30);
    const type = assertEnum(body.type, '账户类型', ['cash', 'wechat', 'alipay', 'bank', 'credit', 'stored', 'other'] as const);
    const openingBalanceCents = assertInteger(body.openingBalanceCents ?? 0, '期初余额', -999_999_999_99, 999_999_999_99);
    const icon = assertString(body.icon || type, '图标', 30);
    const color = assertString(body.color || '#8E7CDA', '颜色', 20);
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
    const color = assertString(body.color ?? before.color, '颜色', 20);
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
    const color = assertString(body.color || '#8E7CDA', '颜色', 20);
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
    const color = assertString(body.color ?? before.color, '颜色', 20);
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
      a.name AS account_name, ta.name AS target_account_name, u.display_name AS creator_name
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
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), household: context.householdName, transactions: rows }, null, 2), {
      headers: { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="yupao-ledger-${timestamp}.json"`, 'cache-control': 'no-store' },
    });
  }
  const columns = ['occurred_at', 'type', 'amount_cents', 'currency', 'category', 'account', 'target_account', 'merchant', 'note', 'created_by', 'created_at', 'updated_at'];
  const lines = [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))];
  return new Response(`\uFEFF${lines.join('\n')}`, {
    headers: { ...SECURITY_HEADERS, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="yupao-ledger-${timestamp}.csv"`, 'cache-control': 'no-store' },
  });
}

async function routeApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: SECURITY_HEADERS });
  if (url.pathname === '/api/health') return ok({ service: 'yupao-ledger', time: new Date().toISOString() });
  const context = await ensureUserContext(request, env);

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
    return applySecurityHeaders(response);
  } catch (error) {
    if (error instanceof HttpError) return fail(error);
    console.error('Unhandled error', { path: url.pathname, message: error instanceof Error ? error.message : String(error) });
    return fail(new HttpError(500, 'INTERNAL_ERROR', '系统暂时出了点问题，请稍后再试'));
  }
}

export default {
  fetch: handleRequest,
};
