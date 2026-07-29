# 芋炮小账本 v0.2.5 升级说明

## 升级范围

本补丁只修改前端角色、图表、图标、缓存版本、文档和测试。

不修改：

- D1 表结构
- `wrangler.jsonc`
- D1 Database ID
- `PASSWORD_PEPPER`
- 用户账号、密码、恢复码和账目数据

## GitHub 网页上传

1. 解压 `yupao-ledger-v0.2.5-character-chart-patch.zip`。
2. 打开 GitHub 仓库根目录。
3. 选择 `Add file → Upload files`。
4. 上传补丁目录内部的全部内容并覆盖同名文件。
5. 提交到 `main`，提交说明建议：`Redraw mascots and fix category chart v0.2.5`。
6. 等待 Workers Builds 自动构建和部署。

## 部署验收

构建日志应显示：

```text
yupao-ledger@0.2.5
27 tests
27 pass
0 fail
Deploying ✓
```

部署后执行 `Ctrl + Shift + R`，已安装 PWA 的需要完全关闭后重新打开。

## UI 验收

- 芋头为明显芋泥紫、不规则根茎轮廓，并有表皮纹理和手脚。
- 炮台为绿黑玩具机械色，大轮胎和短炮口清晰。
- 首页“钱花去了哪里”必须同时显示圆环和分类排行。
- 分类名称不换行，百分比和金额不重叠。
- 手机端没有横向滚动。
