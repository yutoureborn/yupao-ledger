# 芋炮小账本 v0.1.2

## 部署流程更新

- 默认推荐 GitHub 网页上传项目源码。
- 使用 Cloudflare Workers Builds 连接私有 GitHub 仓库。
- `main` 分支提交后自动构建、测试和发布。
- 新增 `.nvmrc`，固定 Workers Builds 使用 Node.js 22。
- 新增 `docs/GITHUB-WEB-WORKERS-BUILDS.md` 完整部署指引。
- 不需要 GitHub Desktop、自定义域名或日常本机命令行操作。

## 应用代码

本版本未修改账本业务逻辑。动态记账、双人家庭空间、图表、PWA、Access 验证、D1 数据库及备份工具保持不变。
