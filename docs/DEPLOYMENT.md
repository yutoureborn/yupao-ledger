# 芋炮小账本手动部署说明

本文档只描述部署步骤。项目源码、数据库迁移和构建产物已经准备完成。

## 1. 前置条件

需要：

- 一个 Cloudflare 账号
- 一个已经接入 Cloudflare 的域名
- Node.js 22 或更高版本
- Wrangler CLI
- 两个允许访问的邮箱

安装 Wrangler：

```bash
npm install -D wrangler typescript
```

登录 Cloudflare：

```bash
npx wrangler login
```

---

## 2. 创建 D1 数据库

```bash
npx wrangler d1 create yupao-ledger-db
```

命令会返回数据库 ID。打开 `wrangler.jsonc`，将：

```text
REPLACE_WITH_YOUR_D1_DATABASE_ID
```

替换为实际数据库 ID。

执行远程迁移：

```bash
npx wrangler d1 migrations apply yupao-ledger-db --remote
```

不要把本地 `.local/yupao.db` 上传到正式环境。

---

## 3. 创建 Cloudflare Access 应用

建议先确定正式域名，例如：

```text
finance.example.com
```

在 Cloudflare Zero Trust 中：

1. 打开 **Access → Applications**。
2. 新建 **Self-hosted application**。
3. 填写正式域名。
4. 创建 `Allow` 策略。
5. 只加入你们两个人的具体邮箱。
6. 不要创建“任何邮箱均可访问”的 OTP 策略。
7. 记录应用的 `AUD` 值。
8. 记录团队域名，例如：

```text
https://your-team.cloudflareaccess.com
```

在 `wrangler.jsonc` 中配置：

```jsonc
"AUTH_BYPASS": "false",
"ALLOWED_EMAILS": "email1@example.com,email2@example.com",
"ACCESS_TEAM_DOMAIN": "https://your-team.cloudflareaccess.com",
"ACCESS_AUD": "Access 应用 AUD"
```

邮箱属于个人信息。正式仓库中更推荐通过 Wrangler Secret 写入：

```bash
npx wrangler secret put ALLOWED_EMAILS
npx wrangler secret put ACCESS_AUD
```

使用 Secret 后，可以从 `vars` 中删除对应字段。

`ACCESS_TEAM_DOMAIN` 和 `HOUSEHOLD_NAME` 可以保留为普通变量。

---

## 4. 构建

修改源码后执行：

```bash
npm run build
npm test
```

没有修改源码时，可以使用仓库中已经生成的：

```text
dist/
build/worker/index.js
```

---

## 5. 部署 Worker

```bash
npx wrangler deploy
```

部署成功后，先访问 Wrangler 返回的测试地址，确认：

```text
/api/health
```

返回正常。

正式财务页面不要长期裸露在 `workers.dev` 域名。完成测试后，应绑定自定义域名并使用 Access 保护。

---

## 6. 绑定自定义域名

在 Worker 设置中添加 Custom Domain，例如：

```text
finance.example.com
```

确认该域名与 Access 应用中配置的域名一致。

访问时应先进入 Cloudflare Access 登录页，未在白名单中的邮箱必须被拒绝。

---

## 7. 首次进入

首次登录后，Worker 会自动：

- 创建用户
- 创建“芋炮之家”家庭空间
- 将第一名用户设为 Owner
- 将第二名用户设为 Member
- 初始化默认账户
- 初始化默认收入与支出分类

两个人应分别登录一次，确认：

- 两个账户显示同一个家庭空间
- 一方新增账目后，另一方刷新可以看到
- 转账不会计入收入或支出

---

## 8. 正式环境检查

部署完成后检查：

- `AUTH_BYPASS` 为 `false`
- Access 只允许两个指定邮箱
- `ALLOWED_EMAILS` 与 Access 白名单一致
- D1 使用正式数据库 ID
- `.local/` 未提交到 GitHub
- `/api/export/json` 只有登录用户可访问
- 浏览器退出 Access 会话后不能继续访问账本
- PWA 安装后仍会经过 Access 验证

---

## 9. R2 备份（推荐）

创建私有 R2 Bucket：

```bash
npx wrangler r2 bucket create yupao-ledger-backups
```

在本机设置：

```bash
export R2_BUCKET=yupao-ledger-backups
export BACKUP_PASSPHRASE='使用密码管理器生成的长随机密码'
```

执行：

```bash
npm run backup
```

备份脚本会：

1. 从远程 D1 导出 SQL。
2. 使用 AES-256-GCM 加密。
3. 上传加密文件到 R2。
4. 删除本地明文 SQL。

加密密码不要写入 GitHub，也不要与备份文件保存在同一位置。

## 10. 备份解密与恢复演练

先只解密并检查 SQL，不直接写入数据库：

```bash
BACKUP_PASSPHRASE='你的备份密码' \
  npm run restore:backup -- ./yupao-ledger-2026-07-28.sql.enc
```

解密文件会放入：

```text
.backup/restore/
```

建议先在测试数据库执行恢复演练。确实需要写入当前配置的远程 D1 时，必须同时使用两个显式开关：

```bash
BACKUP_PASSPHRASE='你的备份密码' \
CONFIRM_RESTORE=YES \
  npm run restore:backup -- ./yupao-ledger-2026-07-28.sql.enc --apply
```

恢复前应先通过 D1 Time Travel 或额外导出保留当前数据库。不要在未检查 SQL 的情况下直接对正式数据库执行恢复。
