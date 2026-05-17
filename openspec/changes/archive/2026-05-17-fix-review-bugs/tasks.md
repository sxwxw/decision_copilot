## 1. 清理死代码

- [x] 1.1 删除 `src/services/sseClient.js`（零处 import）
- [x] 1.2 删除 `src/engines/pipelineStateMachine.js`（零处 import）

## 2. SSE AbortController

- [x] 2.1 在 `src/api/decision.js` 的 `runFullPipeline` 函数中添加 `{ signal }` 可选参数
- [x] 2.2 在 `src/composables/useDecisionModel.js` 的 `runPipeline` 函数中创建 AbortController 实例
- [x] 2.3 在 `runPipeline` 启动新 pipeline 前 abort 旧 controller
- [x] 2.4 在 `runPipeline` 的 catch 块中识别 AbortError 并静默返回
- [x] 2.5 在 `onSubmit`（DecisionView.vue）中确保重复提交时旧 pipeline 被取消

## 3. Pipeline 内存回收（后端）

- [x] 3.1 在 `server/routes/decision.js` 中为 pipelineState entry 添加 `createdAt` 字段
- [x] 3.2 实现 `cleanupPipelineState()` 函数（LRU 100 条 + 24h TTL）
- [x] 3.3 在 `/full-pipeline` 路由中创建 pipeline 后调用 cleanupPipelineState

## 4. SSE Backpressure

- [x] 4.1 修改 `sendEvent` 函数检查 `res.write()` 返回值
- [x] 4.2 当 `res.write()` 返回 `false` 时 await `drain` 事件

## 5. D3 增量渲染

- [x] 5.1 将 `watch(() => props.treeData, { deep: true })` 改为 `watch(() => props.treeData?.children?.length)`
- [x] 5.2 保留 `watch(() => props.adjustedProbMap)` 的增量 label 更新逻辑（已有）
- [x] 5.3 保留 `watch(() => props.selectedNode)` 的高亮状态更新逻辑（已有）
- [x] 5.4 验证调参后决策树节点不重建、仅概率标签更新

## 6. enrichPathChain Timeline 匹配修复

- [x] 6.1 实现 `editDistance(a, b)` 函数（Levenshtein 距离）
- [x] 6.2 将 `enrichPathChain` 中的 includes 模糊匹配替换为编辑距离 + 阈值 0.6
- [x] 6.3 移除 `idx - 2` 的 positional fallback
- [x] 6.4 编辑距离匹配失败时回退到 includes 作为第二 fallback

## 7. Resize 监听器清理

- [x] 7.1 在 DecisionView.vue 的 `onBeforeUnmount` 中清理 `mousemove`/`mouseup` 事件监听器
- [x] 7.2 确保 `startResize` 和 `startResizeBottom` 的 handler 引用可被清理
