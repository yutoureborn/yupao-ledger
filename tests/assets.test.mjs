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

test('关键前端资源预加载且版本统一为 0.3.1', async () => {
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  const bootstrap = await readFile(path.join(dist, 'vendor/preact-bootstrap.mjs'), 'utf8');
  const worker = await readFile(path.join(dist, 'sw.js'), 'utf8');
  assert.match(html, /rel=["']preload["'][^>]+app\.js\?v=0\.3\.1/);
  assert.match(html, /rel=["']modulepreload["'][^>]+preact-bootstrap\.mjs\?v=0\.3\.1/);
  assert.match(html, /preact-bootstrap\.mjs\?v=0\.3\.1/);
  assert.match(bootstrap, /app\.js\?v=0\.3\.1/);
  assert.match(worker, /yupao-shell-v10/);
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

test('支出分类卡片在侧栏和完整统计中均展示分类列表', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  const app = await readFile(path.join(root, 'src/frontend/app.tsx'), 'utf8');
  assert.match(css, /\.donut-layout\.compact\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /grid-template-columns:\s*22px\s+40px\s+minmax\(0,1fr\)\s+72px/);
  assert.match(css, /\.rank-label[^}]*white-space:\s*nowrap/);
  assert.match(css, /@container spending/);
  assert.match(app, /compact/);
  assert.match(app, /查看全部分类/);
  assert.match(app, /category-ranking/);
});

test('大芋头与小坦克使用内联 SVG，并提供轻量 WAAPI 动效与减少动态降级', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  const app = await readFile(path.join(root, 'src/frontend/app.tsx'), 'utf8');

  assert.match(app, /function TaroCharacter/);
  assert.match(app, /function TankCharacter/);
  assert.match(app, /function HeroMascots/);
  assert.match(app, /mascot-svg taro-svg/);
  assert.match(app, /mascot-svg tank-svg/);
  assert.match(app, /hero-character-taro/);
  assert.match(app, /hero-character-tank/);
  assert.match(app, /playMotion/);
  assert.match(app, /\.animate\(keyframes, options\)/);
  assert.match(app, /prefers-reduced-motion/);
  assert.match(app, /芋头准备好啦/);
  assert.match(app, /小坦克已经整理好本月数据/);
  assert.doesNotMatch(app, /\/illustrations\//);

  assert.match(css, /\.hero-character-taro[^}]*width:\s*64%/);
  assert.match(css, /\.hero-character-tank[^}]*width:\s*43%/);
  assert.match(css, /\.static-mascot \.tank-svg/);
  assert.match(css, /prefers-reduced-motion/);
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
  assert.match(app, /invoice-hero-icon/);
  assert.match(css, /\.invoice-card/);
  assert.match(css, /\.invoice-pocket-card/);
});
