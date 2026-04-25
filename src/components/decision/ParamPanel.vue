<script setup>
import { computed } from 'vue'
import { ElButton } from 'element-plus'
import ParamSlider from '../common/ParamSlider.vue'
import ParamSelect from '../common/ParamSelect.vue'

const props = defineProps({
  model: { type: Object, required: true },
  paramValues: { type: Object, required: true },
})

const emit = defineEmits(['updateParam', 'recalc'])

const componentMap = {
  slider: ParamSlider,
  select: ParamSelect,
}

function onUpdate(name, value) {
  emit('updateParam', name, value)
}

// 计算是否有滑块偏离默认值 50
const hasDeviation = computed(() => {
  if (!props.model) return false
  return props.model.variables.some(v => {
    if (v.type === 'slider') {
      return props.paramValues[v.name] !== undefined && props.paramValues[v.name] !== 50
    }
    return false
  })
})
</script>

<template>
  <div class="param-panel">
    <h3>参数调整</h3>
    <div v-if="model" class="params-list">
      <component v-for="v in model.variables" :is="componentMap[v.type]" :key="v.name" :config="v"
        :value="paramValues[v.name]" @update="onUpdate(v.name, $event)" />
    </div>
    <div v-else class="param-placeholder">
      <p>提交决策问题后，参数面板将自动生成</p>
    </div>
    <div v-if="model" class="simulate-wrapper">
      <el-button type="primary" :plain="!hasDeviation"
        :class="['btn-recalc', { 'btn-breathe': hasDeviation }]"
        @click="emit('recalc')">
        深度模拟
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.param-panel {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
}

h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--text-h, #1a1a2e);
}

.params-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-placeholder {
  color: #999;
  font-size: 13px;
  padding: 20px 0;
}

.btn-recalc {
  margin-top: 16px;
  width: 100%;
  transition: all 0.3s ease;
}

.simulate-wrapper {
  position: relative;
}

.btn-breathe {
  background-color: var(--el-color-primary) !important;
  color: #fff !important;
  border-color: var(--el-color-primary) !important;
  animation: breathe 2s ease-in-out 2;
  animation-fill-mode: forwards;
}

@keyframes breathe {
  0%, 100% {
    box-shadow: 0 0 4px rgba(64, 158, 255, 0.2);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 12px rgba(64, 158, 255, 0.5);
    transform: scale(1.02);
  }
}
</style>
