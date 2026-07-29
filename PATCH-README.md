# v0.2.7 升级补丁

1. 先在正式 D1 Console 执行 `migrations/0003_invoices.sql`。
2. 再把本目录内部的全部内容上传到 GitHub 仓库根目录并覆盖同名文件。
3. 本补丁不包含 `wrangler.jsonc`，不会覆盖正式 D1 Database ID。
4. 等待 Workers Builds 显示 31 项测试全部通过后再刷新应用。

完整步骤见 `docs/UPGRADE-v0.2.7.md`。
