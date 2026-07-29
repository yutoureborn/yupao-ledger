# v0.2.3 补丁上传

1. 解压本补丁。
2. GitHub 仓库点击 `Add file → Upload files`。
3. 上传本目录里面的全部内容，覆盖同名文件。
4. 提交到 `main`，提交说明：`Security regression and responsive UI v0.2.3`。
5. 不要删除或覆盖仓库现有的 `wrangler.jsonc`；它保存了你的真实 D1 Database ID。
6. Cloudflare Workers Builds 日志应显示 27 项测试全部通过。

本版本不需要执行新的 D1 migration。
