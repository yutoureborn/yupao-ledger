# 芋炮小账本：GitHub 网页上传 + Workers Builds 部署指引

> 适用版本：v0.1.2  
> 部署方式：GitHub 网页上传 + Cloudflare Workers Builds  
> 正式地址：Cloudflare 免费 `*.workers.dev`  
> 不需要：Git 命令、GitHub Desktop、Wrangler 本机登录、自定义域名

---

## 1. 最终部署流程

```text
解压项目
  ↓
Cloudflare 网页创建 D1
  ↓
创建 Zero Trust Team，取得 Team Domain
  ↓
修改 wrangler.jsonc 中两个占位值
  ↓
GitHub 网页上传整个项目
  ↓
D1 Console 执行初始化 SQL
  ↓
Workers Builds 连接 GitHub 并首次部署
  ↓
为 workers.dev 启用 Access
  ↓
填写 ALLOWED_EMAILS 和 ACCESS_AUD Secrets
  ↓
两名成员依次登录验收
```

---

## 2. 解压项目

解压 `yupao-ledger-v0.1.2.zip`。

打开解压后的目录，确认根目录直接包含：

```text
package.json
wrangler.jsonc
src/
public/
migrations/
docs/
```

上传 GitHub 时应选择这些“目录内的内容”，不要把外层 `yupao-ledger-v0.1.2` 文件夹再套一层，也不要只上传 ZIP。

---

## 3. 创建 GitHub 私有仓库

1. 登录 GitHub。
2. 右上角 `+` → `New repository`。
3. Repository name：`yupao-ledger`。
4. Visibility：`Private`。
5. 不勾选 README、`.gitignore`、License。
6. 点击 `Create repository`。

仓库应保持为空，以免与项目中已有的 README 或其他文件冲突。

---

## 4. 创建 D1 数据库

进入 Cloudflare Dashboard：

```text
Storage & Databases
→ D1 SQL Database
→ Create database
```

填写：

```text
Database name: yupao-ledger-db
Location: Asia-Pacific / APAC
```

创建后复制 Database ID。

---

## 5. 创建 Zero Trust Team

进入：

```text
Cloudflare Dashboard
→ Zero Trust
```

第一次进入时创建组织：

```text
Team name: 例如 yupao-family
Plan: Free
```

取得 Team Domain：

```text
https://yupao-family.cloudflareaccess.com
```

注意：这不是账本地址，而是 Access 身份验证域名。

在：

```text
Zero Trust
→ Settings
→ Authentication
→ Login methods
```

启用 `One-time PIN`。

---

## 6. 修改 wrangler.jsonc

在本机用记事本、VS Code 或其他编辑器打开：

```text
wrangler.jsonc
```

### 6.1 替换 D1 ID

将：

```jsonc
"database_id": "REPLACE_WITH_YOUR_D1_DATABASE_ID"
```

替换为真实 D1 Database ID。

### 6.2 替换 Access Team Domain

将：

```jsonc
"ACCESS_TEAM_DOMAIN": "https://REPLACE_WITH_YOUR_TEAM.cloudflareaccess.com"
```

替换为真实 Team Domain，例如：

```jsonc
"ACCESS_TEAM_DOMAIN": "https://yupao-family.cloudflareaccess.com"
```

### 6.3 保持安全开关关闭

确认：

```jsonc
"AUTH_BYPASS": "false"
```

正式环境不得改为 `true`。

保存文件。

---

## 7. 用 GitHub 网页上传项目

进入刚创建的空仓库：

```text
Add file
→ Upload files
```

在 Windows 文件资源管理器中打开解压后的项目目录：

1. 按 `Ctrl + A` 选择目录内全部文件和文件夹。
2. 拖入 GitHub 上传区域。
3. 等待文件列表加载完成。
4. 确认仓库根目录直接出现 `package.json` 和 `wrangler.jsonc`。
5. Commit message 填写：`Initial upload of Yupao Ledger`。
6. 选择提交到 `main`。
7. 点击 `Commit changes`。

当前项目文件数低于 GitHub 网页单次 100 文件的限制，可以一次上传。

检查仓库根目录不要出现：

```text
yupao-ledger-v0.1.2/package.json
```

正确结构应是：

```text
package.json
src/
public/
```

---

## 8. 初始化 D1 表结构

在 GitHub 仓库打开：

```text
migrations/0001_init.sql
```

点击 Raw 或复制完整内容。

进入 Cloudflare：

```text
D1 SQL Database
→ yupao-ledger-db
→ Console
```

粘贴完整 SQL，点击 `Execute` / `Run`。

执行后用以下 SQL 验证：

```sql
SELECT name
FROM sqlite_master
WHERE type = 'table'
ORDER BY name;
```

应看到：

```text
accounts
audit_logs
budgets
categories
household_members
households
transactions
users
```

只在初始化时执行一次 `0001_init.sql`。

---

## 9. 连接 Workers Builds

进入：

```text
Cloudflare Dashboard
→ Workers & Pages
→ Create application
→ Import a repository
```

选择 GitHub，然后授权 `Cloudflare Workers and Pages` GitHub App。

建议权限范围选择：

```text
Only select repositories
→ yupao-ledger
```

不要无必要地授权全部私有仓库。

选择 `yupao-ledger` 仓库。

---

## 10. Workers Builds 配置

填写：

```text
Worker name: yupao-ledger
Production branch: main
Root directory: 留空
Build command: npm test
Deploy command: npx wrangler deploy
```

说明：

- `npm test` 会先构建前端和 Worker，再运行自动化测试。
- 只有测试通过，才会执行部署命令。
- Root directory 留空表示项目位于仓库根目录。
- Worker name 必须与 `wrangler.jsonc` 中的 `name` 一致。

### Build Variables

添加：

```text
NODE_VERSION = 22
```

Build variables 只在构建时使用，不要把邮箱和 Access AUD 放在这里。

### 分支设置

首次部署建议：

```text
Production branch builds: 开启
Non-production branch builds: 关闭
Build caching: 开启
```

点击 `Save and Deploy`。

---

## 11. 首次部署结果

构建流程应依次完成：

```text
自动安装依赖
→ npm test
→ npx wrangler deploy
→ 发布 Worker + 静态资源
```

成功后取得类似地址：

```text
https://yupao-ledger.你的账户子域.workers.dev
```

第一次部署时尚未配置 `ACCESS_AUD` 和邮箱 Secret，API 暂时拒绝访问是正常的。

---

## 12. 给 workers.dev 启用 Access

进入：

```text
Workers & Pages
→ yupao-ledger
→ Settings / Domains & Routes
```

找到正式 `workers.dev` 地址，点击：

```text
Enable Cloudflare Access
```

进入对应 Access Application。

建立策略：

```text
Policy name: Allow Yupao Family
Action: Allow
Include: Emails
```

填写两个具体邮箱：

```text
你的邮箱
你老婆的邮箱
```

不要使用：

```text
Everyone
所有 One-time PIN 用户
整个邮箱域名
```

可增加：

```text
Require
→ Login methods
→ One-time PIN
```

Session duration 建议设为 `30 days`。

---

## 13. 获取 Access AUD

进入：

```text
Zero Trust
→ Access controls
→ Applications
→ 当前芋炮小账本应用
→ Configure
→ Additional settings
```

复制：

```text
Application Audience (AUD) Tag
```

不要截断或手动改写。

---

## 14. 在 Cloudflare 网页填写运行时 Secrets

进入：

```text
Workers & Pages
→ yupao-ledger
→ Settings
→ Variables and Secrets
→ Add
```

### 14.1 ALLOWED_EMAILS

类型选择：

```text
Secret
```

名称：

```text
ALLOWED_EMAILS
```

值：

```text
你的邮箱,你老婆的邮箱
```

使用英文逗号，不加引号。

### 14.2 ACCESS_AUD

类型选择：

```text
Secret
```

名称：

```text
ACCESS_AUD
```

值：刚才复制的 Application Audience Tag。

点击 `Deploy` 或保存并发布变量配置。

敏感信息不要写进 GitHub、`wrangler.jsonc` 或 Build Variables。

---

## 15. 首次登录

项目规则：

```text
第一个成功登录的白名单用户 = Owner
第二个成功登录的白名单用户 = Member
```

建议：

1. 由预定 Owner 先打开 `workers.dev` 地址。
2. 使用邮箱验证码登录。
3. 系统创建“芋炮之家”、默认账户和分类。
4. 第二名成员再登录。
5. 第二名成员自动进入同一个家庭空间。

---

## 16. 验收清单

### 访问控制

- [ ] 两个指定邮箱都能登录
- [ ] 非白名单邮箱不能进入
- [ ] Worker 地址被 Access 保护
- [ ] `AUTH_BYPASS` 保持 `false`

### 数据

- [ ] Owner 新增支出后另一设备可看到
- [ ] 收入计入收入统计
- [ ] 支出计入支出统计
- [ ] 转账不计入收入和支出
- [ ] 删除与撤销正常
- [ ] 账户余额同步变化

### UI/PWA

- [ ] 手机布局正常
- [ ] 图表正常显示
- [ ] 动画正常
- [ ] 浏览器可安装 PWA

---

## 17. 以后如何更新

### 少量修改

可直接在 GitHub 网页打开文件，点击铅笔图标编辑并提交。

提交到 `main` 后，Workers Builds 会自动：

```text
安装依赖
→ 构建
→ 测试
→ 部署
```

### 批量更新

1. 在 GitHub 仓库点击 `Add file` → `Upload files`。
2. 拖入需要替换的文件或文件夹。
3. 提交到 `main`。
4. 在 Cloudflare `Deployments / Build history` 查看结果。

### 新数据库 migration

以后若出现：

```text
migrations/0002_xxx.sql
```

必须先在 D1 Console 执行该 SQL，再把相应代码提交到 `main`。

按编号顺序执行，不要重复执行同一个 migration。

---

## 18. 常见错误

### 构建提示找不到 package.json

原因：项目多套了一层目录。

错误：

```text
yupao-ledger-v0.1.2/package.json
```

正确：

```text
package.json
```

Root directory 保持留空。

### Worker name mismatch

确认 Cloudflare Worker 名称和配置都为：

```text
yupao-ledger
```

### D1 binding/database not found

检查 `wrangler.jsonc` 中：

```text
database_name = yupao-ledger-db
database_id = 真实 ID
```

### 页面能开但 API 报认证错误

依次检查：

1. Access 是否保护正确的 `workers.dev` 地址。
2. Team Domain 是否正确。
3. `ACCESS_AUD` Secret 是否来自当前应用。
4. `ALLOWED_EMAILS` 是否为两个完整邮箱。
5. Access Policy 是否精确允许这两个邮箱。

### GitHub 网页无法一次上传

项目当前可以一次上传。若未来文件超过 100 个，应分批上传，但必须保持目录结构不变。

---

## 19. 推荐的长期维护规则

- GitHub 仓库始终保持 Private。
- `main` 只放准备发布的版本。
- 每次提交写清楚修改内容。
- Cloudflare 构建失败时先查看 Build logs，不要连续重复部署。
- 真实邮箱、AUD、密码和备份密钥只放 Cloudflare Secrets 或密码管理器。
- 数据库迁移先执行 SQL，再发布依赖新结构的代码。
