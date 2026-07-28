import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('正式部署使用 workers.dev 与内置认证，不依赖 Cloudflare Access', async () => {
  const config = JSON.parse(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, false);
  assert.equal(config.name, 'yupao-ledger');
  assert.equal('routes' in config, false);
  assert.equal('route' in config, false);
  assert.equal(config.vars.AUTH_BYPASS, 'false');
  assert.equal('ACCESS_TEAM_DOMAIN' in config.vars, false);
  assert.equal('ALLOWED_EMAILS' in config.vars, false);
  assert.equal('ACCESS_AUD' in config.vars, false);
  assert.equal('SETUP_TOKEN' in config.vars, false);
  assert.equal('PASSWORD_PEPPER' in config.vars, false);
});

test('认证密钥只出现在示例文件，不写入正式配置', async () => {
  const example = await readFile(path.join(root, '.dev.vars.example'), 'utf8');
  assert.match(example, /SETUP_TOKEN=/);
  assert.match(example, /PASSWORD_PEPPER=/);
});
