# 芋炮小账本

> 两个人的小日子，都记在这里。

芋炮小账本是一套面向两名固定家庭成员的动态在线记账 PWA。项目包含真实的云端数据读写、账户余额、预算、图表、动态交互、软删除恢复、数据导出和 Cloudflare Access 身份保护，不是静态展示页面。

## 已完成

- 双人家庭空间与成员身份映射
- 支出、收入、转账的新增、编辑、软删除和撤销
- 账户管理与动态余额计算
- 收支分类管理
- 月度总预算和分类预算
- 首页月度概览、最近账目和预算进度
- 收支趋势、分类占比、近六个月对比图表
- 桌面端、平板和移动端响应式布局
- 芋头与小炮台 SVG 角色动画
- 页面转场、数字动画、图表动画和操作反馈
- `prefers-reduced-motion` 与手动减少动画设置
- PWA 安装、静态应用壳缓存和离线提示
- CSV、JSON 数据导出
- Cloudflare Access JWT 签名验证
- D1 家庭数据隔离、审计日志和并发版本冲突检测
- 本地 SQLite 开发服务器与自动化 API 测试
- D1 加密备份与显式确认恢复工具

## 技术结构

```text
浏览器 / PWA
  ↓
Cloudflare Access
  ↓
Cloudflare Worker + Static Assets
  ├── TypeScript JSX 前端
  ├── Worker REST API
  └── Cloudflare D1
```

前端源码使用 React 风格的 TypeScript JSX 与类组件结构。为保证交付包可以在没有 npm 依赖和第三方 CDN 的情况下直接运行，浏览器运行时使用仓库内置的 Preact 兼容层。页面不会从外部 CDN 加载脚本，也不会把账本数据写入第三方服务。

## 目录

```text
yupao-ledger/
├─ src/frontend/          前端 TypeScript JSX
├─ src/worker/            Cloudflare Worker API
├─ migrations/            D1 数据库迁移
├─ public/                PWA、样式、图标和前端运行时
├─ scripts/               构建、本地服务与备份工具
├─ tests/                 API 自动化测试
├─ docs/                  部署、架构、API 和交付状态文档
├─ build/                 已编译 Worker 与前端代码
└─ dist/                  可直接部署的静态资源
```

## 本地预览

要求：Node.js 22 或更高版本，以及 TypeScript 命令行工具。

```bash
npm run dev
```

打开：

```text
http://localhost:4173
```

本地开发数据库存放在：

```text
.local/yupao.db
```

首次启动会写入一组仅用于本地预览的示例数据。需要空账本时：

```bash
rm -rf .local
npm run dev:empty
```

本地切换第二名成员：

```bash
DEV_USER_EMAIL=dev2@yupao.local npm run dev
```

## 构建

```bash
npm run build
```

构建结果：

- `dist/`：前端静态资源
- `build/worker/index.js`：Worker 入口

仓库已经包含构建产物，因此手动部署前不修改源码时，可以直接使用现有 `dist/` 和 `build/`。

## 测试

```bash
npm test
```

测试覆盖：

- 家庭空间、默认账户和分类初始化
- 交易新增、修改、版本冲突、删除和恢复
- 转账不计入收入与支出
- 转账后的账户余额
- 第二名用户自动加入家庭空间

## Cloudflare 部署

当前推荐方式：**GitHub 网页上传 + Cloudflare Workers Builds 自动部署**。

无需安装 GitHub Desktop，也无需日常使用本机命令行。详细步骤：

- [`docs/GITHUB-WEB-WORKERS-BUILDS.md`](docs/GITHUB-WEB-WORKERS-BUILDS.md)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

正式环境使用 Cloudflare 免费 `*.workers.dev` 地址。


## 安全边界

- 前端不会直接连接数据库。
- Worker 不信任前端传入的用户 ID 或家庭 ID。
- 正式环境必须关闭 `AUTH_BYPASS`。
- 正式环境必须使用 Cloudflare Access 保护整个站点。
- 财务 API 响应使用 `Cache-Control: no-store`。
- Service Worker 只缓存应用资源，不缓存账本 API。
- 金额在数据库内按整数“分”存储。
- 删除账目采用软删除，并记录审计日志。

## 第三方许可

见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
