# Spec: model-validator

## 修改需求

### 需求:统一数据验证

系统 SHALL 在 SEE Parser 组装完成 build-model 最终结果后调用 `validateModel()`。验证逻辑 SHALL 扩展新增拓扑完备性校验（孤立节点/断头路）和因果循环检测。

#### 场景:SEE 组装完成后触发验证
- **当** SEE Step 3 完成且 Parser 组装出完整的 build-model JSON
- **那么** 系统 MUST 调用 `validateModel()` 对结果进行校验，并将结果存储到 pipelineState 中

#### 场景:V2 外回路 SEE 重跑后触发验证
- **当** 外回路触发 SEE 全局重塑且 Parser 组装出新模型
- **那么** 系统 MUST 调用 `validateModel()` 收集所有 error

#### 场景:检测拓扑完备性 — 孤立节点
- **当** treeData 中存在有父无子或有子无父的节点（非叶子/非根节点）
- **那么** `validateModel()` MUST 返回 `severity: "error"` 的校验错误

#### 场景:检测拓扑完备性 — 断头路
- **当** 某条路径中途终止且无终审损益表现
- **那么** `validateModel()` MUST 返回 `severity: "error"` 的校验错误

#### 场景:检测因果循环
- **当** treeData 的因果链中存在 A → B → C → A 的拓扑环路
- **那么** `validateModel()` MUST 返回 `severity: "warning"` 的校验结果，标识环路涉及的节点路径
