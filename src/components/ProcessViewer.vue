<template>
  <div class="card viewer-card" v-if="current">
    <div class="section-title">
      <h2>{{ current.name }}</h2>
      <div class="actions">
        <button class="btn btn-secondary" @click="goHome">Back</button>
        <button class="btn btn-secondary" @click="downloadXml">Export</button>
        <button class="btn btn-secondary" @click="goEdit">Edit</button>
      </div>
    </div>
    <div ref="canvas" class="viewer-canvas"></div>
  </div>
  <div v-else class="card">
    <p>Process not found.</p>
    <button class="btn btn-primary" @click="goHome">Back to list</button>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import MoveCanvasModule from 'diagram-js/lib/navigation/movecanvas';
import { getBBox } from 'diagram-js/lib/util/Elements';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import { useProcessStore, defaultBpmn } from '../stores/processStore.js';

const route = useRoute();
const router = useRouter();
const store = useProcessStore();

const canvas = ref(null);
const viewer = ref(null);
const current = ref(null);
const resizeObserver = ref(null);
const removeWheelListener = ref(null);

function refreshViewport() {
  if (!viewer.value) return;
  const canvasModule = viewer.value.get('canvas');
  const elementRegistry = viewer.value.get('elementRegistry');
  if (!canvasModule || !elementRegistry) return;

  canvasModule.resized();

  const { width: viewportWidth, height: viewportHeight } = canvasModule.getSize();
  if (!viewportWidth || !viewportHeight) return;

  const root = canvasModule.getRootElement();
  const elements = elementRegistry
    .getAll()
    .filter((element) => element !== root && element.labelTarget !== root);

  if (!elements.length) {
    canvasModule.zoom('fit-viewport');
    return;
  }

  const bounds = getBBox(elements);
  const padding = 40;
  const targetWidth = bounds.width + padding * 2;
  const targetHeight = bounds.height + padding * 2;
  const zoom = Math.min(viewportWidth / targetWidth, viewportHeight / targetHeight);

  const clampedZoom = Math.min(4, Math.max(0.2, zoom));
  const viewWidth = viewportWidth / clampedZoom;
  const viewHeight = viewportHeight / clampedZoom;
  
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  canvasModule.viewbox({
    x: centerX - viewWidth / 2,
    y: centerY - viewHeight / 2,
    width: viewWidth,
    height: viewHeight,
  });
}

async function loadProcess(id) {
  const proc = store.getProcessById(id);
  if (!proc) {
    current.value = null;
    return;
  }
  current.value = proc;
  if (!viewer.value) {
    await nextTick();
    if (!canvas.value) {
      console.error('Canvas element is not available for BPMN viewer.');
      return;
    }
    viewer.value = new BpmnViewer({
      container: canvas.value,
      additionalModules: [MoveCanvasModule],
    });

    setupWheelZoom();

    resizeObserver.value = new ResizeObserver(() => {
      refreshViewport();
    });
    resizeObserver.value.observe(canvas.value);
  }
  const xml = proc.bpmnXml || defaultBpmn;
  try {
    await viewer.value.importXML(xml);
  } catch (err) {
    console.error('Failed to import BPMN for viewer', err);
    if (xml !== defaultBpmn) {
      try {
        await viewer.value.importXML(defaultBpmn);
      } catch (fallbackError) {
        console.error('Fallback import for viewer also failed', fallbackError);
        return;
      }
    } else {
      return;
    }
  }
  refreshViewport();
}

function downloadXml() {
  if (!current.value) return;
  const blob = store.exportProcessToBlob(current.value.id);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${current.value.name || 'process'}.bpmn`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function goHome() {
  router.push('/');
}

function goEdit() {
  if (current.value) {
    router.push(`/editor/${current.value.id}`);
  }
}

function setupWheelZoom() {
  if (!canvas.value) return;

  const handleWheel = (event) => {
    if (!viewer.value) return;

    event.preventDefault();

    const canvasApi = viewer.value.get('canvas');
    const currentZoom = canvasApi.zoom() || 1;
    const delta = event.deltaY;
    const step = delta > 0 ? 0.9 : 1.1;
    const nextZoom = Math.min(4, Math.max(0.2, currentZoom * step));

    const rect = canvas.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    canvasApi.zoom(nextZoom, { x, y });
  };

  canvas.value.addEventListener('wheel', handleWheel, { passive: false });
  removeWheelListener.value = () => {
    canvas.value?.removeEventListener('wheel', handleWheel);
  };
}

onMounted(async () => {
  await loadProcess(route.params.id);
});

watch(
  () => route.params.id,
  async (id) => {
    await loadProcess(id);
  }
);

onBeforeUnmount(() => {
  resizeObserver.value?.disconnect();
  viewer.value?.destroy();
  removeWheelListener.value?.();
});
</script>

<style scoped>
.viewer-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.viewer-canvas {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  width: 100%;
}

:deep(.viewer-canvas > .djs-container) {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
}

@media (max-width: 900px) {
  .viewer-canvas {
    min-height: 320px;
  }
}

@media (max-width: 640px) {
  .viewer-canvas {
    min-height: 260px;
  }
}
</style>
