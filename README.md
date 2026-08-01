# 芋炮小账本 v0.3.6 升级补丁

适用于 `v0.3.5` 继续升级。

## 包含内容
- 首页更接近可交付产品级的视觉收敛
- 明细页重构为概览 / 筛选 / 列表三段式
- 统计页新增摘要卡带并优化整体布局
- 对外角色命名统一为 **小炮台**

## 覆盖文件
- `src/frontend/app.tsx`
- `public/styles.css`
- `build/frontend/app.js`
- `dist/app.js`
- `dist/styles.css`
- 文档与说明文件

## 验证
- `npm run build`：通过
- `node --test tests/*.test.mjs`：34 / 34 通过
