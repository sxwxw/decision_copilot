<script setup>
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'

/**
 * 通用决策树可视化组件 — 只管画图，不管业务
 *
 * 节点契约（node.data）：
 *   id          : string|number  唯一标识
 *   name        : string         显示文字
 *   step        : number         层级深度（0 = 根）
 *   score       : number         分值
 *   status      : string|null    success|warning|error|info|neutral|null
 *   probability : number         0-1 累积概率
 *   isDashed    : boolean        连线是否虚线
 *   children    : array          子节点
 */
const props = defineProps({
  treeData: { type: Object, default: null },
  selectedNode: { type: Object, default: null },
})

const emit = defineEmits(['nodeClick'])

const svgRef = ref(null)
let svg, gNodes, gLinks, gLabels, zoomG, root, zoomBehavior

const CARD_W = 140
const CARD_H = 44

const STATUS_COLORS = {
  success: '#059669',
  positive: '#059669',   // 向后兼容旧字段
  error: '#dc2626',
  negative: '#dc2626',   // 向后兼容旧字段
  warning: '#d97706',
  info: '#9ca3af',
  neutral: '#9ca3af',    // 向后兼容旧字段
}

function renderTree() {
  if (!svgRef.value || !props.treeData) return

  const d3Sel = d3.select(svgRef.value)
  d3Sel.selectAll('*').remove()

  const width = svgRef.value.parentElement?.clientWidth || 800
  const height = svgRef.value.parentElement?.clientHeight || 500

  svg = d3Sel.append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('width', '100%')
    .style('height', '100%')

  // 根容器
  zoomG = svg.append('g')

  // 透明背景层用于点击重置
  zoomG
    .append('rect')
    .attr('width', 10000)
    .attr('height', 10000)
    .attr('x', -5000)
    .attr('y', -5000)
    .attr('fill', 'transparent')
    .style('cursor', 'default')
    .on('click', resetHighlight)

  gLinks = zoomG.append('g').attr('class', 'links')
  gLabels = zoomG.append('g').attr('class', 'labels')
  gNodes = zoomG.append('g').attr('class', 'nodes')

  const tree = d3.tree().nodeSize([40, 220])
  root = d3.hierarchy(props.treeData)
  tree(root)

  // ── 连线 ──
  const linkGen = d3.linkHorizontal().x(d => d.y).y(d => d.x)

  gLinks
    .selectAll('.d3-link-path')
    .data(root.links())
    .enter()
    .append('path')
    .attr('class', d => `d3-link-path ${d.target.data.isDashed ? 'd3-link-dashed' : ''}`)
    .attr('d', linkGen)
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', d => 1 + (d.target.data.probability ?? 0.5) * 4)

  // ── 连线标签 ──
  gLabels
    .selectAll('.d3-link-label')
    .data(root.links())
    .enter()
    .append('text')
    .attr('class', 'd3-link-label')
    .attr('x', d => (d.source.y + d.target.y) / 2)
    .attr('y', d => (d.source.x + d.target.x) / 2 - 8)
    .attr('text-anchor', 'middle')
    .text(d => {
      const p = d.target.data.probability
      return p != null ? `P=${(p * 100).toFixed(0)}%` : ''
    })

  // ── 节点 ──
  const nodes = gNodes
    .selectAll('.d3-node')
    .data(root.descendants())
    .enter()
    .append('g')
    .attr('class', 'd3-node')
    .attr('transform', d => `translate(${d.y},${d.x})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation()
      highlight(d)
      emit('nodeClick', d.data)
    })

  nodes
    .append('rect')
    .attr('class', 'd3-node-card')
    .attr('x', -CARD_W / 2)
    .attr('y', -CARD_H / 2)
    .attr('width', CARD_W)
    .attr('height', CARD_H)
    .attr('rx', 4)
    .attr('fill', '#fff')
    .attr('stroke', '#e5e7eb')

  nodes
    .append('text')
    .attr('class', 'd3-node-name')
    .attr('dy', 4)
    .attr('text-anchor', 'middle')
    .attr('font-size', '13px')
    .text(d => d.data.name)

  // 缩放行为（仅拖拽，禁用滚轮/双击缩放）
  zoomBehavior = d3
    .zoom()
    .filter(event => event.type !== 'wheel' && event.type !== 'dblclick')
    .scaleExtent([1, 1])
    .on('zoom', event => zoomG.attr('transform', event.transform))
  svg.call(zoomBehavior)

  // 默认视角
  svg.call(
    zoomBehavior.transform,
    d3.zoomIdentity.translate(120, height / 2).scale(0.85)
  )
}

function highlight(d) {
  const pathNodes = new Set(d.ancestors())

  gNodes
    .selectAll('.d3-node')
    .classed('d3-node-in-path', n => pathNodes.has(n))
  gNodes
    .selectAll('.d3-node')
    .classed('d3-node-out-of-path', n => !pathNodes.has(n))

  gLinks
    .selectAll('.d3-link-path')
    .classed('d3-link-in-path', l => pathNodes.has(l.source) && pathNodes.has(l.target))
    .classed('d3-link-out-of-path', l => !pathNodes.has(l.source) || !pathNodes.has(l.target))

  gLabels
    .selectAll('.d3-link-label')
    .classed('d3-link-label-in-path', l => pathNodes.has(l.target))
}

function resetHighlight() {
  gNodes
    .selectAll('.d3-node')
    .classed('d3-node-in-path', false)
    .classed('d3-node-out-of-path', false)
  gLinks
    .selectAll('.d3-link-path')
    .classed('d3-link-in-path', false)
    .classed('d3-link-out-of-path', false)
  gLabels
    .selectAll('.d3-link-label')
    .classed('d3-link-label-in-path', false)
}

watch(
  () => props.selectedNode,
  (val) => {
    if (!val) {
      resetHighlight()
      return
    }
    if (!root) return
    const target = root.descendants().find(n => n.data.id === val.id)
    if (target) {
      highlight(target)
    }
  }
)

watch(
  () => props.treeData,
  (val) => {
    if (val) renderTree()
  },
  { deep: true }
)

onMounted(() => {
  if (props.treeData) renderTree()
})
</script>

<template>
  <div ref="svgRef" class="d3-tree-container"></div>
</template>

<style>
.d3-tree-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.d3-tree-container svg {
  background: transparent;
}

.d3-node-card {
  transition: stroke 0.3s, filter 0.3s, fill 0.3s;
}

.d3-node-in-path .d3-node-card {
  stroke: #3b82f6;
  stroke-width: 2;
  fill: #eff6ff;
}

.d3-node-out-of-path {
  opacity: 0.2;
  transition: opacity 0.3s;
}

.d3-node-name {
  fill: #1e293b;
  transition: fill 0.3s;
}

.d3-node-in-path .d3-node-name {
  fill: var(--accent, #3b82f6);
  font-weight: 600;
}

.d3-link-path {
  transition: stroke 0.3s, stroke-width 0.3s, opacity 0.3s;
  fill: none;
}

.d3-link-dashed {
  stroke-dasharray: 6 4;
}

.d3-link-in-path {
  stroke: var(--accent, #3b82f6) !important;
  stroke-width: 3;
  opacity: 1 !important;
}

.d3-link-out-of-path {
  opacity: 0.1;
}

.d3-link-label {
  font-size: 10px;
  fill: #94a3b8;
  transition: opacity 0.3s, fill 0.3s;
  pointer-events: none;
}

.d3-link-label-in-path {
  fill: var(--accent, #3b82f6);
  font-weight: 600;
}
</style>
