## 新增需求

### 需求:localStorage 自动保存

系统 SHALL 在决策模型构建或深度模拟完成后，自动将模型数据保存到 localStorage。

#### 场景:自动保存模型
- **当** `buildModel()` 或 `runMonteCarlo()` 完成
- **那么** 将 state.model + state.paramValues 序列化存入 localStorage

### 需求:localStorage 自动恢复

系统 SHALL 在页面加载时检查 localStorage，存在已保存的模型数据时自动恢复。

#### 场景:恢复已保存的模型
- **当** 页面加载且 localStorage 中存在决策模型数据
- **那么** 恢复模型状态，展示"已从本地缓存恢复"提示

#### 场景:无缓存数据
- **当** 页面加载且 localStorage 中不存在决策模型数据
- **那么** 正常初始化，不展示提示

### 需求:清除缓存入口

系统 SHALL 在 UI 中提供"清除本地缓存"按钮。

#### 场景:用户清除缓存
- **当** 用户点击"清除缓存"按钮
- **那么** 删除 localStorage 中的决策模型数据，展示成功提示
