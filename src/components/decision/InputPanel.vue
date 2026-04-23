<!--
 * @Author: wxw
 * @Date: 2026-04-22 19:51:28
 * @LastEditors: wxw
 * @LastEditTime: 2026-04-22 19:53:11
 * @FilePath: \decision_copilot\src\components\decision\InputPanel.vue
-->
<script setup>
import { ref } from 'vue'
import { ElInput, ElButton } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['submit'])

const text = ref('')

function handleSubmit() {
  if (text.value.trim()) {
    emit('submit', text.value)
  }
}
</script>

<template>
  <div class="input-panel">
    <h3>决策问题</h3>
    <el-input v-model="text" type="textarea" :rows="5" :disabled="loading"
      placeholder="描述你的决策问题，例如：我在考虑要不要从大厂跳槽去创业公司..." show-word-limit :maxlength="500" resize="none" />
    <el-button type="primary" class="btn-submit" :disabled="loading || !text.trim()" :loading="loading"
      :icon="loading ? Loading : undefined" @click="handleSubmit">
      {{ loading ? '建模中...' : '提交建模' }}
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

:deep(.el-textarea__inner) {
  font-family: inherit;
  resize: none;
}
</style>
