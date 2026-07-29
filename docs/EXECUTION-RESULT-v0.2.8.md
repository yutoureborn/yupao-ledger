# v0.2.8 执行结果

## 代码修改

- 新增 `TaroCharacter` 内联 SVG 组件。
- 新增 `CannonCharacter` 内联 SVG 组件。
- `Mascot` 根据场景组合角色，不再请求 `/illustrations/*`。
- 新增复用型 `SummaryMetric` 概览卡组件。
- 重构发票 Hero，移除表情符号堆叠装饰。
- 新增 v0.2.8 主题 Token 与响应式样式覆盖。
- Service Worker 缓存升级为 `yupao-shell-v8`。

## 测试

```text
31 tests
31 pass
0 fail
```

## 数据库

- 新增 Migration：无
- 数据结构变化：无
- 现有账号和账目：不受影响
