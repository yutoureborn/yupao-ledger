# 修复首次创建账号时“获取失败”

适用版本：从 0.2.0 升级到 0.2.1。

## 原因

0.2.0 在 Cloudflare Worker 内执行两次 PBKDF2 密码派生。Workers Free 每次 HTTP 请求只有较低的 CPU 时间额度，初始化请求可能被平台中止，浏览器因此显示“获取失败”。登录、修改密码和恢复密码也可能受到相同影响。

0.2.1 将 PBKDF2 移到浏览器执行。原始密码不再发送到 Worker；Worker 只保存结合 `PASSWORD_PEPPER` 二次处理后的验证值。

## 是否需要修改数据库

不需要新增 migration，也不要重复执行 `0002_internal_auth.sql`。

升级前先在 D1 Console 查询：

```sql
SELECT COUNT(*) AS count FROM auth_credentials;
```

- 返回 `0`：直接升级后重新创建账号。
- 返回 `1` 或 `2`，并且你还没有正式使用小账本：先执行下面的认证重置 SQL，再升级后重新创建账号。

```sql
DELETE FROM auth_sessions;
DELETE FROM recovery_codes;
DELETE FROM login_attempts;
DELETE FROM auth_credentials;
```

上述 SQL 不删除账目、账户、分类或预算。

## GitHub 网页升级

1. 解压 `yupao-ledger-v0.2.1-fix-patch.zip`。
2. 在 GitHub 仓库根目录选择 **Add file → Upload files**。
3. 把补丁中的全部内容拖入，覆盖同名文件。
4. 不要修改或覆盖现有 `wrangler.jsonc`，其中保存了正确的 D1 Database ID。
5. 提交到 `main`，等待 Workers Builds 自动完成。
6. 构建应显示 16 项测试通过并成功 Deploy。
7. 打开账本地址后执行一次强制刷新；PWA 用户应关闭并重新打开应用。
8. 再次填写初始化页面。

## 升级后验证

打开 Cloudflare：

```text
Workers & Pages → yupao-ledger → Logs → Live
```

重新提交初始化时，`POST /api/auth/setup` 应返回 `201`，不应出现 `exceededResources` 或错误 1102。
