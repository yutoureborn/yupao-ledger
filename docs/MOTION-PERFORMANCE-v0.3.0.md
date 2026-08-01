# v0.3.0 动效与性能方案

## 动效技术

参考 Anime.js V4 的轻量 WAAPI 思路，本项目直接使用浏览器 `Element.animate()`：

- 不新增第三方运行时依赖。
- 页面进入：`opacity + translateY`。
- 大芋头：低频上下移动与轻微旋转。
- 小坦克：更慢、更小幅的上下移动。
- 页面或路由变化时取消旧 Animation，避免实例堆积。
- 开启减少动态后，立即取消所有动画。

## 资源加载

- `app.js` 因为由 bootstrap 动态发现，使用 `preload` 提前下载。
- bootstrap 模块使用 `modulepreload`。
- 不预加载非首屏资源。

## PWA 缓存

- HTML 导航：network-first。
- 带版本号的 CSS/JS/MJS 和图标：cache-first。
- 其他同源静态资源：stale-while-revalidate。
- `/api/*`：完全不交给 Service Worker。

## 渲染

- 首屏后的 dashboard 区块启用 `content-visibility: auto`。
- 动画只使用合成友好的 transform 和 opacity。
- 移动端关闭 backdrop-filter。
