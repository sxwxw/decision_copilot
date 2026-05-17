# spec: model-validator

## 新增需求

### 需求:统一数据验证

系统 SHALL 提供纯 JavaScript 验证函数 `validateModel(model)`，不依赖任何框架或环境，前后端共享使用。

#### 场景:有效模型验证通过
- **当** 模型包含 weights（0-100）、scores（0-100）、delta（0-1）、paths（概率和在 0.99-1.01 范围内）、variables（权重和为 100±1）
- **那么** validateModel 返回 `{ valid: true }`

#### 场景:权重范围校验失败
- **当** 任何 weight 值 < 0 或 > 100
- **那么** validateModel 返回 `{ valid: false, error: 具体错误信息 }`

#### 场景:路径概率和校验
- **当** 同一选项下的路径概率和与 1.0 的偏差超过 0.01
- **那么** validateModel 返回警告但不拒绝（warning 而非 error）

#### 场景:trade_offs 维度校验
- **当** trade_offs 数组维度数与 variables 数量不一致
- **那么** validateModel 返回 `{ valid: false, error: 'trade_offs 维度与变量不匹配' }`

### 需求:统一数据清洗

系统 SHALL 提供 `sanitizeModel(rawModel)` 函数，过滤非法字段、补全默认值、派生缺失的 trade_offs。

#### 场景:清洗后 trade_offs 补全
- **当** 选项节点缺少 trade_offs 但存在逻辑推导所需数据
- **那么** sanitizeModel 自动派生缺失的 trade_offs 维度

#### 场景:清洗后去除非法字段
- **当** 输入模型包含未在变量声明中定义的字段的值
- **那么** sanitizeModel 过滤掉未知字段
