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
  assert.match(html, /preact-bootstrap\.mjs\?v=0\.2\.3/);
  assert.match(bootstrap, /app\.js\?v=0\.2\.3/);
  assert.match(worker, /yupao-shell-v4/);
  assert.match(worker, /cache: ['"]no-store['"]/);
});

test('支出分类卡片采用稳定列布局并避免分类名换行', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  const app = await readFile(path.join(dist, 'app.js'), 'utf8');
  assert.match(css, /grid-template-columns:\s*38px\s+minmax\(0,1fr\)\s+54px\s+76px/);
  assert.match(css, /\.rank-label[^}]*white-space:\s*nowrap/);
  assert.match(css, /@container spending/);
  assert.match(app, /spending-card/);
});

test('芋头与炮台包含拟人动作和减少动态降级', async () => {
  const css = await readFile(path.join(dist, 'styles.css'), 'utf8');
  const app = await readFile(path.join(dist, 'app.js'), 'utf8');
  assert.match(app, /taro-arm-right/);
  assert.match(app, /ledger-book/);
  assert.match(app, /cannon-arm/);
  assert.match(app, /safe-shield/);
  assert.match(css, /taro-wave/);
  assert.match(css, /cannon-wave/);
  assert.match(css, /prefers-reduced-motion/);
});
