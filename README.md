# 芋炮小账本 v0.3.7

本版本完成两项核心升级：

1. **品牌标识统一**
   - 新增正式 SVG 品牌标识
   - 大芋头与小炮台保持与项目主角色资产一致的视觉语言
   - 侧栏、移动端顶部、登录页和 favicon 统一使用新版标识

2. **移动端独立架构重构**
   - 不再直接缩放桌面页面
   - 首页、明细页、统计页分别增加独立移动端视图
   - 移动端重新设计信息层级、交互路径、卡片尺寸、月份切换、筛选和底部导航

## 关键文件

- `public/brand/brand-mark-v037.svg`
- `public/brand/brand-lockup-v037.svg`
- `src/frontend/app.tsx`
- `public/styles.css`
- `public/sw.js`
