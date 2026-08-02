# v0.3.8 升级说明

## 1. 确认品牌资产

本版本使用的品牌资源直接来自已确认的两张图：

- 方形联名标识：大芋头 + 小炮台
- 横版联名标识：角色 + 芋炮小账本 + 两个人的小日子

原始文件保存在：

- `public/brand/source/approved-brand-mark-original.png`
- `public/brand/source/approved-brand-lockup-original.png`

前端实际使用：

- `public/brand/brand-mark-v038.svg`
- `public/brand/brand-lockup-v038.svg`
- `public/brand/approved-brand-mark-v038.webp`
- `public/brand/approved-brand-lockup-v038.webp`

其中 SVG 是轻量容器，引用同目录的已确认 WebP 资源，确保视觉与确认图一致，不再重新绘制新版本。

## 2. 移动端记账流程

旧问题：

- 桌面分类宫格直接缩小
- 页面过长
- 商户、备注始终占据大面积
- 保存按钮与底部导航互相遮挡

新结构：

1. 收支类型切换
2. 金额输入
3. 横向双行分类选择
4. 必要信息：账户 / 日期
5. 可折叠补充信息：商户 / 备注
6. 底部固定提交区

## 3. 移动端首页与统计

- 首页金额卡改为两列，结余整行展示
- Hero 角色与主按钮分离，不再相互遮挡
- 统计页近六个月改为移动专用进度条列表
- 删除缩放桌面 SVG 的实现方式

## 数据影响

- 无 D1 migration
- 不修改用户、账目、预算、发票数据
- 不修改认证逻辑
