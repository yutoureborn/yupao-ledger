# API 概览

所有响应：

```json
{ "ok": true, "data": {} }
```

错误：

```json
{ "ok": false, "error": { "code": "...", "message": "...", "details": null } }
```

## 无会话接口

```text
GET  /api/health
GET  /api/auth/setup-status
POST /api/auth/setup
POST /api/auth/password-params
POST /api/auth/login
POST /api/auth/recover
GET  /api/auth/session
```

## 认证接口

```text
POST /api/auth/logout
POST /api/auth/change-password
POST /api/auth/revoke-other-sessions
POST /api/auth/recovery-codes
```

除 GET、HEAD、OPTIONS 外，已登录接口必须发送 `X-CSRF-Token`。

## 业务接口

```text
GET    /api/bootstrap
GET    /api/transactions
POST   /api/transactions
GET    /api/transactions/:id
PATCH  /api/transactions/:id
DELETE /api/transactions/:id
POST   /api/transactions/:id/restore

GET/POST/PATCH/DELETE /api/accounts
GET/POST/PATCH/DELETE /api/categories
GET/POST/PATCH/DELETE /api/budgets

GET    /api/invoices
POST   /api/invoices
GET    /api/invoices/:id
PATCH  /api/invoices/:id
DELETE /api/invoices/:id
POST   /api/invoices/:id/restore
GET    /api/invoices/summary

GET /api/stats/overview
GET /api/stats/trend
GET /api/stats/category-breakdown
GET /api/stats/month-comparison
GET /api/stats/budget-progress

GET /api/export/csv
GET /api/export/json
```

## 典型认证错误

| Code | 含义 |
|---|---|
| `AUTH_REQUIRED` | 未登录或会话失效 |
| `AUTH_NOT_CONFIGURED` | Pepper 或初始化密钥未配置 |
| `SETUP_REQUIRED` | 尚未创建两个账号 |
| `SETUP_COMPLETE` | 已完成初始化，禁止再次执行 |
| `LOGIN_FAILED` | 邮箱或密码错误 |
| `LOGIN_LOCKED` | 尝试次数过多 |
| `CSRF_INVALID` | 页面验证已失效 |
| `RECOVERY_FAILED` | 邮箱或恢复码错误 |


## 密码凭据流程（0.2.1）

1. 浏览器调用 `POST /api/auth/password-params` 获取盐值和 PBKDF2 迭代次数。
2. 浏览器本地执行 PBKDF2-SHA256。
3. 浏览器只把 32 字节密码凭据发送给 Worker，不发送原始密码。
4. Worker 使用 `PASSWORD_PEPPER` 对凭据二次处理后与 D1 中的验证值比较。

首次初始化由浏览器生成独立盐值。该调整不改变 `auth_credentials` 表结构。


## 发票关联规则

- `type=received`：仅可关联 `type=expense` 的交易。
- `type=issued`：仅可关联 `type=income` 的交易。
- 发票可以暂不关联，之后通过 PATCH 补充。
- 同一笔收支可以关联多张发票。
- 作废发票不会删除被关联的收支记录。
- 所有查询和写入都按当前会话的 `household_id` 隔离。
