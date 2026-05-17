# Tasks: three-layer-arch-refactor

## 1. 确定性映射层

- [x] 1.1 创建 `src/shared/qualitativeMap.js`，定义概率标签（极高/高/中/低/极低）到数值（0.90/0.70/0.50/0.25/0.05）的映射表
- [x] 1.2 定义 delta 标签（强正向~强负向）到数值（15/10/5/0/-5/-10/-15）的映射表
- [x] 1.3 在 `sanitizeModel()` 中插入定性标签映射逻辑：检测到 qualitative_label 时查表转换为数值
- [x] 1.4 在 `sanitizeModel()` 中加入标签缺失兜底：使用 LLM 数值时记录 warning 日志

## 2. 拓扑错误拦截增强

- [x] 2.1 在 `modelValidator.js` 中将路径概率和校验从 warning 升级为 error 级别（当偏差 > 0.10 时）
- [x] 2.2 在 `sanitizeModel()` 中集成 `probNormalizer.js`，对概率和偏离 1.0 的路径自动归一化
- [x] 2.3 权重和偏离 1.0 时自动按比例缩放至和为 1.0

## 3. 管线定量校验注入

- [x] 3.1 在 `executePipelineSteps` 的 build-model 步骤后调用 `validateModel()`，结果存入 pipelineState
- [x] 3.2 在 devil-model 步骤的 userPrompt 中注入定量校验结果
- [x] 3.3 在 devil-simulate 步骤的 userPrompt 中注入定量校验结果
- [x] 3.4 扩展内回路触发条件：error 级别或概率相关 warning 也触发回溯

## 4. V2 外回路三锁机制

- [x] 4.1 第一锁：V2 build-model 完成后强制调用 `validateModel()`
- [x] 4.2 第二锁：发现 error 时在 confidenceSignals 中注入"**数据异常报警**"标记
- [x] 4.3 第二锁：Nexus 完成后若校验有 error 则强制将 confidence_level 设为 40
- [x] 4.4 第三锁：将校验错误信息注入 Nexus Prompt，使终审 Agent 能进行批判

## 5. Prompt 语义层改造

- [x] 5.1 改造 DECISION_MODEL_DEEP_PROMPT：要求 LLM 输出 probability_label 而非数值概率
- [x] 5.2 改造 DECISION_MODEL_DEEP_PROMPT：要求 LLM 输出 delta_label 而非数值 delta
- [x] 5.3 改造 DECISION_MODEL_DEEP_PROMPT：添加"禁止输出精确概率/权重数值"约束条款
- [x] 5.4 更新 DECISION_FRAMEWORK_PROMPT：输出 qualitative_description
- [x] 5.5 更新 DEVIL 系列 Prompt：增加对定性标签一致性的审查要求

## 6. 前端展示优化

- [x] 6.1 在 PathDetail.vue 中为分数变化添加方向箭头（↑/↓）和高亮标注
- [x] 6.2 在 NexusReport.vue 中增加数据异常时的"量化基础不通过"批判展示
- [x] 6.3 清理 SensitivityAnalysis.vue 的残留 import（已隐藏 Tab）

## 7. 端到端验证

- [ ] 7.1 使用视频旁白稿问题触发完整管线，验证定性标签→数值映射
- [ ] 7.2 验证路径概率和自动归一化生效
- [ ] 7.3 验证 V2 外回路三锁触发条件（可通过构造错误模型测试）
