<script setup>
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
</script>

<template>
  <div class="param-panel">
    <h3>参数调整</h3>
    <div v-if="model" class="params-list">
      <component
        v-for="v in model.variables"
        :is="componentMap[v.type]"
        :key="v.name"
        :config="v"
        :value="paramValues[v.name]"
        @update="onUpdate(v.name, $event)"
      />
    </div>
    <div v-else class="param-placeholder">
      <p>提交决策问题后，参数面板将自动生成</p>
    </div>
    <el-button v-if="model" type="primary" plain class="btn-recalc" @click="emit('recalc')">
      深度模拟
    </el-button>
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
}
</style>
