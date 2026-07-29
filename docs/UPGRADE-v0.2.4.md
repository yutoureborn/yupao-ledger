# 芋炮小账本 v0.2.4 升级说明

> 适用基线：已部署 v0.2.3 或 v0.2.2 内置认证版本

## 本次更新

- 互换芋头与炮台的角色职责
- 芋头改为明显芋泥紫
- 炮台改为绿黑机械色
- 更新 SVG 动画、Logo、favicon 和 PWA 图标
- 记账页新增芋头引导
- 统计页新增炮台整理与图表投影提示

## 不需要操作

本版本不涉及数据库和认证结构变更，因此不需要：

- 新建 D1
- 执行 migration
- 修改 `wrangler.jsonc`
- 修改 D1 Database ID
- 修改 `PASSWORD_PEPPER`
- 重新创建账号
- 清理现有账目

## GitHub 网页上传

1. 解压 `yupao-ledger-v0.2.4-mascot-role-swap-patch.zip`
2. 打开 GitHub 仓库
3. 选择 `Add file → Upload files`
4. 将补丁目录里面的全部内容拖入上传区
5. 覆盖同名文件
6. 提交到 `main`

建议 Commit message：

```text
Swap mascot roles and update colors v0.2.4
```

## Workers Builds 验收

进入：

```text
Cloudflare → Workers & Pages → yupao-ledger → Deployments
```

确认：

- package version 为 `0.2.4`
- Building 成功
- 自动化测试全部通过
- Deploying 成功

## 浏览器刷新

部署成功后：

- Windows：`Ctrl + Shift + R`
- 已安装 PWA：完全关闭后重新打开
- 仍显示旧角色时：清除站点缓存，但不需要删除账号或 D1 数据

## 视觉验收

### 记账页

- 芋头明显为芋泥紫
- 芋头拿着铅笔，承担记账引导
- 保存成功时芋头举起收据或金币
- 炮台显示绿色整理勾号

### 统计页

- 炮台为绿黑色
- 炮台投影图表，承担整理与总结
- 芋头只作为查看和陪伴角色
- PC 和手机均无角色遮挡正文

### 安全页

- 炮台展开盾牌和小锁
- 芋头靠近账本
- 减少动态模式下循环动作停止
