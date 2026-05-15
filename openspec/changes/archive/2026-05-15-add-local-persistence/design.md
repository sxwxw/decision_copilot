## 上下文

所有决策状态存储在 `useDecisionModel.js` 的 `state` 对象中（model, paramValues, userInput 等）。无持久化。

## 目标 / 非目标

**目标：**
- 模型变更时自动保存到 localStorage
- 页面加载时从 localStorage 恢复
- 提供"清除缓存"入口

**非目标：**
- 不做服务端数据库持久化
- 不做多设备同步

## 决策

### 1. 存储策略

- key: `decision-copilot-state`
- 内容：序列化 state.model + state.paramValues
- 触发：模型构建/深度模拟完成后自动保存
- 恢复：页面加载时检查 localStorage，存在则自动恢复

### 2. 版本控制

存储格式增加版本号，后续结构变更时可检测并迁移。

## 风险 / 权衡

[风险] → localStorage 有 5MB 限制
→ 缓解：决策模型 JSON 通常 < 100KB，不会超限

[风险] → 过期数据可能不兼容后续代码变更
→ 缓解：版本检查 + 迁移/清除机制
