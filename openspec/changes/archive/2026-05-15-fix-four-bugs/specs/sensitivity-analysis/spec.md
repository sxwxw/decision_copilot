## 新增需求

### 需求:敏感性分析结果透传

PathDetail.vue 组件 SHALL 通过 props 接收敏感性分析结果，而非直接引用父组件的 state 对象。

#### 场景:PathDetail 组件渲染敏感性分析 Tab
- **当** 用户切换到"敏感性分析" Tab
- **那么** PathDetail 使用 props 中的 `sensitivity` 数据渲染 SensitivityAnalysis 组件
- **那么** 不依赖任何未声明的 state 变量
