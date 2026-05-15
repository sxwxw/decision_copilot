# 1. 本地保存

- [x] 1.1 在 `useDecisionModel.js` 中新增 `saveToStorage()` 方法
- [x] 1.2 在 `buildModel()` 和 `runSimulation()` 完成后调用 `saveToStorage()`
- [x] 1.3 实现存储格式（版本号 + 序列化模型数据）

## 2. 本地恢复

- [x] 2.1 在 composable 初始化时检查 localStorage
- [x] 2.2 实现 `loadFromStorage()` 方法，恢复 state
- [x] 2.3 实现版本检查和不兼容数据清除

## 3. UI 入口

- [x] 3.1 在 ParamPanel.vue 中新增"清除缓存"按钮
- [x] 3.2 实现恢复时的提示消息
