<script setup>
import { ElSelect, ElOption } from 'element-plus'

const props = defineProps({
  value: { type: String, default: '' },
  config: { type: Object, required: true },
})

const emit = defineEmits(['update'])

function onInput(val) {
  emit('update', val)
}
</script>

<template>
  <div class="param-select">
    <div class="param-label">{{ config.name }}</div>
    <el-select
      :model-value="value"
      :placeholder="'请选择'"
      @change="onInput"
    >
      <el-option
        v-for="opt in config.options"
        :key="opt"
        :label="opt"
        :value="opt"
      />
    </el-select>
  </div>
</template>

<style scoped>
.param-select {
  padding: 8px 0;
}
.param-label {
  font-size: 13px;
  margin-bottom: 4px;
  color: var(--text-h);
}
</style>
