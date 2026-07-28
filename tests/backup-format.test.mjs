import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');

test('加密备份格式可以被恢复脚本解密', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'yupao-restore-'));
  const passphrase = 'test-passphrase-for-yupao-ledger';
  const plaintext = Buffer.from('CREATE TABLE demo (id TEXT);\n', 'utf8');
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const encrypted = Buffer.concat([Buffer.from('YUPAO1'), salt, iv, tag, ciphertext]);
  const source = path.join(directory, 'sample.sql.enc');
  await writeFile(source, encrypted);

  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/restore-backup.mjs'), source],
    {
      cwd: directory,
      env: { ...process.env, BACKUP_PASSPHRASE: passphrase },
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const restored = await readFile(path.join(directory, '.backup/restore/sample.sql'));
  assert.deepEqual(restored, plaintext);
  await rm(directory, { recursive: true, force: true });
});
