# spec: storage-service

## 新增需求

### 需求:localStorage 持久化

系统 SHALL 提供独立存储层 `storage`，封装 localStorage 读写，包含版本管理和错误处理。

#### 场景:保存状态
- **当** 调用 storage.save(key, value)
- **那么** 数据以 `{ version, timestamp, data }` 格式写入 localStorage

#### 场景:加载状态
- **当** 调用 storage.load(key)
- **那么** 如果 key 存在且格式正确，返回 data；否则返回 null

#### 场景:localStorage 满或不可用
- **当** localStorage 写入失败（配额满、隐私模式等）
- **那么** storage.save 静默失败，不抛出异常

#### 场景:清除状态
- **当** 调用 storage.clear()
- **那么** 移除所有 decision-copilot 前缀的 key
