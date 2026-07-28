# 系统架构

## 请求链路

```text
浏览器 / PWA
  → workers.dev HTTPS
  → Worker Static Assets 或 /api/*
  → 内置 Session 认证
  → household_members 权限映射
  → D1
```

## 认证模型

### 密码

- 每名用户独立随机盐值。
- Web Crypto PBKDF2-SHA256。
- 默认 120,000 次迭代。
- `PASSWORD_PEPPER` 作为 Cloudflare Secret，不进入数据库或 GitHub。
- D1 只保存派生哈希、盐值和迭代次数。

### 会话

登录成功后生成 256 位随机令牌。浏览器只收到：

```text
__Host-yupao_session
HttpOnly
Secure
SameSite=Strict
Path=/
```

D1 只保存令牌的 Pepper 哈希、用户、过期时间、CSRF Token 和设备摘要。

### CSRF

所有写入请求需要：

- 同源请求
- 有效 Session Cookie
- `X-CSRF-Token`

登录、恢复和首次初始化接口不依赖现有会话，但分别受初始化密钥、恢复码和登录限流保护。

### 登录限流

15 分钟窗口内：

- 同一邮箱失败 5 次后临时拒绝
- 同一 IP 失败 20 次后临时拒绝

IP 进入 D1 前先使用 Pepper 哈希，不保存明文 IP。

## 首次初始化

只有 `auth_credentials` 少于两个账号时，`/api/auth/setup` 才开放。请求必须提供 Cloudflare Secret `SETUP_TOKEN`。初始化一次创建：

- 一个 Owner
- 一个 Member
- 家庭空间
- 两套密码凭据
- 每人 8 个单次恢复码
- 默认账户和分类

初始化完成后接口永久返回 `SETUP_COMPLETE`，除非管理员直接清理认证数据表。

## 权限模型

业务请求根据 Session 取得内部 `user_id`，再通过 `household_members` 得到 `household_id`。前端提交的任何用户或家庭标识都不可信。

## 数据表

基础业务表：

- users
- households
- household_members
- accounts
- categories
- transactions
- budgets
- audit_logs

认证表：

- auth_credentials
- auth_sessions
- login_attempts
- recovery_codes
