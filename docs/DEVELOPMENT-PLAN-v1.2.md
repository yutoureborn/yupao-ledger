# 芋炮小账本开发计划 v1.2

## 架构变更

原方案的 Cloudflare Access 已替换为项目内认证：

```text
浏览器 / PWA
→ 自有登录页
→ Worker Session API
→ D1 auth_sessions
→ 家庭权限
→ 业务数据
```

## 认证交付范围

- 固定双账号初始化
- Owner / Member 身份
- 密码哈希与 Pepper
- Session Cookie
- CSRF
- 登录限流
- 修改密码
- 退出其他设备
- 单次恢复码
- 账号恢复
- 登录与设置 UI

## 保持不变

- React / TypeScript 前端
- Workers Static Assets
- Cloudflare Worker API
- D1 业务数据
- GitHub Workers Builds
- 免费 `workers.dev`
- PWA、图表、动画和响应式设计

## 安全原则

- 不开放注册
- 不发送密码邮件
- 不保存明文密码、会话和恢复码
- 不把 Pepper 写入仓库
- 不使用浏览器 LocalStorage 保存会话令牌
- 写接口必须校验 CSRF
- 正式环境禁止 Auth Bypass
