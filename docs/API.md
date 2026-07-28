# API 简表

所有接口除 `/api/health` 外都要求通过身份验证。

统一成功响应：

```json
{ "ok": true, "data": {} }
```

统一错误响应：

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "金额格式不正确",
    "details": null
  }
}
```

## 初始化

```text
GET /api/me
GET /api/bootstrap?month=YYYY-MM
```

## 交易

```text
GET    /api/transactions
POST   /api/transactions
GET    /api/transactions/:id
PATCH  /api/transactions/:id
DELETE /api/transactions/:id
POST   /api/transactions/:id/restore
```

交易提交示例：

```json
{
  "type": "expense",
  "amountCents": 12800,
  "accountId": "account-id",
  "categoryId": "category-id",
  "occurredAt": "2026-07-28",
  "merchant": "超市",
  "note": "日用品"
}
```

转账提交示例：

```json
{
  "type": "transfer",
  "amountCents": 50000,
  "accountId": "source-account",
  "targetAccountId": "target-account",
  "occurredAt": "2026-07-28",
  "note": "转入生活费"
}
```

## 账户

```text
GET    /api/accounts
POST   /api/accounts
PATCH  /api/accounts/:id
DELETE /api/accounts/:id
```

删除账户表示归档，不会删除历史交易。

## 分类

```text
GET    /api/categories
POST   /api/categories
PATCH  /api/categories/:id
DELETE /api/categories/:id
```

删除分类表示归档。

## 预算

```text
GET    /api/budgets?period=YYYY-MM
POST   /api/budgets
DELETE /api/budgets/:id
```

`categoryId: null` 表示月度总预算。

## 统计

```text
GET /api/stats/overview?month=YYYY-MM
GET /api/stats/trend?month=YYYY-MM
GET /api/stats/category-breakdown?month=YYYY-MM
GET /api/stats/month-comparison?month=YYYY-MM
GET /api/stats/budget-progress?month=YYYY-MM
```

## 导出

```text
GET /api/export/csv
GET /api/export/json
```
