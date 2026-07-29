# 芋炮小账本 v0.2.5 角色与图表升级补丁

本补丁适用于已部署 v0.2.4 的项目。

- 上传补丁目录内部全部内容到 GitHub 仓库根目录并覆盖同名文件。
- 不需要执行 D1 migration。
- 不修改 `wrangler.jsonc`、Database ID、`PASSWORD_PEPPER` 或账号数据。
- Workers Builds 应执行 `npm test`，通过 27 项测试后自动部署。
- 详细步骤见 `docs/UPGRADE-v0.2.5.md`。
