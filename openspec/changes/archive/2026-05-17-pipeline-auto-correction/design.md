## 上下文

当前 8 步管线完成后，`build-model` 结果直接展示。nexus 输出 `confidence_level`（0-100）仅用于 UI 展示，不触发修正。devil 审查意见只作为"旁白"。

## 目标 / 非目标

**目标：**
- 内回路：devil-model 发现 CRITICAL 级别问题时，自动回溯到 build-model 修正（最多 1 次）
- 外回路：nexus 置信度 < 60% 时，从 build-model 开始重跑管线含仿真（最多 1 次）
- 用户可手动触发修正
- 外回路从 build-model 开始（不从 framework，框架维度通常有效）

**非目标：**
- 不循环修正（内/外回路各最多 1 次）
- 外回路不从 framework 开始
- 不修改 options 列表和 weights key

## 决策

### 1. 内回路：原子级校准 vs 旁白式审查

**选择：结构化修正指令。** devil-model 必须返回包含 `requires_refactor`、`severity`、`target_dimension` 的结构化 JSON。当 `requires_refactor: true` 且 `severity: "CRITICAL"` 时，管线原地回溯到 build-model。

**理由**：旁白式审查只给人类看，机器无法判断是否需要修正。结构化输出使管线具备自校准能力。

### 2. 外回路：从 build-model 重跑 vs 独立修正步骤

**选择：从 build-model 重跑裁剪版 3 步管线。** 当置信度 < 60% 时，将"败因上下文"注入 build-model prompt，执行 build-model → simulate → nexus，跳过 4 个 Devil 步骤。V2 本身就是基于 Devil 意见修正出来的，不需要让 Devil 自己审自己。

**理由**：独立修正步骤只能微调已有模型。外回路需要重新评估 trade_offs 和 treeData，必须重跑仿真验证修正效果。从 build-model 开始（非 framework）因为框架维度定义通常仍有效。裁剪掉 4 个 Devil 步骤可将外回路耗时缩短 60%+。

### 3. 置信度阈值

**选择：< 60% 触发外回路。** 对应 nexus prompt 中"存在部分疑问但不影响核心结论"的分界线。

### 4. 修正后是否重新评估置信度

**选择：是。** 外回路重跑后，新 nexus 会输出新的置信度。如果仍然 < 60%，不再循环（外回路最多 1 次），但 UI 会明确告知用户"置信度仍然偏低"。

### 5. 动态 loading 文案

**选择：通过 SSE 事件推送管线状态变化。** 后端在触发内回路/外回路时发送 `event: status` 事件，前端在 `runPipeline` 中解析并更新 `state.pipelineLoadingText`，`v-loading` 的 `element-loading-text` 绑定该值。

**文案映射：**

| 状态         | 文案                           |
| ------------ | ------------------------------ |
| 正常执行     | AI 正在推演中...               |
| 内回路回溯   | 发现关键问题，正在自我校准...  |
| 外回路 V2    | 置信度不足，正在重塑模型...    |

## 风险 / 权衡

[内回路可能无限循环] → 限制最多 1 次，超出则标记为 `inner-loop-skipped` 继续
[外回路耗时翻倍] → 外回路只在置信度 < 60% 时触发，正常流程不增加耗时
[修正后仍低置信度] → UI 显示明确提示，建议用户调整输入后重新建模
[LLM 不遵循结构化输出] → prompt 中强制 JSON schema + 重试机制（retries: 2）
