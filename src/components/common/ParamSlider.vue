<!--
 * @Author: wxw
 * @Date: 2026-04-21 20:55:39
 * @LastEditors: wxw
 * @LastEditTime: 2026-04-22 20:00:26
 * @FilePath: \decision_copilot\src\components\common\ParamSlider.vue
-->
<script setup>
import { ElSlider } from 'element-plus'

const props = defineProps({
  value: { type: Number, default: 50 },
  config: { type: Object, required: true },
})

const emit = defineEmits(['update'])

function onInput(val) {
  emit('update', val)
}
</script>

<template>
  <div class="param-slider">
    <div class="param-label">
      <span>{{ config.name }}</span>
      <span class="param-value">{{ value }}</span>
    </div>
    <el-slider :model-value="value" :min="config.range?.[0] ?? 0" :max="config.range?.[1] ?? 100" @input="onInput" />
  </div>
</template>

<style scoped>
.param-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
  color: var(--text-h);
}

.param-value {
  font-weight: 600;
  color: var(--accent, #3b82f6);
}

:deep(.el-slider__runway) {
  height: 4px;
  background: var(--border, #e5e7eb);
  border-radius: 2px;
}

:deep(.el-slider__bar) {
  height: 4px;
  background: var(--accent, #3b82f6);
  border-radius: 2px;
}

:deep(.el-slider__button-wrapper) {
  --el-slider-button-size: 14px;
}

:deep(.el-slider__button) {
  border: 2px solid var(--accent, #3b82f6);
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
</style>
