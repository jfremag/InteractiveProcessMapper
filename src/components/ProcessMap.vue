<template>
  <div class="process-map" ref="containerRef">
    <div class="map-header">
      <div>
        <h2>Process map</h2>
        <p class="muted">Explore how processes drill down into one another.</p>
      </div>
      <div class="legend" v-if="areaGroups.length">
        <span class="legend-label">Areas</span>
        <div class="legend-items">
          <div
            v-for="group in areaGroups"
            :key="group.area"
            class="legend-item"
          >
            <span
              class="legend-swatch"
              :style="{ backgroundColor: getAreaColor(group.area), borderColor: getAreaBorder(group.area) }"
            ></span>
            <span class="legend-text">{{ group.area }} ({{ group.processes.length }})</span>
          </div>
        </div>
      </div>
    </div>

    <div class="map-grid">
      <svg class="connections" :style="{ height: `${gridHeight}px` }" v-if="edgeSegments.length" aria-hidden="true">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--pp-border)" />
          </marker>
        </defs>
        <line
          v-for="edge in edgeSegments"
          :key="`${edge.source}-${edge.target}`"
          :x1="edge.x1"
          :y1="edge.y1"
          :x2="edge.x2"
          :y2="edge.y2"
          stroke="var(--pp-border)"
          stroke-width="2"
          marker-end="url(#arrow)"
        />
      </svg>

      <div class="columns">
        <div v-for="group in areaGroups" :key="group.area" class="area-column">
          <div class="area-header" :style="{ borderColor: getAreaBorder(group.area) }">
            <span class="area-dot" :style="{ backgroundColor: getAreaColor(group.area), borderColor: getAreaBorder(group.area) }"></span>
            <span class="area-name">{{ group.area }}</span>
          </div>
          <div class="process-list">
            <button
              v-for="proc in group.processes"
              :key="proc.id"
              class="process-card"
              :ref="setNodeRef(proc.id)"
              type="button"
              @click="goToProcess(proc.id)"
              :style="{
                backgroundColor: getAreaTint(group.area),
                borderColor: getAreaBorder(group.area),
              }"
            >
              <span class="process-name">{{ proc.name }}</span>
              <span class="process-meta">
                <span class="badge">v{{ proc.version }}</span>
                <span class="muted">Links: {{ outgoingCounts.get(proc.id) || 0 }}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!processes.length" class="empty-state">
      <p>No processes found. Create or import a process to see it on the map.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useProcessStore } from '../stores/processStore.js';

const processStore = useProcessStore();
const router = useRouter();

const processes = computed(() => processStore.processes || []);

const areaGroups = computed(() => {
  const groups = new Map();
  processes.value.forEach((proc) => {
    const area = proc.area?.trim() || 'Unassigned';
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(proc);
  });

  return Array.from(groups.entries())
    .map(([area, items]) => ({ area, processes: [...items].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.area.localeCompare(b.area));
});

function extractLinkedProcessIds(proc) {
  // Prefer a precomputed index if the process already exposes one.
  if (Array.isArray(proc?.links) && proc.links.length) {
    return proc.links.map((link) => link?.linkedProcessId).filter(Boolean);
  }

  if (!proc?.bpmnXml) return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(proc.bpmnXml, 'application/xml');
    const elements = Array.from(doc.querySelectorAll('[pp\\:linkedProcessId]'));
    const attributes = elements
      .map((el) => el.getAttribute('pp:linkedProcessId'))
      .filter((value) => typeof value === 'string' && value.trim().length > 0);
    return attributes;
  } catch (error) {
    console.warn('Failed to parse BPMN for process map', error);
    return [];
  }
}

const edges = computed(() => {
  const allIds = new Set(processes.value.map((proc) => proc.id));
  const edgeList = [];

  processes.value.forEach((proc) => {
    const targets = new Set(
      extractLinkedProcessIds(proc).filter((targetId) => targetId !== proc.id && allIds.has(targetId))
    );
    targets.forEach((targetId) => edgeList.push({ source: proc.id, target: targetId }));
  });

  return edgeList;
});

const outgoingCounts = computed(() => {
  const map = new Map();
  edges.value.forEach((edge) => {
    map.set(edge.source, (map.get(edge.source) || 0) + 1);
  });
  return map;
});

const nodeRefs = new Map();
const containerRef = ref(null);
const edgeSegments = ref([]);
const gridHeight = ref(0);

const setNodeRef = (id) => (el) => {
  if (el) {
    nodeRefs.set(id, el);
  } else {
    nodeRefs.delete(id);
  }
};

const goToProcess = (id) => {
  router.push({ name: 'viewer', params: { id } });
};

function colorFromArea(area) {
  if (!area || area === 'Unassigned') return { base: 'var(--pp-surface)', border: 'var(--pp-border)', tint: 'rgba(37, 99, 235, 0.04)' };
  let hash = 0;
  for (let i = 0; i < area.length; i += 1) {
    hash = area.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    base: `hsl(${hue}, 70%, 90%)`,
    tint: `hsl(${hue}, 75%, 96%)`,
    border: `hsl(${hue}, 45%, 72%)`,
  };
}

const getAreaColor = (area) => colorFromArea(area).base;
const getAreaBorder = (area) => colorFromArea(area).border;
const getAreaTint = (area) => colorFromArea(area).tint;

function computeEdgeSegments() {
  const container = containerRef.value;
  if (!container) return;
  const bounds = container.getBoundingClientRect();
  const lines = [];
  edges.value.forEach((edge) => {
    const sourceEl = nodeRefs.get(edge.source);
    const targetEl = nodeRefs.get(edge.target);
    if (!sourceEl || !targetEl) return;

    const sourceRect = sourceEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    lines.push({
      ...edge,
      x1: sourceRect.right - bounds.left,
      y1: sourceRect.top + sourceRect.height / 2 - bounds.top,
      x2: targetRect.left - bounds.left,
      y2: targetRect.top + targetRect.height / 2 - bounds.top,
    });
  });
  edgeSegments.value = lines;
  const lastColumn = container.querySelector('.columns');
  gridHeight.value = lastColumn ? lastColumn.scrollHeight : container.scrollHeight;
}

const scheduleRecompute = () => nextTick(() => computeEdgeSegments());

onMounted(() => {
  scheduleRecompute();
  window.addEventListener('resize', scheduleRecompute);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleRecompute);
});

watch(edges, scheduleRecompute, { deep: true });
watch(processes, scheduleRecompute, { deep: true });
</script>

<style scoped>
.process-map {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.map-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.legend {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--pp-surface);
  border: 1px solid var(--pp-border);
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
}

.legend-label {
  font-weight: 600;
  color: var(--pp-text);
}

.legend-items {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.02);
}

.legend-swatch {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid var(--pp-border);
}

.legend-text {
  color: var(--pp-text);
  font-size: 0.9rem;
}

.map-grid {
  position: relative;
  border: 1px solid var(--pp-border);
  border-radius: 12px;
  padding: 1rem;
  background: var(--pp-surface);
  overflow: hidden;
}

.columns {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  z-index: 2;
}

.area-column {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.area-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--pp-border);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.02);
}

.area-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 1px solid var(--pp-border);
}

.area-name {
  font-weight: 700;
  color: var(--pp-text);
}

.process-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.process-card {
  text-align: left;
  border-radius: 10px;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--pp-border);
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
  color: var(--pp-text);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.process-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
}

.process-name {
  font-weight: 700;
  font-size: 1rem;
}

.process-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--pp-muted-text);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--pp-text);
  font-weight: 700;
  font-size: 0.8rem;
}

.muted {
  color: var(--pp-muted-text);
}

.connections {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1;
  pointer-events: none;
}

.empty-state {
  padding: 1rem;
  border-radius: 8px;
  border: 1px dashed var(--pp-border);
  background: var(--pp-surface);
  color: var(--pp-muted-text);
}

@media (max-width: 768px) {
  .map-header {
    flex-direction: column;
  }

  .legend {
    align-self: flex-start;
  }
}
</style>
