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
const migrations = ['0001_init.sql', '0002_internal_auth.sql', '0003_invoices.sql'];
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
    ['cat-food','expense','餐饮','bowl','#EFA67C',0],
    ['cat-takeaway','expense','外卖','takeaway','#E99173',1],
    ['cat-grocery','expense','买菜','basket','#7BBE91',2],
    ['cat-drink','expense','零食饮品','cup','#D89CC8',3],
    ['cat-daily','expense','日用百货','bag','#E4B65E',4],
    ['cat-utility','expense','水电燃气','bolt','#77BFC6',5],
    ['cat-phone','expense','通讯网络','phone','#79AFC7',6],
    ['cat-subscription','expense','订阅会员','subscription','#A996C7',7],
    ['cat-rent','expense','房租房贷','home','#9D8BD7',8],
    ['cat-property','expense','物业费','building','#8DA5B8',9],
    ['cat-homegoods','expense','家居家装','sofa','#C3997A',10],
    ['cat-device','expense','数码家电','device','#879CB6',11],
    ['cat-metro','expense','公共交通','metro','#76A9D8',12],
    ['cat-taxi','expense','打车','taxi','#E5B34E',13],
    ['cat-fuel','expense','加油','fuel','#D49A5D',14],
    ['cat-parking','expense','停车','parking','#8DA1AD',15],
    ['cat-carcare','expense','车辆养护','car','#7C9FB8',16],
    ['cat-travel','expense','旅行','plane','#6FC2B0',17],
    ['cat-clothes','expense','服饰鞋包','clothes','#D88FA6',18],
    ['cat-beauty','expense','美妆护肤','beauty','#E7A2B3',19],
    ['cat-tech','expense','数码产品','tech','#8793C6',20],
    ['cat-shopping','expense','网购','shopping','#E58A9B',21],
    ['cat-medical','expense','医疗','medical','#E57878',22],
    ['cat-medicine','expense','药品','medicine','#D88989',23],
    ['cat-fitness','expense','健身运动','fitness','#78B690',24],
    ['cat-care','expense','保健护理','care','#A8B990',25],
    ['cat-petfood','expense','宠物食品','petfood','#C49473',26],
    ['cat-petdaily','expense','猫砂日用品','paw','#BE9C7E',27],
    ['cat-petmedical','expense','宠物医疗','petmedical','#D49187',28],
    ['cat-pettoy','expense','宠物玩具','pettoy','#D4A867',29],
    ['cat-entertainment','expense','娱乐','game','#8F9FDE',30],
    ['cat-movie','expense','电影演出','movie','#B58BC4',31],
    ['cat-hobby','expense','兴趣爱好','hobby','#B79B6F',32],
    ['cat-social','expense','人情往来','gift','#D79C64',33],
    ['cat-gift','expense','礼物','gift','#D69E7D',34],
    ['cat-redpacket','expense','红包','redpacket','#D88176',35],
    ['cat-study','expense','学习培训','study','#799AC7',36],
    ['cat-software','expense','软件工具','software','#8495B8',37],
    ['cat-office','expense','办公用品','office','#9CA98A',38],
    ['cat-insurance','expense','保险','insurance','#79A58D',39],
    ['cat-tax','expense','税费','tax','#B09185',40],
    ['cat-fee','expense','银行手续费','fee','#8A9DA6',41],
    ['cat-other-e','expense','其他支出','dots','#AAA2B3',42],
    ['cat-salary','income','工资','wallet','#55A77A',0],
    ['cat-bonus','income','奖金','star','#65B98B',1],
    ['cat-refund','income','报销','receipt','#6EB399',2],
    ['cat-parttime','income','兼职','briefcase','#8DBB74',3],
    ['cat-business','income','生意收入','store','#4E9D7C',4],
    ['cat-invest','income','理财收益','trend','#73AFA1',5],
    ['cat-other-i','income','其他收入','dots','#9AB4A3',6]
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
    ['expense',8990,'acc-alipay',null,'cat-petdaily','宠物店','猫砂',local(3,12),user2],
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
  const sampleExpense = db.prepare("SELECT id FROM transactions WHERE household_id = ? AND type = 'expense' ORDER BY occurred_at DESC LIMIT 1").get(household);
  const sampleIncome = db.prepare("SELECT id FROM transactions WHERE household_id = ? AND type = 'income' ORDER BY occurred_at DESC LIMIT 1").get(household);
  db.prepare(`INSERT OR IGNORE INTO invoices (id, household_id, type, status, invoice_number, title, counterparty_name, amount_cents, tax_amount_cents, currency, invoice_date, transaction_id, note, created_by, updated_by)
    VALUES (?, ?, 'received', 'recorded', ?, ?, ?, ?, ?, 'CNY', ?, ?, ?, ?, ?)`)
    .run('invoice-demo-received', household, 'R202607001', '餐饮消费', '巷口面馆', 6800, 0, local(0,19).slice(0,10), sampleExpense?.id || null, '本地演示发票', user1, user1);
  db.prepare(`INSERT OR IGNORE INTO invoices (id, household_id, type, status, invoice_number, title, counterparty_name, amount_cents, tax_amount_cents, currency, invoice_date, transaction_id, note, created_by, updated_by)
    VALUES (?, ?, 'issued', 'recorded', ?, ?, ?, ?, ?, 'CNY', ?, ?, ?, ?, ?)`)
    .run('invoice-demo-issued', household, 'I202607001', '设计服务费', '示例客户', 286000, 16189, local(14,16).slice(0,10), sampleIncome?.id || null, '本地演示发票', user1, user1);
  const month = local(0).slice(0,7);
  db.prepare('INSERT OR IGNORE INTO budgets (id,household_id,period,category_id,amount_cents) VALUES (?,?,?,?,?)').run('budget-total', household, month, null, 500000);
  db.prepare('INSERT OR IGNORE INTO budgets (id,household_id,period,category_id,amount_cents) VALUES (?,?,?,?,?)').run('budget-food', household, month, 'cat-food', 120000);
  db.prepare('INSERT OR IGNORE INTO budgets (id,household_id,period,category_id,amount_cents) VALUES (?,?,?,?,?)').run('budget-grocery', household, month, 'cat-grocery', 80000);
  db.prepare('INSERT OR IGNORE INTO budgets (id,household_id,period,category_id,amount_cents) VALUES (?,?,?,?,?)').run('budget-pet', household, month, 'cat-petdaily', 50000);
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

const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.txt':'text/plain; charset=utf-8','.map':'application/json' };
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
