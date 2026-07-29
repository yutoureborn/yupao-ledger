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


## 发票数据

- 发票属于财务敏感数据，所有发票 API 均要求内部登录会话。
- 收到的发票只能关联当前家庭的支出；开出的发票只能关联当前家庭的收入。
- 发票号码、对方名称和备注不得写入 Worker 普通运行日志。
- 当前版本不上传发票图片或 PDF；后续启用附件时必须使用私有 R2 Bucket 和短时授权读取。
- JSON 全量导出包含发票数据，导出文件应保存在受控设备并及时加密或删除。
