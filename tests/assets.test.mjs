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
  const shellBlock = worker.match(/const SHELL = \[([\s\S]*?)\];/)?.[1] ?? '';
  assert.doesNotMatch(shellBlock, /['"]\/api\//);
});

test('应用产物包含动态 API 调用而非纯静态页面', async () => {
  const app = await readFile(path.join(dist, 'app.js'), 'utf8');
  assert.match(app, /\/api\/auth\/login/);
  assert.match(app, /\/api\/auth\/setup/);
  assert.match(app, /\/api\/bootstrap/);
  assert.match(app, /\/api\/transactions/);
  assert.match(app, /\/api\/stats\/overview/);
});


test('认证资源使用版本参数且 Service Worker 优先获取网络新版本', async () => {
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  const bootstrap = await readFile(path.join(dist, 'vendor/preact-bootstrap.mjs'), 'utf8');
  const worker = await readFile(path.join(dist, 'sw.js'), 'utf8');
  assert.match(html, /preact-bootstrap\.mjs\?v=0\.2\.6/);
  assert.match(bootstrap, /app\.js\?v=0\.2\.6/);
  assert.match(worker, /yupao-shell-v6/);
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

test('芋头与炮台使用静态拟人插画、角色职责和减少动态降级', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  const app = await readFile(path.join(root, 'src/frontend/app.tsx'), 'utf8');

  // 芋头负责快速记账，炮台负责整理统计与安全。
  assert.match(app, /taro-quick\.webp/);
  assert.match(app, /taro-ledger\.webp/);
  assert.match(app, /cannon-summary\.webp/);
  assert.match(app, /cannon-organize\.webp/);
  assert.match(app, /芋头准备好啦/);
  assert.match(app, /炮台已经整理好本月数据/);

  // 静态角色只保留轻微淡入或悬浮，不再依赖复杂 SVG 肢体动画。
  assert.match(css, /\.static-mascot/);
  assert.match(css, /static-float/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(app, /taro-pencil/);
  assert.doesNotMatch(app, /cannon-wheels/);

  // 新的奶油暖色 UI 与绿黑/芋泥紫角色资产均进入构建结果。
  assert.match(css, /--primary:\s*#E47C55/i);
  assert.match(css, /background:\s*linear-gradient\(180deg, #E8865D/i);
  for (const file of ['hero-duo.webp', 'taro-quick.webp', 'taro-ledger.webp', 'cannon-summary.webp', 'cannon-organize.webp']) {
    await access(path.join(dist, 'illustrations', file));
  }
});
