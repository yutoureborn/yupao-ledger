import { createDecipheriv, scryptSync } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const encryptedArg = args.find((arg) => !arg.startsWith('--'));
const shouldApply = args.includes('--apply');
const passphrase = process.env.BACKUP_PASSPHRASE;

if (!encryptedArg) {
  console.error('用法：BACKUP_PASSPHRASE=... npm run restore:backup -- ./backup.sql.enc [--apply]');
  process.exit(1);
}

if (!passphrase || passphrase.length < 20) {
  console.error('BACKUP_PASSPHRASE 至少需要 20 个字符。');
  process.exit(1);
}

const sourcePath = resolve(encryptedArg);
const payload = await readFile(sourcePath);
const magic = payload.subarray(0, 6).toString('utf8');

if (magic !== 'YUPAO1' || payload.length < 50) {
  console.error('不支持或已损坏的备份格式。');
  process.exit(1);
}

const salt = payload.subarray(6, 22);
const iv = payload.subarray(22, 34);
const tag = payload.subarray(34, 50);
const encrypted = payload.subarray(50);
const key = scryptSync(passphrase, salt, 32);
const decipher = createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(tag);

let plain;
try {
  plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
} catch {
  console.error('解密失败：密码错误或备份文件已损坏。');
  process.exit(1);
}

await mkdir('.backup/restore', { recursive: true });
const outputPath = resolve('.backup/restore', basename(sourcePath).replace(/\.enc$/i, '') || 'restore.sql');
await writeFile(outputPath, plain, { mode: 0o600 });
console.log(`已解密到：${outputPath}`);

if (!shouldApply) {
  console.log('尚未写入数据库。请先检查 SQL；确认后添加 --apply。');
  process.exit(0);
}

if (process.env.CONFIRM_RESTORE !== 'YES') {
  console.error('远程恢复会写入正式数据库。请额外设置 CONFIRM_RESTORE=YES。');
  process.exit(1);
}

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  executable,
  ['wrangler', 'd1', 'execute', 'yupao-ledger-db', '--remote', `--file=${outputPath}`],
  { stdio: 'inherit' },
);

if (result.status !== 0) {
  console.error('Wrangler 恢复执行失败，已保留解密后的 SQL 供检查。');
  process.exit(result.status ?? 1);
}

await rm(outputPath, { force: true });
console.log('远程恢复执行完成，临时明文 SQL 已删除。');
