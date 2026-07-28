# 芋炮小账本

> 两个人的小日子，都记在这里。

芋炮小账本是一套面向两名固定家庭成员的动态在线记账 PWA。项目使用 Cloudflare Worker、Static Assets 和 D1，在免费 `workers.dev` 地址上运行。版本 0.2.0 已改为**项目内双账号认证**，不再依赖 Cloudflare Zero Trust 或 Cloudflare Access。

## 已完成

- 两个固定邮箱账号：Owner 与 Member
- 首次网页初始化，不开放注册入口
- PBKDF2-SHA256 密码哈希、独立盐值与服务端 Pepper
- HttpOnly、Secure、SameSite=Strict 会话 Cookie
- CSRF 防护、登录失败限流、设备会话撤销
- 单次恢复码与密码重设
- 支出、收入、转账的新增、编辑、软删除和恢复
- 账户余额、分类、预算和可视化图表
- 手机、平板和桌面响应式布局
- 芋头与小炮台动态角色、页面转场和图表动画
- PWA 安装与离线应用外壳
- CSV、JSON 导出
- D1 审计日志、版本冲突检测和加密备份脚本

## 架构

```text
浏览器 / PWA
  ↓ HTTPS
芋炮登录页
  ↓ HttpOnly Session Cookie + CSRF
Cloudflare Worker API
  ├── D1：用户、认证、账本和审计数据
  └── Static Assets：前端与 PWA
```

不再需要：

- Cloudflare Zero Trust Team
- Cloudflare Access Application
- `ACCESS_TEAM_DOMAIN`
- `ACCESS_AUD`
- `ALLOWED_EMAILS`
- 支付身份信息

## 关键文件

```text
src/frontend/app.tsx               前端、登录与首次初始化界面
src/worker/index.ts                Worker API 与认证逻辑
migrations/0001_init.sql           账本基础表
migrations/0002_internal_auth.sql  内置认证表
docs/UPGRADE-TO-INTERNAL-AUTH.md   从 0.1.x 升级到方案 B
docs/GITHUB-WEB-WORKERS-BUILDS.md GitHub 网页部署说明
```

## 本地预览

```bash
npm install
npm run dev
```

默认本地模式绕过登录，方便开发业务页面。

查看真实的初始化和登录流程：

```bash
rm -rf .local
npm run dev:auth
```

本地初始化密钥和 Pepper 仅用于开发，配置在 `scripts/local-server.mjs`，不得复制到正式环境。

## 构建与测试

```bash
npm test
```

测试覆盖业务交易、转账统计、首次双账号初始化、登录会话、CSRF、恢复码、PWA 缓存边界和部署配置。

## 正式环境必须配置

在 Cloudflare Worker 的 **Settings → Variables and Secrets** 中创建：

- `PASSWORD_PEPPER`：至少 32 位随机字符串，必须长期保存且不能更换
- `SETUP_TOKEN`：至少 24 位随机字符串，仅用于首次初始化；初始化完成后可以删除

`wrangler.jsonc` 必须保持：

```jsonc
"AUTH_BYPASS": "false"
```

已有 D1 数据库还需要执行：

```text
migrations/0002_internal_auth.sql
```

详细步骤见 [升级说明](docs/UPGRADE-TO-INTERNAL-AUTH.md)。

## 安全边界

- 密码、恢复码和会话令牌都不以明文写入 D1。
- `PASSWORD_PEPPER` 只保存在 Cloudflare Secret 中。
- 前端不能指定用户 ID 或家庭 ID。
- 财务 API 使用 `Cache-Control: no-store`。
- Service Worker 不缓存账本 API。
- 连续登录失败会临时锁定。
- 无邮件找回密码功能；必须妥善保存恢复码。

## 第三方许可

见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
