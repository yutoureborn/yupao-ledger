# 正式部署检查清单

## Cloudflare

- [ ] Worker 使用免费 `workers.dev`
- [ ] D1 绑定名称为 `DB`
- [ ] D1 Database ID 为真实 UUID
- [ ] Preview URLs 关闭
- [ ] 未启用 Cloudflare Access
- [ ] `AUTH_BYPASS=false`
- [ ] `PASSWORD_PEPPER` 为 Secret
- [ ] 初始化前存在 `SETUP_TOKEN` Secret

## D1

- [ ] 已执行 `0001_init.sql`
- [ ] 已执行 `0002_internal_auth.sql`
- [ ] 存在四张认证表

## GitHub / Workers Builds

- [ ] 私有仓库
- [ ] Production branch 为 `main`
- [ ] Build command 为 `npm test`
- [ ] Deploy command 为 `npx wrangler deploy`
- [ ] Node 22

## 首次初始化

- [ ] Owner 和 Member 使用不同邮箱
- [ ] 两个密码均至少 12 位
- [ ] 已下载两组恢复码
- [ ] 两人分别完成登录
- [ ] 初始化后删除 `SETUP_TOKEN`
- [ ] 永久保存 `PASSWORD_PEPPER`

## 业务验收

- [ ] 新增收入
- [ ] 新增支出
- [ ] 新增转账
- [ ] 转账不计入收支
- [ ] 编辑、删除和恢复账目
- [ ] 两台设备数据同步
- [ ] 图表和账户余额正确
- [ ] PWA 安装正常
