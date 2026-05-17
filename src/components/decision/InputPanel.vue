<!--
 * @Author: wxw
 * @Date: 2026-04-22 19:51:28
 * @LastEditors: wxw
 * @LastEditTime: 2026-04-22 19:53:11
 * @FilePath: \decision_copilot\src\components\decision\InputPanel.vue
-->
<script setup>
import { ref } from 'vue'
import { ElInput, ElButton, ElSelect, ElOption } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['submit'])

const text = ref('')
const riskPreference = ref('均衡')

const riskOptions = [
  { value: '保守', label: '保守 — 优先稳健，规避高风险' },
  { value: '均衡', label: '均衡 — 风险与收益兼顾' },
  { value: '激进', label: '激进 — 追求高回报，接受高风险' },
]

function handleSubmit() {
  if (text.value.trim()) {
    emit('submit', text.value, riskPreference.value)
  }
}
</script>

<template>
  <div class="input-panel">
    <h3>决策问题</h3>
    <el-input v-model="text" type="textarea" :rows="5" :disabled="loading"
      placeholder="描述你的决策问题，例如：公司要开拓新市场，我该选择哪个区域作为试点？" show-word-limit :maxlength="500" resize="none" />
    <div class="risk-selector-row">
      <span class="risk-label">风险偏好</span>
      <el-select v-model="riskPreference" :disabled="loading" size="small" class="risk-select">
        <el-option v-for="opt in riskOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
    </div>
    <el-button type="primary" class="btn-submit" :disabled="loading || !text.trim()" :loading="loading"
      :icon="loading ? Loading : undefined" @click="handleSubmit">
      {{ loading ? '推演中...' : '开始推演' }}
    </el-button>
  </div>
</template>

<style scoped>
.input-panel {
  padding: 16px;
}

h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--text-h, #1a1a2e);
}

.btn-submit {
  margin-top: 12px;
  width: 100%;
}

.risk-selector-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.risk-label {
  font-size: 13px;
  color: var(--text, #555);
  white-space: nowrap;
}

.risk-select {
  flex: 1;
}

:deep(.el-textarea__inner) {
  font-family: inherit;
  resize: none;
}

:deep(.el-textarea__inner::-webkit-scrollbar) {
  width: 6px;
}

:deep(.el-textarea__inner::-webkit-scrollbar-thumb) {
  background: transparent;
  border-radius: 3px;
  transition: background 0.3s;
}

:deep(.el-textarea__inner:hover::-webkit-scrollbar-thumb) {
  background: rgba(0, 0, 0, 0.2);
}
</style>
