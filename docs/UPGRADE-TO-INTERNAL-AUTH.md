# 从方案 A 切换到方案 B

> 适用情况：`yupao-ledger` Worker 已经部署成功，D1 绑定正常，但不再使用 Cloudflare Zero Trust / Access。

## 升级结果

升级后访问流程：

```text
workers.dev
→ 芋炮小账本登录页
→ 邮箱 + 密码
→ HttpOnly Session Cookie
→ Worker API + D1
```

原有账目、账户、预算和图表数据不会被清空。

---

## 第 1 步：执行认证表迁移

进入 Cloudflare：

```text
Storage & databases
→ D1
→ yupao-ledger-db
→ Console
```

在 GitHub 打开：

```text
migrations/0002_internal_auth.sql
```

复制全部内容到 D1 Console 执行。

验证：

```sql
SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name IN ('auth_credentials','auth_sessions','login_attempts','recovery_codes')
ORDER BY name;
```

应返回四张表。

---

## 第 2 步：创建两个 Worker Secret

进入：

```text
Workers & Pages
→ yupao-ledger
→ Settings
→ Variables and Secrets
```

### `PASSWORD_PEPPER`

类型选择 **Secret**。

要求：

- 使用密码管理器生成至少 32 位随机字符串
- 不要使用登录密码
- 不要写入 GitHub
- 必须在密码管理器中长期保存
- 初始化后不能随意修改或删除

修改 Pepper 会导致现有密码、恢复码和会话全部失效。

### `SETUP_TOKEN`

类型选择 **Secret**。

要求：

- 至少 24 位随机字符串
- 只用于首次初始化
- 和登录密码不同
- 初始化完成后可以删除

保存变量后，Cloudflare 可能生成一次新部署，这是正常现象。

---

## 第 3 步：修改现有 `wrangler.jsonc`

**不要把真实 D1 Database ID 改回占位符。**

保留当前：

```jsonc
"database_id": "你已经配置成功的真实 UUID"
```

删除旧 Access 变量：

```text
ACCESS_TEAM_DOMAIN
ALLOWED_EMAILS
ACCESS_AUD
```

`vars` 改为：

```jsonc
"vars": {
  "HOUSEHOLD_NAME": "芋炮之家",
  "AUTH_BYPASS": "false",
  "PASSWORD_ITERATIONS": "120000"
}
```

`PASSWORD_PEPPER` 和 `SETUP_TOKEN` 不写进文件，它们已经在 Cloudflare Dashboard 里作为 Secret 保存。

---

## 第 4 步：上传 0.2.1 代码

通过 GitHub 网页上传升级补丁中的文件和文件夹。

建议上传：

```text
src/
public/
scripts/
tests/
migrations/0002_internal_auth.sql
docs/
package.json
README.md
RELEASE-NOTES.md
TODO.md
.dev.vars.example
```

`wrangler.jsonc` 建议在 GitHub 网页中手动编辑，避免覆盖真实 Database ID。

提交到 `main` 后，Workers Builds 自动执行：

```text
npm test
→ npx wrangler deploy
```

---

## 第 5 步：确认不启用 Cloudflare Access

进入 Worker 的 Domains 页面。

账本地址应直接打开芋炮登录页，而不是 Cloudflare Access 邮箱验证码页。

如果之前已经启用 Access，需要先停用对应 Access 保护；否则会出现两层登录。

---

## 第 6 步：首次初始化

打开：

```text
https://yupao-ledger.<你的账户子域>.workers.dev
```

首次会显示“创建你们的两个账号”。填写：

- 家庭名称
- 管理员昵称、邮箱和密码
- 家庭成员昵称、邮箱和密码
- `SETUP_TOKEN`

密码要求：

- 12～128 个字符
- 至少包含字母和数字
- 不包含自己的邮箱名称
- 两个账号不要使用相同密码

提交成功后会显示两组恢复码。

---

## 第 7 步：保存恢复码

每个账号有 8 个恢复码，每个只能使用一次。

必须：

- 下载恢复码文本
- 两名成员分别保存自己的恢复码
- 存入密码管理器或离线加密存储
- 不把恢复码发到聊天群或邮件草稿

恢复码是当前版本唯一的忘记密码恢复方式。

---

## 第 8 步：删除初始化密钥

确认两个账号都能登录后，可在 Worker Secrets 中删除：

```text
SETUP_TOKEN
```

必须继续保留：

```text
PASSWORD_PEPPER
```

---

## 第 9 步：验收

- [ ] 未登录只能看到登录页
- [ ] 两个账号都能登录
- [ ] 错误密码不能登录
- [ ] 一方新增账目后另一方可见
- [ ] 转账不进入收入和支出统计
- [ ] 修改密码后其他设备退出
- [ ] 恢复码可以重设密码且只能使用一次
- [ ] 设置页可以退出当前账号
- [ ] PWA 重新打开后仍需有效会话

---

## 重要安全说明

### `PASSWORD_PEPPER` 丢失

不要删除或更换 Pepper。它不在 D1 中，丢失后现有密码和恢复码无法正常校验。

### 恢复码丢失

登录状态仍有效时，可在“设置 → 账号与安全”中输入当前密码重新生成恢复码。

### 两人都忘记密码且没有恢复码

需要管理员直接操作 D1 和重新部署新的初始化流程。这不属于普通用户自助恢复范围。
