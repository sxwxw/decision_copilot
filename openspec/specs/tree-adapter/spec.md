# spec: tree-adapter

## 新增需求

### 需求:决策树适配

系统 SHALL 提供纯 JS 树适配器 `treeAdapter`，将 LLM 原始输出标准化为前端组件契约。

#### 场景:树结构标准化
- **当** adaptTree 接收原始树数据和路径列表
- **那么** 为每个节点生成唯一 id，去除 name 中的层级前缀，根据 step 设置 isDashed

#### 场景:路径引用构建
- **当** 调用 buildPathRefs
- **那么** 每个节点通过事件名匹配被关联到对应路径的 pathIds 数组

#### 场景:节点匹配容错
- **当** 事件名无法精确匹配时
- **那么** 尝试部分匹配，再降级到位置 fallback，最后返回 null（不返回 undefined）

### 需求:树路径链构建

系统 SHALL 提供 `buildPathChain(treeData, selectedNodeId)` 构建从根到选中节点的完整路径链。

#### 场景:正常路径链构建
- **当** selectedNodeId 存在于树中
- **那么** 返回包含从根到该节点所有祖先节点的数组

#### 场景:节点不存在
- **当** selectedNodeId 不在树中
- **那么** 返回空数组
