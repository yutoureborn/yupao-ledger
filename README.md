# 芋炮小账本

> 两个人的小日子，都记在这里。

芋炮小账本是一套面向两名固定家庭成员的动态在线记账 PWA。项目使用 Cloudflare Worker、Static Assets 和 D1，在免费 `workers.dev` 地址上运行。版本 0.2.5 使用**项目内双账号认证**，不再依赖 Cloudflare Zero Trust 或 Cloudflare Access。

## 已完成

- 两个固定邮箱账号：Owner 与 Member
- 首次网页初始化，不开放注册入口
- 浏览器端 PBKDF2-SHA256、独立盐值与服务端 Pepper 验证值
- HttpOnly、Secure、SameSite=Strict 会话 Cookie
- CSRF 防护、登录失败限流、设备会话撤销
- 单次恢复码与密码重设
- 支出、收入、转账的新增、编辑、软删除和恢复
- 账户余额、分类、预算和可视化图表
- 手机、平板和桌面响应式布局
- 芋泥紫芋头与绿黑炮台动态角色、页面转场和图表动画
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

测试覆盖业务交易、转账统计、首次双账号初始化、浏览器端密码派生、登录会话、CSRF、恢复码、PWA 缓存边界和部署配置。

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

- 原始密码不发送到 Worker，也不写入 D1；D1 只保存经浏览器 PBKDF2 和服务端 Pepper 二次处理后的验证值。
- `PASSWORD_PEPPER` 只保存在 Cloudflare Secret 中。
- 前端不能指定用户 ID 或家庭 ID。
- 财务 API 使用 `Cache-Control: no-store`。
- Service Worker 不缓存账本 API。
- 连续登录失败会临时锁定。
- 无邮件找回密码功能；必须妥善保存恢复码。

## 第三方许可

见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。


## 0.2.3 安全与界面回归

v0.2.3 收紧生产认证绕过、同源检查、请求体、Session 轮换、缓存和恢复码写入，并重构 PC / 移动端支出分类卡片。芋头和玩具炮台增加挥手、抱账本、金币反馈和安全盾牌等拟人动作。现有 D1 表结构不需要迁移。详细结果见 `docs/SECURITY-REGRESSION-v0.2.3.md` 和 `docs/UI-UX-OPTIMIZATION-v0.2.3.md`。


## 0.2.4 角色关系与视觉升级

v0.2.4 将两个角色的职责正式互换：

- **芋头**改为元气记账小助手，负责快速记账、空状态引导和保存成功反馈。
- **炮台**改为生活账本小管家，负责统计投影、预算提醒、整理反馈和安全守护。
- 芋头使用更明显的芋泥紫；炮台使用墨绿、苔绿和黑灰结构件。
- 记账页新增芋头操作提示，统计页新增炮台整理提示。
- PWA 图标、站点图标、SVG 角色和动画状态同步升级。

本版本不修改 D1 表结构，不需要执行数据库 migration。完整角色规范见 `docs/MASCOT-DESIGN-v0.2.4.md`。


## 0.2.5 角色重绘与图表修复

- 芋头与炮台按拟人蔬菜插画方向重新绘制，不再使用简单几何形。
- 芋头保持明显芋泥紫，负责快速记账；炮台保持绿黑玩具机械色，负责整理和统计。
- 首页支出分类卡片改为“圆环 + 分类排行”完整结构，PC 侧栏和移动端均不会只剩圆环。
- 本版本不修改 D1 表结构。升级步骤见 `docs/UPGRADE-v0.2.5.md`。
