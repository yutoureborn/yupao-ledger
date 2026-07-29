# 芋炮小账本 v0.2.3 安全回归检查清单

> 检查日期：2026-07-29  
> 检查范围：`src/`、`public/`、`scripts/`、`migrations/`、`tests/`、`wrangler.jsonc` 与构建产物  
> 检查方式：逐文件静态审查、攻击面梳理、自动化 API 测试、构建产物检查、备份格式恢复测试  
> 结论：未发现仍可直接利用的 Critical / High 级问题；本轮修复 9 项安全薄弱点，27 项测试全部通过。

## 1. 威胁模型

系统是公开 `workers.dev` 地址上的双人家庭账本。攻击面主要包括：

- 公开登录、密码参数、恢复密码和首次初始化接口
- Cookie 会话、CSRF Token 与设备会话撤销
- D1 中的用户、密码凭据、恢复码和家庭财务数据
- CSV / JSON 导出接口
- PWA Service Worker 与浏览器缓存
- GitHub 仓库、Cloudflare Variables / Secrets 和备份文件

核心安全目标：

1. 未登录访问者无法读取或修改账本。
2. 一个家庭空间的数据不能被伪造 ID 越权访问。
3. 密码、Pepper、恢复码和 Session Token 不以明文落库。
4. 跨站请求不能利用登录 Cookie 执行写操作。
5. 误配置开发模式不能绕过线上登录。
6. 页面缓存、日志和导出不能意外泄露财务数据。

---

## 2. 自动化验收结果

```text
构建：通过
TypeScript 前端：通过
TypeScript Worker：通过
自动化测试：27 / 27 通过
失败：0
跳过：0
```

已覆盖：

- 双账号初始化与恢复码
- 登录、登出与会话 Cookie
- CSRF 校验
- 修改密码后 Session 轮换
- 恢复密码后旧 Session 撤销
- 线上误设 `AUTH_BYPASS=true` 仍不能绕过登录
- 跨站认证请求拒绝
- 32 KiB JSON 请求体上限
- 损坏 Cookie 不导致 Worker 500
- 财务 API `no-store`
- Service Worker 不缓存 `/api/*`
- D1 交易、转账、余额、软删除与版本冲突
- 备份加密格式可解密恢复
- 账户/分类颜色输入校验

---

## 3. 逐项安全检查

| 优先级 | 检查项 | 当前状态 | 本轮结果 |
|---|---|---|---|
| P0 | 线上认证绕过 | 已修复并测试 | `AUTH_BYPASS` 仅允许 localhost、127.0.0.1、::1 和 `.local` |
| P0 | Session Cookie | 通过 | `__Host-`、HttpOnly、Secure、SameSite=Strict、Path=/、Priority=High |
| P0 | CSRF | 通过 | 写接口校验 CSRF，同时检查 Origin / Sec-Fetch-Site |
| P0 | 密码修改后的旧会话 | 已加强 | 撤销全部旧会话并生成新的当前 Session 和 CSRF Token |
| P0 | 恢复密码 | 通过 | 恢复码单次使用，密码更新后撤销旧会话 |
| P0 | SQL 注入 | 通过 | 业务 SQL 使用 D1 Prepared Statement 参数绑定 |
| P0 | 家庭数据越权 | 通过 | 账户、分类、交易、预算和导出查询均绑定 `household_id` |
| P1 | 公开认证接口跨站调用 | 已修复 | Setup、登录、密码参数、恢复接口执行同源检查 |
| P1 | 请求体资源滥用 | 已修复 | JSON 请求体最大 32 KiB；超限返回 413 |
| P1 | Setup Token 猜测 | 已加强 | 首次初始化失败尝试纳入登录尝试限流 |
| P1 | 恢复码重生成一致性 | 已加强 | 删除旧码和写入新码使用 D1 batch |
| P1 | 恶意 CSS 值 | 已修复 | 分类/账户颜色仅接受 `#RRGGBB` |
| P1 | Cookie 解码异常 | 已修复 | 非法 percent encoding 不再触发 500 |
| P1 | Session 数据膨胀 | 已加强 | 创建 Session 时清理过期与旧撤销会话 |
| P1 | XSS | 通过 | 用户字段通过虚拟 DOM 文本节点渲染，无业务 `innerHTML` / `eval` |
| P1 | 密钥进入仓库 | 通过 | 正式配置不包含 Pepper、Setup Token 或登录密码 |
| P2 | API 缓存 | 通过 | `/api/*`、认证和导出响应均为 `Cache-Control: no-store` |
| P2 | 页面外壳缓存 | 已优化 | HTML、SW、Manifest 改为 `no-cache, must-revalidate` |
| P2 | 安全响应头 | 已加强 | CSP、HSTS、COOP、CORP、nosniff、frame-ancestors、Permissions-Policy |
| P2 | 日期输入 | 已加强 | 校验真实日历日期；月份限定 01–12 |
| P2 | 审计日志 | 通过 | 密码修改、会话撤销、恢复码重生成及账目变更写入审计表 |
| P2 | 加密备份 | 通过 | scrypt + AES-256-GCM；临时明文文件完成后删除 |

---

## 4. 本轮已经直接修复的代码

### 4.1 阻止生产环境误开开发认证绕过

旧逻辑只判断环境变量。v0.2.3 同时判断请求 hostname，线上 `workers.dev` 即使误设 `AUTH_BYPASS=true` 也要求登录。

### 4.2 同源与 CSRF 双重校验

对写接口和公开认证 POST：

- 拒绝 Origin 与当前站点不一致的请求
- 拒绝 `Sec-Fetch-Site: cross-site`
- 登录后的写接口继续要求 CSRF Token

### 4.3 限制 JSON 请求体

最大 32 KiB，防止公开接口被超大 JSON 消耗 CPU 和内存。

### 4.4 密码更新时轮换 Session

修改密码后：

1. 更新验证凭据
2. 撤销全部旧 Session
3. 创建新的当前 Session
4. 返回新的 Cookie 和 CSRF Token

### 4.5 缓存边界收紧

- 财务 API 永不缓存
- HTML、Service Worker 和 Manifest 每次重新验证
- 带版本号的静态资源允许短期缓存

---

## 5. 仍需人工完成的上线安全项

| 操作 | 必须性 | 操作人 |
|---|---:|---|
| 初始化成功后删除 `SETUP_TOKEN` | 必须 | Cloudflare 管理员 |
| 永久备份 `PASSWORD_PEPPER` | 必须 | 项目所有者 |
| 两个账号分别验证登录、改密、恢复码 | 必须 | 两名用户 |
| 执行一次正式 D1 加密备份和解密演练 | 必须 | Cloudflare 管理员 |
| 检查 GitHub 仓库仍为 Private | 必须 | GitHub 管理员 |
| 检查 Worker 中不存在旧 Access 变量 | 建议 | Cloudflare 管理员 |
| 开启 Workers Logs 后复核无敏感字段 | 建议 | Cloudflare 管理员 |

### 删除 SETUP_TOKEN

```text
Cloudflare → Workers & Pages → yupao-ledger
→ Settings → Variables and Secrets
→ 删除 SETUP_TOKEN
→ Deploy
```

必须保留 `PASSWORD_PEPPER`。Pepper 丢失或修改后，现有密码和恢复码将无法验证。

---

## 6. 剩余风险与后续加固

### 中风险：公开认证接口可能消耗 D1 免费额度

登录与密码参数接口仍需查询 D1。现有账号/IP限流能够降低暴力破解，但不能完全阻止大规模分布式请求。

后续可选：

- Cloudflare Turnstile 仅在异常登录时出现
- Cloudflare WAF / Rate Limiting Rule（若所用套餐支持）
- 将登录尝试限流升级为专用 Rate Limiting Binding

### 中低风险：浏览器端派生值具有“密码等价凭据”属性

原始密码不会发送到 Worker，但浏览器派生的 proof 一旦在恶意脚本环境中被窃取，仍可能用于登录。因此 CSP、依赖供应链和 XSS 防护仍然重要。

### 低风险：当前没有邮件/TOTP 二次验证

这是两人私有项目的成本与复杂度取舍。恢复码必须离线保存。

### 未完成的外部验证

本轮不能替代：

- 真实公网渗透测试
- Cloudflare 账号和 Secret 后台权限审计
- 在线 npm 漏洞数据库扫描（运行环境未访问软件包注册表）
- 真实移动设备 Cookie / PWA 全机型测试

---

## 7. 安全验收结论

**代码级结论：通过，可进入 v0.2.3 线上回归。**

上线前阻断项只有：

1. 删除 `SETUP_TOKEN`
2. 确认 `AUTH_BYPASS=false`
3. 确认 `PASSWORD_PEPPER` 已安全备份
4. 完成一次正式备份和恢复演练

