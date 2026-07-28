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
