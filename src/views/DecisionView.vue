<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import InputPanel from '../components/decision/InputPanel.vue'
import ParamPanel from '../components/decision/ParamPanel.vue'
import DecisionTree from '../components/decision/DecisionTree.vue'
import PathDetail from '../components/decision/PathDetail.vue'
import { useDecisionModel } from '../composables/useDecisionModel'

const { state, scores, buildModel, recalcScores, runSimulation, selectNode,
  counterfactuals, counterfactualActive, activeCounterfactual,
  applyCounterfactual, resetCounterfactual, getScoreDiff, getAdjustedScore, getScoreAttribution } = useDecisionModel()

const leftPanelWidth = ref(300)
const MIN_LEFT = 260
const MAX_LEFT = 600
const bottomHeight = ref(300)
const MIN_BOTTOM = 200
const MAX_BOTTOM = 800

function startResize(e) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = leftPanelWidth.value

  function onMouseMove(e2) {
    const dx = e2.clientX - startX
    const newWidth = startWidth + dx
    leftPanelWidth.value = Math.min(MAX_LEFT, Math.max(MIN_LEFT, newWidth))
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function startResizeBottom(e) {
  e.preventDefault()
  const startY = e.clientY
  const startH = bottomHeight.value

  function onMouseMove(e2) {
    const dy = startY - e2.clientY
    const newH = startH + dy
    bottomHeight.value = Math.min(MAX_BOTTOM, Math.max(MIN_BOTTOM, newH))
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onSubmit(input) {
  state.userInput = input
  buildModel()
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

function onApplyCounterfactual(scenario) {
  applyCounterfactual(scenario)
}

function onResetCounterfactual() {
  resetCounterfactual()
}

/** 最高权重的偏好参数名称 */
const topWeightParam = computed(() => {
  if (!state.model?.weights) return ''
  const entries = Object.entries(state.model.weights)
  if (!entries.length) return ''
  return entries.reduce((a, b) => b[1] > a[1] ? b : a)[0]
})
</script>

<template>
  <div class="decision-view">
    <div v-loading="state.loading" class="three-panel" element-loading-text="AI 正在建模中...">
      <!-- Input Panel + Param Panel (stacked, scrollable) -->
      <div class="panel input-col" :style="{ width: leftPanelWidth + 'px' }">
        <div class="left-scroll">
          <InputPanel :loading="state.loading" @submit="onSubmit" />
          <div class="left-divider"></div>
          <ParamPanel :model="state.model" :param-values="state.paramValues" @update-param="onUpdateParam"
            @recalc="runSimulation" />
        </div>
      </div>

      <!-- Resizable Divider (left/right split) -->
      <div class="resize-divider" @mousedown="startResize"></div>

      <!-- Result Area -->
      <div class="panel result-col">
        <div class="result-tree" v-if="state.model">
          <DecisionTree :tree-data="state.model.treeData" :selected-node="state.selectedNode"
            :adjusted-prob-map="state.adjustedProbabilities"
            @node-click="onNodeClick" />
        </div>
        <div class="result-tree placeholder" v-else>
          <el-empty description="输入决策问题并提交后，将在此处展示决策树" />
        </div>

        <!-- Horizontal Resizable Divider -->
        <div class="resize-divider-h" @mousedown="startResizeBottom"></div>

        <div class="result-bottom" :style="{ height: bottomHeight + 'px' }">
          <div class="path-detail-col" v-if="state.model">
            <PathDetail
              :path-chain="state.selectedNode?.pathChain ?? []"
              :matched-path="state.selectedNode?.matchedPath ?? null"
              :node="state.selectedNode ?? null"
              :view-mode="state.selectedNode?.viewMode ?? 'trace'"
              :top-param="topWeightParam"
              :get-adjusted-score="getAdjustedScore"
              :get-score-attribution="getScoreAttribution"
              :base-scores="state.model?.scores ?? {}"
              :recommendation="state.model?.recommendation ?? null"
              :adjusted-prob-map="state.adjustedProbabilities"
              :param-values="state.paramValues"
              :weights="state.model?.weights ?? {}"
              :user-input="state.savedInput"
              :all-options="state.model?.treeData?.children ?? []"
            />
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

.path-detail-col {
  flex: 1;
  overflow-y: auto;
}
</style>
