<script setup>
import { computed } from 'vue'

const props = defineProps({
  pipelineId: { type: String, default: null },
  status: { type: String, default: 'idle' }, // idle | running | completed | failed
  currentStep: { type: String, default: null },
  completedSteps: { type: Array, default: () => [] },
  mode: { type: String, default: 'quick-build' }, // quick-build | deep-validation
  innerLoopCount: { type: Number, default: 0 },
  outerLoopCount: { type: Number, default: 0 },
  innerLoopSkipped: { type: Boolean, default: false },
  outerLoopSkipped: { type: Boolean, default: false },
  outerLoopLowConfidence: { type: Boolean, default: false },
})

// Visible steps only (DEVIL steps run in background)
const steps = [
  'framework',
  'build-model',
  'simulate',
  'nexus',
]
const stepLabels = {
  framework: '框架定义',
  'build-model': '模型构建',
  simulate: '蒙特卡洛',
  nexus: '综合报告',
}

const loopStatusText = computed(() => {
  if (props.innerLoopCount > 0) {
    return '内回路已校准 1 次'
  }
  if (props.outerLoopCount > 0) {
    if (props.outerLoopLowConfidence) {
      return '外回路已重塑，置信度仍偏低'
    }
    return '外回路已重塑 1 次'
  }
  if (props.innerLoopSkipped) {
    return '内回路已跳过（已达上限）'
  }
  return ''
})

const progressPct = computed(() => {
  if (props.status === 'completed') return 100
  const idx = steps.indexOf(props.currentStep)
  if (idx === -1) return 0
  return Math.round(((idx + 0.5) / steps.length) * 100)
})
</script>

<template>
  <div class="pipeline-progress">
    <div class="pipeline-header">
      <span class="pipeline-title">{{ mode === 'deep-validation' ? '深度验证' : '多 Agent 流水线' }}</span>
      <div style="display: flex; gap: 6px; align-items: center;">
        <el-tag
          :type="status === 'completed' ? 'success' : status === 'failed' ? 'danger' : status === 'running' ? '' : 'info'"
          size="small"
        >
          {{ status === 'idle' ? '未启动' : status === 'running' ? '运行中' : status === 'completed' ? '已完成' : '失败' }}
        </el-tag>
        <el-tag v-if="innerLoopCount > 0" type="warning" size="small">内回路已校准</el-tag>
        <el-tag v-if="outerLoopCount > 0" type="danger" size="small">外回路已重塑</el-tag>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="pipeline-bar-track">
      <div class="pipeline-bar-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <!-- Step indicators -->
    <div class="pipeline-steps">
      <div v-for="step in steps" :key="step" class="pipeline-step-item" :class="{
        completed: props.completedSteps.includes(step),
        active: props.currentStep === step,
        pending: !props.completedSteps.includes(step) && props.currentStep !== step,
      }">
        <div class="pipeline-step-dot">
          <span v-if="props.completedSteps.includes(step)">✓</span>
          <span v-else-if="props.currentStep === step">·</span>
          <span v-else>○</span>
        </div>
        <span class="pipeline-step-label">{{ stepLabels[step] }}</span>
      </div>
    </div>

    <!-- Loop status text -->
    <div v-if="loopStatusText" class="loop-status-text">
      {{ loopStatusText }}
    </div>
  </div>
</template>

<style scoped>
.pipeline-progress {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
}

.pipeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.pipeline-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h, #1a1a2e);
}

.pipeline-bar-track {
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 12px;
}

.pipeline-bar-fill {
  height: 100%;
  background: var(--accent, #3b82f6);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.pipeline-steps {
  display: flex;
  justify-content: space-between;
}

.pipeline-step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.pipeline-step-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: #f0f0f0;
  color: #94a3b8;
  transition: all 0.2s;
}

.pipeline-step-item.completed .pipeline-step-dot {
  background: #059669;
  color: #fff;
}

.pipeline-step-item.active .pipeline-step-dot {
  background: var(--accent, #3b82f6);
  color: #fff;
  animation: pulse 1.5s ease-in-out infinite;
}

.pipeline-step-label {
  color: #94a3b8;
  white-space: nowrap;
}

.pipeline-step-item.completed .pipeline-step-label {
  color: #059669;
  font-weight: 500;
}

.pipeline-step-item.active .pipeline-step-label {
  color: var(--accent, #3b82f6);
  font-weight: 600;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
}

.loop-status-text {
  margin-top: 6px;
  font-size: 11px;
  color: #d97706;
  font-weight: 500;
}
</style>
