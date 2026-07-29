# Security Policy

芋炮小账本是仅供两名固定家庭成员使用的私有项目。

## 安全基线

- 正式环境必须保持 `AUTH_BYPASS=false`。
- `PASSWORD_PEPPER` 只允许保存在 Cloudflare Secret，并必须离线备份。
- 初始化完成后必须删除 `SETUP_TOKEN`。
- GitHub 仓库保持 Private。
- 不在 Issue、日志或截图中提交真实账目、密码、恢复码、Session Cookie 或 Secret。

## 报告问题

不要通过公开 GitHub Issue 提交安全漏洞或敏感数据。请通过项目所有者约定的私有渠道处理。

## 发布前检查

```bash
npm test
```

所有测试必须通过后才能发布。
