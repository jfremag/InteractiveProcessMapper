<template>
  <div class="card" v-if="current">
    <div class="section-title">
      <h2>{{ current.name }}</h2>
      <div class="actions">
        <button class="btn btn-secondary" @click="goHome">Back</button>
        <button class="btn btn-secondary" @click="downloadXml">Export</button>
        <button class="btn btn-secondary" @click="goEdit">Edit</button>
      </div>
    </div>
    <div ref="canvas" style="height: 600px; border: 1px solid #e5e7eb; border-radius: 8px;"></div>
  </div>
  <div v-else class="card">
    <p>Process not found.</p>
    <button class="btn btn-primary" @click="goHome">Back to list</button>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import { useProcessStore } from '../stores/processStore.js';

const route = useRoute();
const router = useRouter();
const store = useProcessStore();

const canvas = ref(null);
const viewer = ref(null);
const current = ref(null);

async function loadProcess(id) {
  const proc = store.getProcessById(id);
  if (!proc) {
    current.value = null;
    return;
  }
  current.value = proc;
  if (!viewer.value) {
    viewer.value = new BpmnViewer({ container: canvas.value });
  }
  await viewer.value.importXML(proc.bpmnXml);
  const canvasModule = viewer.value.get('canvas');
  canvasModule.zoom('fit-viewport');
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
  viewer.value?.destroy();
});
</script>
