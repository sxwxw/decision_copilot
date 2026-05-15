## 为什么

用户刷新页面后所有决策模型丢失。所有状态仅存于前端 Vue reactive store，无持久化机制。

## 变更内容

使用 localStorage 实现决策模型的本地保存和恢复。用户刷新页面后自动恢复上次的决策模型。

## 功能 (Capabilities)

### 新增功能

- `local-persistence`: 使用 localStorage 保存和恢复决策模型

## 影响

- `src/composables/useDecisionModel.js` 新增 saveToStorage / loadFromStorage 方法
