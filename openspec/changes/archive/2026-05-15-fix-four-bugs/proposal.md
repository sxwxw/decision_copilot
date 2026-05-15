## 为什么

代码审阅发现 4 个已确认缺陷，其中 1 个导致功能白屏（P0），2 个影响核心功能完整性（P1），1 个影响用户体验（P2）。这些问题在前 8 个变更的迭代中累积产生，需要集中修复。

## 变更内容

修复以下 4 个缺陷：

1. **P0 — PathDetail.vue 中 `state` 未定义**：敏感性分析 Tab 使用了未声明的 `state` 变量，导致组件挂载失败白屏
2. **P1 — 流水线步数不一致**：前端定义了 5 步（含 simulate），后端只跑 4 步，导致 simulate 步骤永远显示为待处理
3. **P1 — 断点续跑为空壳**：`/pipeline/:id/resume` 接口仅更新状态标记，不调用 LLM 执行剩余步骤
4. **P2 — 清除缓存无确认无反馈**：误触即丢数据，无确认弹窗和成功提示

## 功能 (Capabilities)

### 新增功能
<!-- 无新增功能 -->

### 修改功能

- `multi-agent-pipeline`: 修复流水线步数定义对齐、断点续跑实际执行剩余步骤
- `sensitivity-analysis`: 修复 PathDetail 组件中 state 变量引用方式
- `local-persistence`: 清除缓存增加确认弹窗和成功提示

## 影响

- `src/components/decision/PathDetail.vue` — 修复 state 引用
- `server/routes/decision.js` — 流水线步列表增加 simulate，断点续跑增加 LLM 调用
- `src/components/decision/ParamPanel.vue` — 清除缓存增加确认
- `src/components/decision/PipelineProgress.vue` — 步列表与后端对齐
