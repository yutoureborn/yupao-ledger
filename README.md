# 芋炮小账本 v0.3.2 升级补丁

这次不是继续做局部修补，而是对 **“钱花去了哪里 / 支出分类” 模块进行整体重构**。

## 主要内容
- 重构支出分类模块整体布局
- 扇形图改为 SVG path 扇区绘制
- 新增摘要头部、侧边概览卡、完整分类排行列表
- 更新前端资源版本号与 Service Worker 缓存版本
- 更新自动化测试断言

## 如何使用
1. 以你当前稳定项目为基底
2. 将本补丁中的同路径文件覆盖到项目中
3. 执行：
   - `npm run build`
   - `node --test tests/*.test.mjs`
4. 重新上传 GitHub / Cloudflare Workers Builds 部署

## 核心变更文件
- `src/frontend/app.tsx`
- `public/styles.css`
- `public/index.html`
- `public/sw.js`
- `tests/assets.test.mjs`
