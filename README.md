# 芋炮小账本 v0.3.1 角色资产 + 扇形图修复补丁

本补丁基于 v0.3.0 升级，内容包括：
- 新版“大芋头 + 小坦克”角色方案
- 前端可直接复用的 SVG 角色资产
- PC 端支出扇形图/环形图显示问题修复
- 相关样式与版本号更新

## 使用方式
1. 将补丁中的同路径文件覆盖到 v0.3.0 项目
2. 执行 `npm run build`
3. 如需验证，执行 `node --test tests/*.test.mjs`

## 关键文件
- `src/frontend/app.tsx`
- `public/styles.css`
- `public/illustrations/mascots/*`
- `docs/MASCOT-ASSET-PLAN-v0.3.1.md`
