# Spec: devil-review

## 修改需求

### 需求:异步调用链完整性

系统 SHALL 确保魔鬼审查的异步调用被正确 await，错误信息 SHALL 上报到 UI。

#### 场景:异步调用被正确等待
- **当** 调用 runDevilReview
- **那么** 调用方 await 该函数，不继续执行直到完成或失败

#### 场景:错误上报到 UI
- **当** LLM API 返回 500 或网络错误
- **那么** 用户看到 ElMessage 错误提示，审查标签显示错误信息而非空白

## 新增需求

### 需求:Devil 结果持久化时机

系统 SHALL 在魔鬼审查完成后才调用 saveToStorage，确保 devilResult 被正确保存。

#### 场景:模拟完成后持久化
- **当** 蒙特卡洛和魔鬼审查都完成
- **那么** saveToStorage 包含最新的 state.devilResult
