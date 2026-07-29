# 芋炮小账本 v0.2.7 升级说明

> 升级内容：奶油手账 UI + 发票记录与收支关联。  
> 适用来源版本：v0.2.6。  
> 本版本有数据库迁移，必须先迁移 D1，再上传代码。

## 1. 备份

升级前建议在 Cloudflare D1 页面导出一次数据库，或使用项目备份脚本生成加密备份。

## 2. 执行数据库迁移

进入：

```text
Cloudflare Dashboard
→ Storage & databases
→ D1
→ yupao-ledger-db
→ Console
```

打开补丁中的：

```text
migrations/0003_invoices.sql
```

复制全部 SQL 到 Console 执行。

然后验证：

```sql
SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name = 'invoices';
```

应返回：

```text
invoices
```

再检查索引：

```sql
SELECT name
FROM sqlite_master
WHERE type = 'index'
  AND tbl_name = 'invoices'
ORDER BY name;
```

应至少看到：

- `idx_invoices_household_date`
- `idx_invoices_household_type`
- `idx_invoices_transaction`
- `idx_invoices_number_type`

迁移使用 `IF NOT EXISTS`，误执行第二次不会重复建表。

## 3. 上传补丁

解压：

```text
yupao-ledger-v0.2.7-invoice-journal-patch.zip
```

在 GitHub 仓库中：

```text
Add file
→ Upload files
```

上传解压目录内部的全部文件，覆盖同名文件，并提交到 `main`。

建议提交说明：

```text
Journal UI and invoice records v0.2.7
```

补丁不包含 `wrangler.jsonc`，不会覆盖正式 D1 Database ID。

## 4. 检查 Workers Builds

预期：

```text
yupao-ledger@0.2.7
31 tests
31 pass
0 fail
Deploying ✓
```

## 5. 刷新

部署成功后：

- Windows：`Ctrl + Shift + R`
- PWA：完全关闭后重新打开
- 仍显示旧页面：只清除该站点缓存，不删除账号或 D1 数据

## 6. 验收

1. 打开发票夹。
2. 新增一张收到的发票并关联支出。
3. 新增一张开出的发票并关联收入。
4. 尝试错误类型关联，应被拒绝。
5. 编辑发票并修改关联。
6. 作废并恢复发票。
7. 返回交易列表，确认显示发票数量。
8. 检查首页发票月度摘要。

## 7. 不需要修改

- `PASSWORD_PEPPER`
- 账号密码与恢复码
- `SETUP_TOKEN`（已初始化后仍应保持删除）
- D1 Database ID
- 原有交易、账户、分类和预算
