import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('正式部署默认使用受保护的 workers.dev 地址', async () => {
  const config = JSON.parse(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, false);
  assert.equal(config.name, 'yupao-ledger');
  assert.equal('routes' in config, false);
  assert.equal('route' in config, false);
  assert.equal('ALLOWED_EMAILS' in config.vars, false);
  assert.equal('ACCESS_AUD' in config.vars, false);
});
