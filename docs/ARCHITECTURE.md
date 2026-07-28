# 架构说明

## 请求链路

```text
浏览器
  → Cloudflare Access
  → Worker
  → 身份 JWT 验证
  → 允许邮箱检查
  → 家庭成员上下文
  → 参数校验
  → D1 参数化 SQL
  → JSON 响应
```

## 数据隔离

每张业务表都包含 `household_id`。前端不能自行指定有效家庭上下文，Worker 会根据当前 Access 邮箱查找成员关系，并把服务端确定的 `household_id` 加入所有查询。

## 身份验证

正式环境读取请求头：

```text
Cf-Access-Jwt-Assertion
```

Worker 会：

1. 读取 JWT Header 与 Payload。
2. 从 Access 团队域名获取 JWKS。
3. 使用 Web Crypto 验证 RS256 签名。
4. 检查 `exp`、`nbf`、`aud` 和 `iss`。
5. 读取经过验证的邮箱。
6. 再检查 `ALLOWED_EMAILS`。

Access 是入口保护，Worker JWT 验证是应用层第二道保护。

## 金额

所有金额使用整数分：

```text
¥12.34 → 1234
```

避免 JavaScript 与 SQLite 浮点数造成金额误差。

## 账户余额

账户余额不直接保存为可修改字段，而是动态计算：

```text
期初余额
+ 收入
- 支出
- 转出
+ 转入
```

## 并发修改

交易包含 `version` 字段。更新时必须提交当前版本：

```sql
UPDATE transactions
SET ..., version = version + 1
WHERE id = ? AND version = ?
```

另一台设备已经修改时，接口返回 `409 VERSION_CONFLICT`，防止静默覆盖。

## 删除

交易删除使用 `deleted_at` 软删除。默认查询和统计只读取 `deleted_at IS NULL` 的记录。恢复接口会清空 `deleted_at`。

## 前端运行时

- TypeScript JSX 源码
- Preact React-compatible runtime
- Hash Router
- CSS 与 SVG 动画
- 原生 Fetch API
- 原生 SVG 数据图表

没有第三方运行时网络请求。

## PWA 缓存

Service Worker 缓存：

- HTML
- CSS
- 前端 JavaScript
- Preact 运行时
- 图标

Service Worker 不拦截 `/api/*`，财务数据不会写入 Cache Storage。
