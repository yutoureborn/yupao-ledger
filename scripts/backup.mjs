import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backupDir = path.join(root, '.backup');
const bucket = process.env.R2_BUCKET;
const passphrase = process.env.BACKUP_PASSPHRASE;
if (!bucket) throw new Error('缺少 R2_BUCKET 环境变量');
if (!passphrase || passphrase.length < 20) throw new Error('BACKUP_PASSPHRASE 至少需要 20 个字符');
await mkdir(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const sqlPath = path.join(backupDir, `yupao-ledger-${stamp}.sql`);
const encryptedPath = `${sqlPath}.enc`;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error(`${command} 执行失败`);
}

try {
  run('npx', ['wrangler', 'd1', 'export', 'yupao-ledger-db', '--remote', `--output=${sqlPath}`]);
  const plaintext = await readFile(sqlPath);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([Buffer.from('YUPAO1'), salt, iv, tag, ciphertext]);
  await writeFile(encryptedPath, payload, { mode: 0o600 });
  const objectKey = `d1/${path.basename(encryptedPath)}`;
  run('npx', ['wrangler', 'r2', 'object', 'put', `${bucket}/${objectKey}`, `--file=${encryptedPath}`, '--content-type=application/octet-stream']);
  console.log(`加密备份已上传：${bucket}/${objectKey}`);
} finally {
  await rm(sqlPath, { force: true });
  await rm(encryptedPath, { force: true });
}
