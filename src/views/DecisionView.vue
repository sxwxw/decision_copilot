<script setup>
import { ref, onBeforeUnmount, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import InputPanel from '../components/decision/InputPanel.vue'
import ParamPanel from '../components/decision/ParamPanel.vue'
import DecisionTree from '../components/decision/DecisionTree.vue'
import PathDetail from '../components/decision/PathDetail.vue'
import PipelineProgress from '../components/decision/PipelineProgress.vue'
import { useDecisionModel } from '../composables/useDecisionModel'
import { ElMessageBox, ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()

const { state, recalcScores, runPipeline, runDevilReview, runModelCorrection, clearStorage, selectNode,
  getAdjustedScore, getScoreAttribution,
  pipelineDevil, pipelineNexus, loadingDisplay, loadDemoData, loadMockData } = useDecisionModel()

function goHome() {
  router.push('/')
}

const leftPanelWidth = ref(300)
const MIN_LEFT = 260
const MAX_LEFT = 600
const bottomHeight = ref(300)
const MIN_BOTTOM = 200
const MAX_BOTTOM = 800

const resizeHandlers = ref({
  topMove: null,
  topUp: null,
  bottomMove: null,
  bottomUp: null,
})

function startResize(e) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = leftPanelWidth.value

  const onMouseMove = (e2) => {
    const dx = e2.clientX - startX
    leftPanelWidth.value = Math.min(MAX_LEFT, Math.max(MIN_LEFT, startWidth + dx))
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    resizeHandlers.value.topMove = null
    resizeHandlers.value.topUp = null
  }

  resizeHandlers.value.topMove = onMouseMove
  resizeHandlers.value.topUp = onMouseUp
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function startResizeBottom(e) {
  e.preventDefault()
  const startY = e.clientY
  const startH = bottomHeight.value

  const onMouseMove = (e2) => {
    const dy = startY - e2.clientY
    bottomHeight.value = Math.min(MAX_BOTTOM, Math.max(MIN_BOTTOM, startH + dy))
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    resizeHandlers.value.bottomMove = null
    resizeHandlers.value.bottomUp = null
  }

  resizeHandlers.value.bottomMove = onMouseMove
  resizeHandlers.value.bottomUp = onMouseUp
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onSubmit(input, riskPreference) {
  state.userInput = input
  state.riskPreference = riskPreference
  runPipeline()
}

let _debounceTimer = null

function onUpdateParam(name, value) {
  state.paramValues[name] = value
  clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    recalcScores()
  }, 300)
}

function onNodeClick(nodeData) {
  selectNode(nodeData)
}

function onResetCounterfactual() {
  // Reset params to default values (50 for sliders, second option for selects)
  for (const v of state.model?.variables || []) {
    if (v.type === 'select') {
      state.paramValues[v.name] = v.options?.[1] ?? v.options?.[0] ?? '均衡'
    } else {
      state.paramValues[v.name] = 50
    }
  }
}

async function onClearCache() {
  try {
    await ElMessageBox.confirm('确定要清除本地缓存吗？此操作不可撤销。', '确认清除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    clearStorage()
    ElMessage.success('缓存已清除')
  } catch {
    // user cancelled
  }
}

/** 最高权重的偏好参数名称 */
const topWeightParam = computed(() => {
  if (!state.model?.weights) return ''
  const entries = Object.entries(state.model.weights)
  if (!entries.length) return ''
  return entries.reduce((a, b) => b[1] > a[1] ? b : a)[0]
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', resizeHandlers.value.topMove)
  document.removeEventListener('mouseup', resizeHandlers.value.topUp)
  document.removeEventListener('mousemove', resizeHandlers.value.bottomMove)
  document.removeEventListener('mouseup', resizeHandlers.value.bottomUp)
})

onMounted(async () => {
  const demoId = route.query.demo
  if (demoId === 'mock') {
    const mockData = await import('../utils/mock.json')
    await loadMockData(mockData.default)
    ElMessage.success('已加载示例决策数据')
  } else if (demoId === 'demo-ai-vs-conservative') {
    const demoData = await import('../assets/mock/demo-ai-vs-conservative.json')
    await loadDemoData(demoData.default)
    ElMessage.success('已加载示例决策数据')
  }
})
</script>

<template>
  <div class="decision-view">
    <!-- Top navigation bar -->
    <header class="decision-header">
      <div class="header-left">
        <el-button text @click="goHome" class="btn-back">
          <el-icon><ArrowLeft /></el-icon>
          返回首页
        </el-button>
        <span class="header-title">Decision Copilot</span>
      </div>
    </header>
    <div class="three-panel">
      <!-- Custom loading overlay -->
      <Transition name="loading-fade">
        <div v-if="state.loading" class="loading-overlay">
          <div class="loading-spinner">
            <svg viewBox="0 0 50 50" class="loading-circular">
              <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="80 126" stroke-dashoffset="0" stroke-linecap="round"></circle>
            </svg>
          </div>
          <div class="loading-typewriter">
            {{ loadingDisplay.displayMessage }}
          </div>
        </div>
      </Transition>

      <!-- Input Panel + Param Panel (stacked, scrollable) -->
      <div class="panel input-col" :style="{ width: leftPanelWidth + 'px' }">
        <div class="left-scroll">
          <InputPanel :loading="state.loading" :user-input="state.userInput" @submit="onSubmit" />
          <div class="pipeline-section" :class="{ 'pipeline-idle': state.pipelineStatus === 'idle' }">
            <PipelineProgress
              :pipeline-id="state.pipelineId"
              :status="state.pipelineStatus"
              :current-step="state.pipelineCurrentStep"
              :completed-steps="state.pipelineCompletedSteps"
              :mode="state.pipelineMode"
              :inner-loop-count="state.pipelineInnerLoopCount"
              :outer-loop-count="state.pipelineOuterLoopCount"
              :inner-loop-skipped="state.pipelineInnerLoopSkipped"
              :outer-loop-skipped="state.pipelineOuterLoopSkipped"
              :outer-loop-low-confidence="state.pipelineOuterLoopLowConfidence"
            />
          </div>
          <div class="left-divider"></div>
          <ParamPanel :model="state.model" :param-values="state.paramValues" @update-param="onUpdateParam"
            @reset="onResetCounterfactual" />
        </div>
        <div class="action-bar" v-if="state.pipelineStatus === 'completed' || state.model">
          <el-button type="warning" size="small" v-if="state.pipelineStatus === 'completed'"
            @click="runModelCorrection" :disabled="state.loading">
            重新建模
          </el-button>
          <el-button text size="small" @click="onClearCache">清空建模</el-button>
        </div>
      </div>

      <!-- Resizable Divider (left/right split) -->
      <div class="resize-divider" @mousedown="startResize"></div>

      <!-- Result Area -->
      <div class="panel result-col">
        <div class="result-tree" v-if="state.model">
          <DecisionTree :tree-data="state.model.treeData" :selected-node="state.selectedNode"
            :adjusted-prob-map="state.adjustedProbabilities" :paths="state.model.paths" @node-click="onNodeClick" />
        </div>
        <div class="result-tree placeholder" v-else>
          <el-empty description="输入决策问题并提交后，将在此处展示决策树" />
        </div>

        <!-- Horizontal Resizable Divider -->
        <div class="resize-divider-h" @mousedown="startResizeBottom"></div>

        <div class="result-bottom" :style="{ height: bottomHeight + 'px' }">
          <div class="path-detail-col" v-if="state.model">
            <PathDetail :path-chain="state.selectedNode?.pathChain ?? []"
              :matched-path="state.selectedNode?.matchedPath ?? null" :node="state.selectedNode ?? null"
              :view-mode="state.selectedNode?.viewMode ?? 'trace'" :top-param="topWeightParam"
              :get-adjusted-score="getAdjustedScore" :get-score-attribution="getScoreAttribution"
              :base-scores="state.model?.scores ?? {}" :recommendation="state.model?.recommendation ?? null"
              :adjusted-prob-map="state.adjustedProbabilities" :param-values="state.paramValues"
              :weights="state.model?.weights ?? {}" :user-input="state.savedInput"
              :all-options="state.model?.treeData?.children ?? []"
              :monte-carlo-result="state.monteCarloResult"
              :devil-result="state.devilResult"
              :pipeline-devil="pipelineDevil"
              :pipeline-nexus="pipelineNexus"
              :devil-loading="state.devilLoading"
              :sensitivity="state.model?.sensitivity ?? null"
              @devil-rerun="runDevilReview"
              @correct-model="runModelCorrection" />
          </div>
          <div class="result-path placeholder" v-else>
            <el-empty description="点击节点，此处展示路径详情与深度分析" :image-size="80" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.decision-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.decision-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  background: var(--bg, #fff);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-back {
  font-size: 13px;
  padding: 4px 8px;
  color: var(--text, #6b7280);
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h, #111827);
}

.three-panel {
  flex: 1;
  display: flex;
  gap: 0;
  overflow: hidden;
}

.panel {
  border-right: 1px solid var(--border, #e5e7eb);
  overflow: hidden;
}

.panel:last-child {
  border-right: none;
}

.input-col {
  width: 300px;
  min-width: 260px;
  max-width: 600px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.left-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.left-divider {
  height: 1px;
  background: var(--border, #e5e7eb);
  margin: 0 12px;
  flex-shrink: 0;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid var(--border, #e5e7eb);
  flex-shrink: 0;
  background: #fff;
}

.pipeline-section {
  padding: 8px 12px;
}

.pipeline-idle {
  opacity: 0.45;
}

.deep-validation-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-deep-validation {
  flex: 1;
}

.resize-divider {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
  transition: background 0.2s;
}

.resize-divider:hover,
.resize-divider:active {
  background: var(--accent, #3b82f6);
}

.result-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.result-tree {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: auto;
}

.result-tree .decision-tree {
  width: 100%;
  height: 100%;
}

.result-tree.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.resize-divider-h {
  height: 6px;
  cursor: row-resize;
  background: transparent;
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;
}

.resize-divider-h::after {
  content: '';
  width: 40px;
  height: 3px;
  background: var(--border, #e5e7eb);
  border-radius: 2px;
}

.resize-divider-h:hover,
.resize-divider-h:active {
  background: var(--accent-bg, rgba(59, 130, 246, 0.06));
}

.resize-divider-h:hover::after,
.resize-divider-h:active::after {
  background: var(--accent, #3b82f6);
  height: 4px;
  width: 60px;
}

.result-bottom {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--border, #e5e7eb);
  flex-shrink: 0;
}

.result-path {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: auto;
}

.result-path.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.path-detail-col {
  flex: 1;
  overflow-y: auto;
}

/* ── Custom Loading Overlay ── */
.three-panel {
  position: relative;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  gap: 16px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  animation: loading-rotate 1s linear infinite;
}

.loading-circular {
  animation: loading-dash 1.5s ease-in-out infinite;
  color: var(--accent, #3b82f6);
}

@keyframes loading-rotate {
  to { transform: rotate(360deg); }
}

@keyframes loading-dash {
  0% { stroke-dasharray: 1 200; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 80 126; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 80 126; stroke-dashoffset: -124; }
}

.loading-typewriter {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-h, #1a1a2e);
  min-height: 20px;
  border-right: 2px solid var(--accent, #3b82f6);
  padding-right: 4px;
  animation: blink-caret 0.75s step-end infinite;
  white-space: nowrap;
}

@keyframes blink-caret {
  from, to { border-color: transparent; }
  50% { border-color: var(--accent, #3b82f6); }
}

.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.3s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}
</style>
