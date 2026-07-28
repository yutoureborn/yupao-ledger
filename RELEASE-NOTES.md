# 版本说明

## 0.2.1 — Workers Free 认证修复

- 修复首次创建账号时浏览器提示“获取失败”的问题。
- 将 PBKDF2 密码派生移动到浏览器，避免 Worker 超过免费计划 10ms CPU 限额。
- 原始密码不再发送到 Worker。
- 新增 `/api/auth/password-params`。
- 登录、修改密码、恢复密码和恢复码重生成均改用客户端密码凭据。
- 不需要新增 D1 migration。
- 15 项自动化测试全部通过。

# Release Notes

## 0.2.0 — 内置双账号认证

- 移除 Cloudflare Access JWT 依赖。
- 新增芋炮风格登录页、首次初始化页和恢复密码页。
- 新增 PBKDF2 密码哈希、服务端 Pepper、HttpOnly Session Cookie。
- 新增 CSRF 防护、登录限流、设备会话撤销和单次恢复码。
- 新增 `migrations/0002_internal_auth.sql`。
- 设置页增加修改密码、重新生成恢复码、退出其他设备和退出登录。
- 更新 GitHub 网页上传 + Workers Builds 部署流程。
- 保留原有账户、账目、预算、图表、PWA 和 D1 数据模型。
