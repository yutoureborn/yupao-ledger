# 芋炮小账本 v0.2.6 升级说明

## 本次升级内容

- 奶油暖色 UI 重构
- 杏橙色 PC 导航
- 首页 Hero 重构
- 静态拟人角色替换
- 支出分类图表重构
- 登录页视觉同步
- 减少复杂角色动画

## 数据影响

无需执行新的 D1 Migration。

不会修改：

- 账号
- 密码
- Session
- 恢复码
- 账目
- 账户
- 分类
- 预算
- `PASSWORD_PEPPER`
- D1 Database ID

## GitHub 网页上传

1. 解压 `yupao-ledger-v0.2.6-ui-static-character-patch.zip`。
2. 打开 GitHub 私有仓库。
3. 点击 `Add file → Upload files`。
4. 上传补丁目录内部全部文件。
5. 覆盖同名文件。
6. 提交到 `main`。

提交说明建议：

```text
Warm lifestyle UI and static mascots v0.2.6
```

## Workers Builds 预期

```text
yupao-ledger@0.2.6
27 tests
27 pass
0 fail
Deploying ✓
```

## 浏览器更新

部署成功后：

```text
Ctrl + Shift + R
```

PWA 完全关闭后重新打开。仍显示旧版时，只清除站点缓存，不需要删除账号或 D1 数据。
