# v0.3.0 Release Notes

## 设计重构
- 统一为薄荷绿与莫兰迪粉生活感设计系统
- 降低阴影、渐变和装饰噪声
- 提升辅助文字、输入框和图表的对比度
- 首页改为活泼大芋头 + 沉稳小坦克的双角色层级

## 交互与性能
- 使用浏览器原生 WAAPI 实现轻量页面和角色动效
- 仅动画 `transform` 与 `opacity`
- 新增 app.js preload 与模块预加载
- PWA 缓存拆分为 network-first / cache-first / stale-while-revalidate
- 财务 API 继续完全绕过缓存
- 首屏后卡片启用 `content-visibility`
