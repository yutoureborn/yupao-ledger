# v0.3.10 升级说明

## 修复问题
v0.3.9 的 `TransactionForm` 同时渲染桌面表单和移动表单。移动表单的 `v039` 类名缺少桌面端默认隐藏规则，导致 PC 端在正常桌面表单下方又出现一整套未套用移动端媒体查询样式的控件。

## 本次修复
- PC：只显示 `desktop-transaction-form-v039`
- 手机 ≤ 720px：只显示 `mobile-transaction-form-v039`
- 增加明确的响应式互斥规则，避免后续 CSS 顺序变化再次触发
- 顺带整理桌面端保存区域的间距和分隔线
- Service Worker 缓存升级至 `yupao-shell-v17`

## 数据影响
无数据库、API、账目和分类数据变化。
