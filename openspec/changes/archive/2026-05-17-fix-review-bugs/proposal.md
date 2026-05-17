## 为什么

代码审查发现 7 个已验证的运行时缺陷：SSE 流无取消机制（刷新页面后服务端继续执行 LLM 调用链，浪费 API 配额）、pipeline 状态内存无限增长（长运行后 OOM）、D3 全量重建 DOM（滑块拖动时性能抖动）、路径链 timeline 错位匹配、resize 监听器泄漏、死代码残留等。虽然 `four-layer-arch-refactor` 变更正在做架构重构，但这些问题需要独立修复，不依赖大重构的完成。

## 变更内容

针对性修复 7 个已知运行时缺陷，不改变用户可见功能行为，不引入新架构模式。

- **新增 AbortController 管理**：为 SSE pipeline 流添加取消机制，重复提交或页面导航时自动中断
- **新增 pipeline 内存回收**：为 in-memory pipelineState 添加 LRU + TTL 清理机制
- **修复 SSE backpressure**：sendEvent 检查 res.write() 返回值并等待 drain
- **修复 D3 增量渲染**：deep watch 拆分为结构变更 watch 和数据变更 watch，避免全量重建
- **修复 enrichPathChain 匹配**：用编辑距离替代简单 includes 模糊匹配，移除危险的 positional fallback
- **清理死代码**：删除未被 import 的 sseClient.js 和 pipelineStateMachine.js
- **修复 resize 监听器泄漏**：onBeforeUnmount 清理 document 事件监听

**非目标**：不做架构重构、不修改 API 接口签名、不改变 LLM Prompt、不改变用户可见功能行为

## 功能 (Capabilities)

### 新增功能
- `sse-abort-control`: SSE 流生命周期管理，支持 AbortController 取消、重复提交时自动中断旧连接
- `pipeline-memory-management`: pipelineState 内存回收机制，LRU + TTL 清理

### 修改功能
- `multi-agent-pipeline`: 修复 SSE 流无取消、无 backpressure 处理、sendEvent 吞数据的问题
- `decision-tree`: 修复 deep watch 触发全量 DOM 重建的性能问题，改为增量更新
- `path-detail-rendering`: 修复 enrichPathChain timeline 匹配错位，改用编辑距离
- `local-persistence`: 清理死代码文件 sseClient.js、pipelineStateMachine.js
- `sensitivity-engine`: resize 监听器生命周期修复

## 影响

**受影响的文件**：
- `src/composables/useDecisionModel.js` — 新增 AbortController、修复 enrichPathChain
- `src/api/decision.js` — 新增 signal 参数传递
- `src/components/decision/DecisionTree.vue` — 拆分 deep watch
- `src/views/DecisionView.vue` — resize 监听器清理
- `server/routes/decision.js` — SSE backpressure、pipelineState 清理
- `src/services/sseClient.js` — 删除（死代码）
- `src/engines/pipelineStateMachine.js` — 删除（死代码）
