# Spec: model-validator

## 修改需求

### 需求:统一数据验证

系统 SHALL 在 SEE Parser 组装完成 build-model 最终结果后调用 `validateModel()`，而非在单次 LLM 输出后立即调用。验证逻辑保持不变。

#### 场景:SEE 组装完成后触发验证
- **当** SEE Step 3 完成且 Parser 组装出完整的 build-model JSON
- **那么** 系统 MUST 调用 `validateModel()` 对结果进行校验，并将结果存储到 pipelineState 中

#### 场景:V2 外回路 SEE 重跑后触发验证
- **当** 外回路触发 SEE 全局重塑且 Parser 组装出新模型
- **那么** 系统 MUST 调用 `validateModel()` 收集所有 error
