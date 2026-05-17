# Spec: local-persistence

## 修改需求

### 需求:持久化层独立于业务逻辑

系统 SHALL 将 localStorage 读写操作从业务 composable 剥离至独立基础设施层。

#### 场景:业务层不直接访问 localStorage
- **当** 业务逻辑需要保存或加载状态
- **那么** 通过 storage.save/load 接口调用，不直接操作 window.localStorage
