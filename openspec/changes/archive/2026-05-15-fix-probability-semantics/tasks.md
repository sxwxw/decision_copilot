## 1. 概率归一化

- [x] 1.1 在 `recalcProbabilities()` 末尾增加归一化步骤，确保路径概率总和 ≈ 1.0
- [x] 1.2 处理边界情况：当概率总和为 0 时均匀分配

## 2. 量纲修复

- [x] 2.1 修改 alignment 公式，将 impact delta 映射到 0~100 偏好空间
- [x] 2.2 验证映射后 alignment 值在 [0, 1] 范围内

## 3. 分数归因动态化

- [x] 3.1 重构 `getScoreAttribution()`，移除硬编码中文字符串
- [x] 3.2 从 `logic_payload.trade_offs` 动态组装归因文本
