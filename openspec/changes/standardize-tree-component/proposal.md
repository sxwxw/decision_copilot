# 提案：决策树组件标准化重构

## 问题

DecisionTree.vue 耦合了大量业务特定逻辑：
- `buildNodeProbMap` / `getNodeProb` 依赖 `→` 分隔符和"第N年："前缀进行字符串匹配，脆弱且不可复用
- `year` 字段在"今天吃什么"等场景下显示"第一年"不合逻辑
- 连线虚线判断硬编码 `year >= 2` 业务规则
- `selectedNode` 查找依赖 `name + year` 组合，不可靠

组件本应是"只管画图"的通用工具，却占据了近 1/3 代码做数据猜测。

## 解决方案

1. **新增 `adaptTree` 适配器**：在 `useDecisionModel.js` 中将 LLM 输出的毛坯数据（`year`/`value`/`eventType`）标准化为通用契约（`id`/`step`/`score`/`status`/`probability`/`isDashed`）
2. **重构 DecisionTree.vue**：删除所有概率计算/路径匹配逻辑，改为直接读取标准化字段
3. **更新 DecisionView.vue**：移除传给组件的 `:paths` prop，简化路径匹配

## 影响

- 修改文件：`useDecisionModel.js`、`DecisionTree.vue`、`DecisionView.vue`
- 组件契约：`treeData` 节点新增 `id`/`step`/`score`/`status`/`probability`/`isDashed` 字段
- 向后兼容：适配器自动处理旧格式（`year`→`step`、`value`→`score`、`eventType`→`status`）

## 非目标

- 不修改 LLM 输出格式（由适配器兼容）
- 不引入 TypeScript（当前项目未使用）
