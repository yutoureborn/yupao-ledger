import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');

const requiredAssets = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'sw.js',
  'vendor/preact.mjs',
  'vendor/preact-bootstrap.mjs',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

test('构建结果包含完整 PWA 资源', async () => {
  await Promise.all(requiredAssets.map((file) => access(path.join(dist, file))));
});

test('页面运行时不依赖外部 CDN', async () => {
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:\/\//i);
});

test('Service Worker 不缓存财务 API', async () => {
  const worker = await readFile(path.join(dist, 'sw.js'), 'utf8');
  assert.match(worker, /pathname\.startsWith\(['"]\/api\/['"]\)/);
  const shellBlock = worker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1] ?? '';
  assert.doesNotMatch(shellBlock, /['"]\/api\//);
});

test('应用产物包含动态 API 调用而非纯静态页面', async () => {
  const app = await readFile(path.join(dist, 'app.js'), 'utf8');
  assert.match(app, /\/api\/auth\/login/);
  assert.match(app, /\/api\/auth\/setup/);
  assert.match(app, /\/api\/bootstrap/);
  assert.match(app, /\/api\/transactions/);
  assert.match(app, /\/api\/stats\/overview/);
  assert.match(app, /\/api\/invoices/);
});

test('关键前端资源预加载且版本统一为 0.3.11', async () => {
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  const bootstrap = await readFile(path.join(dist, 'vendor/preact-bootstrap.mjs'), 'utf8');
  const worker = await readFile(path.join(dist, 'sw.js'), 'utf8');
  assert.match(html, /rel=["']preload["'][^>]+app\.js\?v=0\.3\.11/);
  assert.match(html, /rel=["']modulepreload["'][^>]+preact-bootstrap\.mjs\?v=0\.3\.11/);
  assert.match(html, /preact-bootstrap\.mjs\?v=0\.3\.11/);
  assert.match(bootstrap, /app\.js\?v=0\.3\.11/);
  assert.match(worker, /yupao-shell-v18/);
});

test('PWA 缓存按导航、版本资源和普通静态资源分层处理', async () => {
  const worker = await readFile(path.join(dist, 'sw.js'), 'utf8');
  assert.match(worker, /networkFirst/);
  assert.match(worker, /cacheFirst/);
  assert.match(worker, /staleWhileRevalidate/);
  assert.match(worker, /request\.mode === ['"]navigate['"]/);
  assert.match(worker, /url\.searchParams\.has\(['"]v['"]\)/);
  assert.match(worker, /cache: ['"]no-store['"]/);
});

test('支出分类模块在侧栏和完整统计中使用重构后的概览布局', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  const app = await readFile(path.join(root, 'src/frontend/app.tsx'), 'utf8');
  assert.match(css, /\.expense-module-head/);
  assert.match(css, /\.expense-chart-panel/);
  assert.match(css, /\.expense-list-panel/);
  assert.match(css, /\.expense-rank-row/);
  assert.match(app, /function describeDonutSlice/);
  assert.match(app, /expense-module/);
  assert.match(app, /expense-donut-svg/);
  assert.match(app, /查看全部分类/);
});

test('大芋头与小炮台使用正式角色资产，并通过统一映射接入页面场景', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  const app = await readFile(path.join(root, 'src/frontend/app.tsx'), 'utf8');
  await access(path.join(dist, 'illustrations/mascots/hero-duo-v033.webp'));
  await access(path.join(dist, 'illustrations/mascots/taro-entry-v033.webp'));
  await access(path.join(dist, 'illustrations/mascots/duo-success-v033.webp'));
  await access(path.join(dist, 'illustrations/mascots/tank-summary-v033.webp'));
  await access(path.join(dist, 'illustrations/mascots/tank-safe-v033.webp'));
  await access(path.join(dist, 'illustrations/mascots/tank-warning-v033.webp'));
  await access(path.join(dist, 'illustrations/mascots/duo-invoice-v033.webp'));

  assert.match(app, /function HeroMascots/);
  assert.doesNotMatch(app, /function TaroCharacter/);
  assert.doesNotMatch(app, /function TankCharacter/);
  assert.match(app, /const MASCOT_ASSETS/);
  assert.match(app, /function MascotPicture/);
  assert.match(app, /hero-duo-v033/);
  assert.match(app, /duo-invoice-v033/);
  assert.match(app, /Mascot variant="invoice"/);
  assert.match(app, /playMotion/);
  assert.match(app, /prefers-reduced-motion/);

  assert.match(css, /\.mascot-asset-img/);
  assert.match(css, /\.hero-alert-badge/);
  assert.match(css, /\.invoice-hero-mascot/);
  assert.match(css, /prefers-reduced-motion/);
});

test('桌面首页使用完整宽度与十二列响应式 Bento 布局', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  const app = await readFile(path.join(root, 'src/frontend/app.tsx'), 'utf8');
  assert.match(app, /dashboard-page-v034/);
  assert.match(app, /dashboard-bento/);
  assert.match(app, /dashboard-card-trend/);
  assert.match(app, /dashboard-card-spending/);
  assert.match(app, /dashboard-card-invoice/);
  assert.match(app, /expense-compact/);
  assert.match(css, /grid-template-columns:\s*repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /--content-max:\s*1520px/);
  assert.match(css, /max-width:\s*var\(--content-max\)/);
  assert.match(css, /min-height:\s*44px/);
});

test('薄荷绿与莫兰迪粉设计系统进入构建产物', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  assert.match(css, /--mint:\s*#7fae9e/i);
  assert.match(css, /--pink:\s*#cda4a9/i);
  assert.match(css, /--surface-mint:\s*#e5f1eb/i);
  assert.match(css, /--surface-pink:\s*#f3e6e8/i);
  assert.match(css, /生活感薄荷绿 × 莫兰迪粉设计系统/);
  assert.match(css, /content-visibility:\s*auto/);
  assert.match(css, /contain-intrinsic-size/);
});

test('发票页面与轻量生活感主题进入构建产物', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  const app = await readFile(path.join(root, 'src/frontend/app.tsx'), 'utf8');
  assert.match(app, /发票夹/);
  assert.match(app, /收到的发票只能关联支出/);
  assert.match(app, /开出的发票只能关联收入/);
  assert.match(app, /invoice-journal-hero/);
  assert.match(app, /invoice-hero-mascot/);
  assert.match(css, /\.invoice-card/);
  assert.match(css, /\.invoice-pocket-card/);
});


test('v0.3.11 保留已确认联名品牌资产并升级选择式记账交互', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  const app = await readFile(path.join(root, 'src/frontend/app.tsx'), 'utf8');
  await access(path.join(dist, 'brand/brand-mark-v038.svg'));
  await access(path.join(dist, 'brand/brand-lockup-v038.svg'));
  await access(path.join(dist, 'brand/approved-brand-mark-v038.png'));
  await access(path.join(dist, 'brand/approved-brand-lockup-v038.png'));
  await access(path.join(dist, 'brand/source/approved-brand-mark-original.png'));
  await access(path.join(dist, 'brand/source/approved-brand-lockup-original.png'));
  assert.match(app, /brand-mark-v038\.svg/);
  assert.match(app, /function BrandLockup/);
  assert.match(app, /function MobileDashboardView/);
  assert.match(app, /function MobileTransactionsView/);
  assert.match(app, /function MobileStatsView/);
  assert.match(app, /function MobileMonthlyBars/);
  assert.match(app, /mobile-transaction-form-v039/);
  assert.match(app, /mobile-common-category-grid/);
  assert.match(app, /mobile-choice-sheet/);
  assert.match(app, /mobile-add-submit-bar-v039/);
  assert.match(app, /EXPENSE_CATEGORY_GROUPS/);
  assert.match(app, /recent-merchants/);
  assert.match(app, /小炮台/);
  assert.match(css, /\.mobile-product-view/);
  assert.match(css, /\.mobile-home-hero-body/);
  assert.match(css, /\.mobile-add-page-v039/);
  assert.match(css, /\.mobile-choice-overlay/);
  assert.match(css, /\.mobile-add-submit-bar-v039/);
  assert.match(css, /\.mobile-monthly-list/);
});


test('v0.3.11 桌面与移动记账表单严格互斥，避免双套表单同时渲染', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  const app = await readFile(path.join(root, 'src/frontend/app.tsx'), 'utf8');
  assert.match(app, /desktop-transaction-form-v039/);
  assert.match(app, /mobile-transaction-form-v039/);
  assert.match(css, /\.mobile-transaction-form-v039\s*\{\s*display:\s*none/);
  assert.match(css, /\.desktop-transaction-form-v039\s*\{\s*display:\s*block/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*?\.desktop-transaction-form-v039\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*?\.mobile-transaction-form-v039\s*\{\s*display:\s*grid/);
});

test('v0.3.11 明细页在桌面与移动端均接入分类筛选', async () => {
  const app = await readFile(path.join(root, 'src/frontend/app.tsx'), 'utf8');
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  assert.match(app, /categoryId:\s*''/);
  assert.match(app, /params\.set\('categoryId', this\.state\.categoryId\)/);
  assert.match(app, /detail-category-select/);
  assert.match(app, /mobile-detail-category-filter/);
  assert.match(app, /onCategory=\{\(categoryId: string\) => this\.changeFilter\(\{ categoryId \}\)\}/);
  assert.match(app, /type, categoryId: ''/);
  assert.match(css, /\.mobile-detail-category-filter/);
});
