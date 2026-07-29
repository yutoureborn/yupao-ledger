# Release Notes

## v0.2.3 — 安全回归与跨端界面优化

### 安全

- 正式 `workers.dev` 环境不再允许 `AUTH_BYPASS` 误配置绕过登录。
- 公开认证接口增加 Origin / Fetch Metadata 同源校验。
- JSON 请求体增加 32 KiB 上限。
- 修改密码后撤销旧会话并轮换当前 Cookie 与 CSRF Token。
- Setup Token 失败尝试纳入限流。
- 恢复码重生成改为 D1 batch。
- 修复异常 Cookie 解码导致 500 的边界情况。
- HTML、Service Worker 和 Manifest 改为重新验证；财务 API 继续 `no-store`。
- 新增 CORP 等安全响应头。

### UI / UX

- 重构“钱花去了哪里”圆环图和分类排行。
- 分类名称、占比和金额使用稳定列布局，不再互相挤压。
- 卡片使用 Container Query 适配 PC、窄栏与手机。
- 芋头增加挥手、抱账本和安全盾牌动作。
- 玩具炮台增加机械臂、观察动作、金币和星光反馈。
- 保留 `prefers-reduced-motion` 降级。

### 测试

- 27 项自动化测试全部通过。
- 无新增 D1 migration。
- 不修改正式 D1 Database ID、PASSWORD_PEPPER 或账号数据。

## v0.2.2

- 修复旧 Service Worker 持续提供旧初始化页面的问题。
- 核心前端资源增加版本参数。
- 页面导航与静态资源改为网络优先，离线时回退缓存。
- Worker 能识别旧初始化请求并返回明确刷新提示。
- 修复浏览器 Web Crypto 的 Uint8Array 类型兼容。

## v0.2.1

- 将 PBKDF2 密码派生移动到浏览器，避免 Worker 免费 CPU 超限。
- 原始密码不发送到 Worker。
- 登录、改密、恢复密码和恢复码重生成使用客户端密码凭据。

## v0.2.0

- 移除 Cloudflare Access 依赖。
- 新增内置双账号认证、Session、CSRF、恢复码和登录限流。
