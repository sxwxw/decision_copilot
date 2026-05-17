## 上下文

代码审查发现 7 个已验证运行时缺陷。`four-layer-arch-refactor` 变更正在做前端大重构，但修复不依赖该重构完成，可独立合并。

**约束**：
- 不改变 API 接口签名
- 不改变 LLM Prompt
- 不改变用户可见功能行为
- 不引入新依赖

## 目标 / 非目标

**目标：**
- 修复 SSE 流无取消机制（高严重度）
- 修复 pipeline 状态内存泄漏
- 修复 SSE backpressure 数据丢失
- 修复 D3 全量重建 DOM 性能问题
- 修复 enrichPathChain timeline 错位匹配
- 清理死代码文件
- 修复 resize 监听器泄漏

**非目标：**
- 不做架构层重构
- 不改写 SSE 通信协议
- 不修改 LLM 输出格式或 Prompt

## 决策

### 1. AbortController 实现位置

**选择**：直接在 `useDecisionModel.js` 中内联实现，不启用 `sseClient.js`

**理由**：
- 当前 composable 使用 `fetch()` + `reader.read()` 模式，只需添加 `AbortController` + `signal` 传递即可
- `sseClient.js` 是规划中的独立模块但从未被 import，启用它会引入额外的抽象层
- 保持最小改动量——只需修改 3 处：`useDecisionModel.js`（创建/传递 controller）、`runFullPipeline` 函数签名（接收 signal）、`onSubmit` 重复提交时 abort

### 2. pipelineState 清理策略

**选择**：LRU（保留最近 100 条）+ TTL（24 小时过期），在每次新 pipeline 创建时触发清理

**理由**：
- 不引入 Redis/外部存储——保持当前 in-memory 架构
- 每次创建时清理开销可忽略（O(N log N) 排序，N ≤ 200 条/天）
- 断点续传场景下，24 小时 TTL 足够覆盖用户中断后恢复的使用场景

### 3. SSE backpressure 处理

**选择**：检查 `res.write()` 返回值，返回 `false` 时 await `drain` 事件

**理由**：
- 当前 `sendEvent` 只检查 `res.writableEnded`，忽略了 backpressure
- 在 LLM 流式输出（快速写入大量 SSE events）+ 慢网络场景下，Node.js 内部缓冲区会溢出
- `drain` 等待是 Node.js 官方推荐做法，无需额外依赖

### 4. D3 增量渲染

**选择**：将 `watch(() => props.treeData, { deep: true })` 拆分为：
- `watch(() => props.treeData?.children?.length)` → 结构变更，调用 `renderTree()` 全量重建
- `watch(() => props.adjustedProbMap)` → 已有，只更新 label text
- 保留 `watch(() => props.selectedNode)` → 已有，只更新高亮状态

**理由**：
- `recalcScores()` 修改 `state.paramValues`（触发浅拷贝），同时 bump `treeData._version`
- `_version` 变化被 deep watch 捕获导致全量重建，但树结构未变
- 拆分后，调参时只更新概率 label（已有的增量更新逻辑），不调用 `renderTree()`

**风险**：如果未来有 treeData 深层属性变更需要触发重绘（如节点颜色随分数变化），需要新增对应的 watch。当前不存在此类需求。

### 5. enrichPathChain 匹配策略

**选择**：移除 `idx - 2` 的 positional fallback，改用编辑距离（Levenshtein）做模糊匹配，设置相似度阈值 0.6

**理由**：
- `includes` 模糊匹配无法处理 "成本可控" vs "成本控制" 这类同义不同词的匹配
- `idx - 2` positional fallback 在 timeline 事件数 < chain 节点数时必然错位
- 编辑距离能识别形近词，阈值 0.6 防止误匹配

**替代方案（已否决）**：引入中文分词库做语义匹配——引入新依赖，违反约束。

### 6. resize 监听器清理

**选择**：在 `onBeforeUnmount` 中清理 `document.removeEventListener`

**理由**：
- 当前应用只有 `/decision` 单路由，组件永远不会卸载
- 但这是防御性编程——未来新增路由时不会遗漏
- 实现成本极低（2 行代码）

### 7. 死代码清理

**选择**：删除 `src/services/sseClient.js` 和 `src/engines/pipelineStateMachine.js`

**理由**：
- `grep -r "import.*sseClient" src/` 和 `grep -r "import.*pipelineStateMachine" src/` 均为空
- 这两个文件是 `four-layer-arch-refactor` 的规划产物，从未被使用
- 保留会增加认知负担

## 风险 / 权衡

[风险] → AbortController 在 Mock 模式下不会真正中断服务端执行
[缓解] → Mock 模式 (`USE_REAL_LLM !== "true"`) 下 pipeline 瞬间完成，取消需求不存在

[风险] → pipelineState 的 LRU 可能删掉用户正准备 resume 的 pipeline
[缓解] → 24h TTL 覆盖绝大多数 resume 场景；被清理后 resume 返回 404 是合理降级

[风险] → D3 拆分 watch 后，未来新增的深层属性变化可能不触发重绘
[缓解] → 当前无此类需求；若未来需要，可新增针对性 watch

[风险] → 编辑距离匹配对中文效果有限（"成本可控" vs "成本降低" 编辑距离仍可能低于阈值）
[缓解] → 保留 includes 作为第二 fallback，编辑距离失败时回退到现有 includes 逻辑
