# v0.3.0 升级说明

## 数据影响

- 无新 D1 migration。
- 不修改账号、密码、账目、预算和发票数据。
- 不修改 `wrangler.jsonc` 和 Cloudflare Secrets。

## 上传

1. 解压升级补丁。
2. 在 GitHub 仓库使用 `Add file → Upload files`。
3. 上传补丁内部全部内容并覆盖同名文件。
4. 提交到 `main`。
5. 等待 Workers Builds 完成。

## 部署后

- 浏览器执行 `Ctrl + Shift + R`。
- 已安装 PWA 时完全关闭后重开。
- 若仍显示旧版，只清除该站点缓存。
