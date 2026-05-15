# 1. 修复 PathDetail state 未定义（P0）

- [x] 1.1 在 PathDetail.vue props 中新增 `sensitivity: { type: Object, default: null }`
- [x] 1.2 将模板中 `state.model?.sensitivity` 改为使用 props 的 `sensitivity`
- [x] 1.3 在 DecisionView.vue 中为 PathDetail 增加 `:sensitivity="state.model?.sensitivity"` 透传

## 2. 修复流水线步数不一致（P1）

- [x] 2.1 在 `server/routes/decision.js` 的 `pipelineSteps` 数组中增加 simulate 步骤（位于 build-model 和 devils 之间）
- [x] 2.2 将 `pipelineSteps` 数组和 resume 的 `pipelineSteps` 提取为共享常量或函数，确保两处定义一致
- [x] 2.3 在 `/full-pipeline` 路由中为 simulate 步骤跳过 LLM 调用，直接标记 completed 并发送 SSE 事件

## 3. 修复断点续跑为空壳（P1）

- [x] 3.1 重构 `/full-pipeline` 中的步骤循环逻辑为可复用函数
- [x] 3.2 在 `/pipeline/:id/resume` 中调用复用函数，从断点处继续执行剩余步骤
- [x] 3.3 在 resume 接口中添加 pipelineState 为空的 404 校验

## 4. 修复清除缓存无确认（P2）

- [x] 4.1 在 ParamPanel.vue 中引入 `ElMessageBox` 和 `ElMessage`
- [x] 4.2 将 `onClearCache` 改为先弹出确认对话框，确认后 emit clearCache 事件
- [x] 4.3 在 DecisionView.vue 中 clearCache 处理函数中增加成功提示
