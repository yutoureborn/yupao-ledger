# 芋炮小账本 v0.3.0

双人家庭使用的在线记账 PWA。

## 本版方向

- 生活气息、简单可爱
- 清淡薄荷绿 + 莫兰迪粉
- 活泼的大芋头 + 沉稳的小坦克
- 轻量 WAAPI 微交互，不引入额外动画依赖
- 分层 PWA 缓存和关键资源预加载
- 保留收入、支出、转账、预算、发票和双账号登录

## 性能原则

- 角色动画只使用 `transform`
- 页面进入动画只使用 `opacity + transform`
- 尊重 `prefers-reduced-motion`
- API 不进入 Service Worker 缓存
- 导航页面网络优先，版本资源缓存优先
- 首屏后模块使用 `content-visibility` 降低初始渲染开销

详见 `docs/`。
