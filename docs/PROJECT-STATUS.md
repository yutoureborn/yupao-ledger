# 项目开发状态

> 当前版本：0.2.0 方案 B

## 已完成

- 原有动态账本、账户、分类、预算、图表和 PWA 功能
- 芋炮风格登录、初始化和恢复界面
- 固定双账号 Owner / Member
- 密码哈希、Session Cookie、CSRF 和登录限流
- 密码修改、退出其他设备和恢复码更新
- 从 Cloudflare Access 迁移的增量数据库脚本
- GitHub 网页上传与 Workers Builds 自动部署文档
- 15 项自动化测试

## 不再需要

- Zero Trust Free
- 支付身份信息
- Cloudflare Access
- 邮箱 OTP
- Access Team Domain 与 AUD

## 上线前用户操作

1. 在现有 D1 执行 `0002_internal_auth.sql`。
2. 在 Worker 创建 `PASSWORD_PEPPER` 和 `SETUP_TOKEN` Secret。
3. 更新 GitHub 源码，保留现有 D1 Database ID。
4. 完成自动构建部署。
5. 打开初始化页创建两个账号。
6. 下载并分别保存两套恢复码。
7. 初始化后删除 `SETUP_TOKEN`，保留 `PASSWORD_PEPPER`。
