<script setup>
import { computed } from 'vue'
import { ElButton, ElMessageBox, ElMessage } from 'element-plus'
import ParamSlider from '../common/ParamSlider.vue'

const props = defineProps({
  model: { type: Object, default: null },
  paramValues: { type: Object, required: true },
})

const emit = defineEmits(['updateParam', 'reset'])

const componentMap = {
  slider: ParamSlider,
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

async function onClearCache() {
  try {
    await ElMessageBox.confirm('确定要清除本地缓存吗？此操作不可撤销。', '确认清除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    emit('clearCache')
    ElMessage.success('缓存已清除')
  } catch {
    // user cancelled
  }
}
</script>

<template>
  <div class="param-panel">
    <div class="panel-header">
      <h3>参数调整</h3>
      <button v-if="model" class="btn-reset" :class="{ 'has-deviation': hasDeviation }" @click="emit('reset')">重置</button>
    </div>
    <div v-if="model" class="params-container">
      <div class="params-list">
        <component v-for="v in model.variables" :is="componentMap[v.type]" :key="v.name" :config="v"
          :value="paramValues[v.name]" @update="onUpdate(v.name, $event)" />
      </div>
    </div>
    <div v-else class="param-placeholder">
      <p>提交决策问题后，参数面板将自动生成</p>
    </div>
  </div>
</template>

<style scoped>
.param-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--text-h, #1a1a2e);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 0;
}

.btn-reset {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-reset:hover {
  color: var(--accent, #3b82f6);
  background: rgba(59, 130, 246, 0.06);
}

.btn-reset.has-deviation {
  color: var(--accent, #3b82f6);
}

.params-container {
  width: 100%;
  height: 300px;
  overflow-y: auto;
  padding: 0 16px;
  scrollbar-gutter: stable;
}

.params-container::-webkit-scrollbar {
  width: 6px;
}

.params-container::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.3s;
}

.params-container:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.params-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.param-placeholder {
  color: #999;
  font-size: 13px;
  padding: 20px 16px;
}
</style>
