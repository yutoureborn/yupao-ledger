# 芋炮小账本 v0.2.8 升级说明

## 本次升级

- 将整体 UI 从偏装饰型手账风收敛为轻量组件化风格。
- 重绘芋头和炮台为内联 SVG 组件。
- 炮台使用绿、黄、黑三色。
- 首页 Hero、概览卡、按钮、导航、交易列表、图表、预算和发票统一颜色、边框、圆角与阴影。
- 提高正文、辅助文字和按钮文字的对比度。

## 数据影响

本版本没有新增 D1 Migration，不修改账号、密码、发票或账目数据。

## GitHub 网页上传

1. 解压 `yupao-ledger-v0.2.8-lite-code-patch.zip`。
2. 打开 GitHub 仓库，选择 `Add file → Upload files`。
3. 上传解压目录内部的全部文件并覆盖同名文件。
4. 提交到 `main`，建议提交信息：`Lightweight component UI v0.2.8`。
5. 等待 Cloudflare Workers Builds 完成部署。

补丁不包含 `wrangler.jsonc`，不会覆盖 D1 Database ID。

## 预期构建结果

```text
yupao-ledger@0.2.8
31 tests
31 pass
0 fail
Deploying ✓
```

## 部署后刷新

- Windows：`Ctrl + Shift + R`。
- 已安装 PWA：完全关闭后重新打开。
- 仍显示旧版时，仅清除该站点缓存，不要删除 Cookie 或 D1 数据。

## 验收重点

- 首页正文与按钮文字清晰可读。
- 芋头和炮台边缘清晰，不再出现截图裁切框。
- 炮台为绿、黄、黑三色。
- PC 与移动端没有横向滚动。
- 发票卡片、交易列表、图表和预算模块没有文字重叠。
