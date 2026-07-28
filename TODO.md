# TODO

> 0.2.1 已修复 Workers Free 下 PBKDF2 CPU 超限。

## 上线前

- [ ] 执行 `migrations/0002_internal_auth.sql`
- [ ] 设置正式 `PASSWORD_PEPPER`
- [ ] 设置临时 `SETUP_TOKEN`
- [ ] 确认 `AUTH_BYPASS=false`
- [ ] 初始化两个账号并下载恢复码
- [ ] 删除初始化后的 `SETUP_TOKEN`
- [ ] 测试两个账号的跨设备同步
- [ ] 执行一次加密备份

## 后续可选

- [ ] Turnstile 异常登录验证
- [ ] TOTP 二步验证
- [ ] 主动会话列表与单设备撤销
- [ ] 登录安全通知
- [ ] 票据附件与 OCR
