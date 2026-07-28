# GitHub 网页上传 + Workers Builds 部署

> 项目版本：0.2.1 内置认证版

## 部署结构

```text
GitHub 私有仓库 main
→ Cloudflare Workers Builds
→ npm test
→ npx wrangler deploy
→ workers.dev
```

不需要 Git 命令、GitHub Desktop、Zero Trust 或正式域名。

## 已有线上项目的升级

当前已经部署过 0.1.x 时，优先阅读：

[从方案 A 切换到方案 B](UPGRADE-TO-INTERNAL-AUTH.md)

## 新项目部署步骤

### 1. 创建 D1

Cloudflare 中创建：

```text
yupao-ledger-db
```

复制 Database ID，填写到 `wrangler.jsonc`。

### 2. 初始化 D1

在 D1 Console 依次执行：

```text
migrations/0001_init.sql
migrations/0002_internal_auth.sql
```

必须按编号顺序执行。

### 3. GitHub 网页上传

创建 Private 仓库 `yupao-ledger`。

解压项目 ZIP，把根目录内文件和文件夹上传到仓库根目录。GitHub 首页应直接看到：

```text
package.json
wrangler.jsonc
src
public
migrations
```

### 4. 连接 Workers Builds

Cloudflare：

```text
Workers & Pages
→ Create / Import repository
→ GitHub
→ yupao-ledger
```

构建配置：

| 项目 | 值 |
|---|---|
| Production branch | `main` |
| Root directory | 留空 |
| Build command | `npm test` |
| Deploy command | `npx wrangler deploy` |
| Node version | `22` |

### 5. 创建 Secrets

Worker：

```text
Settings
→ Variables and Secrets
```

添加：

```text
PASSWORD_PEPPER  Secret
SETUP_TOKEN      Secret
```

不要添加 Access Team Domain、AUD 或邮箱白名单。

### 6. 首次初始化

部署成功后访问 `workers.dev` 地址，页面会自动检查：

- 认证数据表是否存在
- Pepper 是否配置
- 初始化密钥是否配置
- 两个账号是否已经创建

准备完整后，页面进入双账号初始化。

### 7. 后续更新

以后通过 GitHub 网页编辑或上传文件，提交到 `main` 即可自动部署。

有新的 migration 时，必须先在 D1 Console 执行，再发布依赖新结构的代码。
