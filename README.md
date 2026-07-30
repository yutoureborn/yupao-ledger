# 芋炮小账本 v0.2.9 Tank Mascot Patch

本补丁基于 v0.2.8 轻量组件化 UI 继续升级：

- 将炮台角色正式改为 **坦克拟人形象**
- 保持芋头角色不变
- 坦克角色采用 **绿 / 黄 / 黑** 三色组合
- 保持整体 UI 轻量、克制、易读
- 仍使用前端内联 SVG 组件，不再依赖截图式 JPG/PNG 角色资源

## 主要变更文件
- `src/frontend/app.tsx`
- `public/index.html`
- `public/sw.js`
- `public/manifest.webmanifest`

## 说明
本补丁不涉及数据库结构变更，也不需要执行新的 D1 migration。
