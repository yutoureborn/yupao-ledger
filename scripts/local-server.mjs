import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { handleRequest } from '../build/worker/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const localDir = path.join(root, '.local');
await mkdir(localDir, { recursive: true });
const db = new DatabaseSync(path.join(localDir, 'yupao.db'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
const migrations = ['0001_init.sql', '0002_internal_auth.sql'];
for (const file of migrations) db.exec(await readFile(path.join(root, 'migrations', file), 'utf8'));

function seedDemoData() {
  const emptyMode = process.argv.includes('--empty');
  if (emptyMode) return;
  const count = Number(db.prepare('SELECT COUNT(*) AS count FROM transactions').get().count || 0);
  if (count > 0) return;
  const user1 = 'dev-user-1', user2 = 'dev-user-2', household = 'home';
  db.prepare('INSERT OR IGNORE INTO users (id,email,display_name) VALUES (?,?,?)').run(user1, 'dev1@yupao.local', '阿芋');
  db.prepare('INSERT OR IGNORE INTO users (id,email,display_name) VALUES (?,?,?)').run(user2, 'dev2@yupao.local', '小炮');
  db.prepare('INSERT OR IGNORE INTO households (id,name,base_currency,timezone) VALUES (?,?,?,?)').run(household, '芋炮之家', 'CNY', 'Asia/Shanghai');
  db.prepare('INSERT OR IGNORE INTO household_members (id,household_id,user_id,role) VALUES (?,?,?,?)').run('member-1', household, user1, 'owner');
  db.prepare('INSERT OR IGNORE INTO household_members (id,household_id,user_id,role) VALUES (?,?,?,?)').run('member-2', household, user2, 'member');
  const categories = [
    ['cat-food','expense','餐饮','bowl','#EFA67C',0],['cat-grocery','expense','买菜','basket','#7BBE91',1],['cat-drink','expense','零食饮品','cup','#D89CC8',2],
    ['cat-pet','expense','宠物','paw','#C49473',3],['cat-shopping','expense','购物','shopping','#E58A9B',4],['cat-transport','expense','交通出行','car','#76A9D8',5],
    ['cat-home','expense','水电燃气','bolt','#77BFC6',6],['cat-entertainment','expense','娱乐','game','#8F9FDE',7],['cat-other-e','expense','其他支出','dots','#AAA2B3',8],
    ['cat-salary','income','工资','wallet','#55A77A',0],['cat-business','income','生意收入','store','#4E9D7C',1],['cat-refund','income','报销','receipt','#6EB399',2],['cat-other-i','income','其他收入','dots','#9AB4A3',3]
  ];
  for (const row of categories) db.prepare('INSERT OR IGNORE INTO categories (id,household_id,type,name,icon,color,sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(row[0], household, ...row.slice(1));
  const accounts = [
    ['acc-wechat','微信','wechat','wechat','#61B889',580000],['acc-alipay','支付宝','alipay','alipay','#5B9FE2',236800],['acc-bank','生活银行卡','bank','card','#8D7DD3',1286000],['acc-cash','现金','cash','cash','#D6A45C',12000]
  ];
  for (let i=0;i<accounts.length;i++) {
    const row=accounts[i];
    db.prepare('INSERT OR IGNORE INTO accounts (id,household_id,name,type,currency,opening_balance_cents,icon,color,sort_order) VALUES (?,?,?,?,?,?,?,?,?)').run(row[0], household, row[1], row[2], 'CNY', row[5], row[3], row[4], i);
  }
  const now = new Date();
  const local = (daysAgo, hour=12) => {
    const d = new Date(now); d.setDate(d.getDate()-daysAgo); d.setHours(hour,0,0,0);
    const z = new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,19);
  };
  const tx = [
    ['expense',6800,'acc-wechat',null,'cat-food','巷口面馆','晚餐',local(0,19),user1],
    ['expense',3290,'acc-alipay',null,'cat-drink','咖啡店','下午咖啡',local(1,15),user2],
    ['expense',15680,'acc-wechat',null,'cat-grocery','社区超市','买菜和水果',local(2,18),user1],
    ['expense',8990,'acc-alipay',null,'cat-pet','宠物店','猫砂',local(3,12),user2],
    ['income',1280000,'acc-bank',null,'cat-salary','公司','本月工资',local(5,10),user1],
    ['expense',26800,'acc-bank',null,'cat-shopping','家居店','收纳用品',local(6,14),user2],
    ['transfer',200000,'acc-bank','acc-wechat',null,null,'生活费转入微信',local(7,9),user1],
    ['expense',4250,'acc-wechat',null,'cat-transport','网约车',null,local(8,21),user1],
    ['income',36000,'acc-alipay',null,'cat-refund','平台退款','退货退款',local(9,11),user2],
    ['expense',11800,'acc-wechat',null,'cat-entertainment','电影院','周末电影',local(10,20),user2],
    ['expense',7500,'acc-cash',null,'cat-food','早餐店',null,local(12,8),user1],
    ['income',286000,'acc-bank',null,'cat-business','客户','订单尾款',local(14,16),user1]
  ];
  for (const row of tx) {
    db.prepare(`INSERT INTO transactions (id,household_id,type,amount_cents,currency,account_id,target_account_id,category_id,merchant,note,occurred_at,created_by,updated_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(crypto.randomUUID(), household, row[0], row[1], 'CNY', row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[8]);
  }
  const month = local(0).slice(0,7);
  db.prepare('INSERT OR IGNORE INTO budgets (id,household_id,period,category_id,amount_cents) VALUES (?,?,?,?,?)').run('budget-total', household, month, null, 500000);
  db.prepare('INSERT OR IGNORE INTO budgets (id,household_id,period,category_id,amount_cents) VALUES (?,?,?,?,?)').run('budget-food', household, month, 'cat-food', 120000);
  db.prepare('INSERT OR IGNORE INTO budgets (id,household_id,period,category_id,amount_cents) VALUES (?,?,?,?,?)').run('budget-grocery', household, month, 'cat-grocery', 80000);
  db.prepare('INSERT OR IGNORE INTO budgets (id,household_id,period,category_id,amount_cents) VALUES (?,?,?,?,?)').run('budget-pet', household, month, 'cat-pet', 50000);
}
seedDemoData();

class LocalStatement {
  constructor(statement, values = []) { this.statement = statement; this.values = values; }
  bind(...values) { return new LocalStatement(this.statement, values); }
  async first(column) { const row = this.statement.get(...this.values) || null; return column && row ? row[column] : row; }
  async all() { return { success: true, results: this.statement.all(...this.values) }; }
  async run() { const result = this.statement.run(...this.values); return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid || 0) } }; }
}
const d1 = {
  prepare(sql) { return new LocalStatement(db.prepare(sql)); },
  async batch(statements) {
    db.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); db.exec('COMMIT'); return results; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
};

const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain; charset=utf-8','.map':'application/json' };
async function assetFetch(request) {
  const url = new URL(request.url);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  let file = path.join(dist, pathname.replace(/^\/+/, ''));
  try { const info = await stat(file); if (info.isDirectory()) file = path.join(file, 'index.html'); }
  catch { file = path.join(dist, 'index.html'); }
  const body = await readFile(file);
  return new Response(body, { headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' } });
}

const env = {
  DB: d1,
  ASSETS: { fetch: assetFetch },
  AUTH_BYPASS: process.argv.includes('--auth') ? 'false' : 'true',
  DEV_USER_EMAIL: process.env.DEV_USER_EMAIL || 'dev1@yupao.local',
  HOUSEHOLD_NAME: '芋炮之家',
  SETUP_TOKEN: 'local-setup-token-please-change',
  PASSWORD_PEPPER: 'local-development-pepper-not-for-production',
  PASSWORD_ITERATIONS: '100000'
};

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://${req.headers.host || 'localhost:4173'}${req.url || '/'}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET','HEAD'].includes(req.method || 'GET') ? undefined : body,
      duplex: body ? 'half' : undefined
    });
    const response = await handleRequest(request, env);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader('content-type','text/plain; charset=utf-8');
    res.end('Local server error');
  }
});

const port = Number(process.env.PORT || 4173);
server.listen(port, '0.0.0.0', () => {
  console.log(`\n芋炮小账本本地预览：http://localhost:${port}`);
  console.log(`本地用户：${env.DEV_USER_EMAIL}`);
  console.log('按 Ctrl+C 停止。\n');
});
