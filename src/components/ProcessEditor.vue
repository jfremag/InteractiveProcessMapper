<template>
  <div class="card" v-if="current">
    <div class="section-title">
      <div>
        <h2>Edit: {{ current.name }}</h2>
        <input v-model="editableName" placeholder="Process name" />
      </div>
      <div class="actions">
        <button class="btn btn-secondary" @click="goHome">Back</button>
        <button class="btn btn-secondary" @click="goView">View</button>
        <button class="btn btn-secondary" @click="triggerImport">Import XML</button>
        <button class="btn btn-secondary" @click="downloadXml">Export</button>
        <button class="btn btn-primary" @click="saveProcess">Save</button>
      </div>
    </div>
    <div ref="canvas" style="height: 600px; border: 1px solid #e5e7eb; border-radius: 8px;"></div>
    <input ref="importInput" type="file" accept=".bpmn,text/xml" hidden @change="handleImport" />
  </div>
  <div v-else class="card">
    <p>Process not found.</p>
    <button class="btn btn-primary" @click="goHome">Back to list</button>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import { useProcessStore } from '../stores/processStore.js';

const route = useRoute();
const router = useRouter();
const store = useProcessStore();

const canvas = ref(null);
const importInput = ref(null);
const modeler = ref(null);
const editableName = ref('');
const current = ref(null);

async function loadProcess(id) {
  const proc = store.getProcessById(id);
  if (!proc) {
    current.value = null;
    return;
  }
  current.value = proc;
  editableName.value = proc.name;
  if (!modeler.value) {
    modeler.value = new BpmnModeler({ container: canvas.value });
  }
  await modeler.value.importXML(proc.bpmnXml);
}

function saveProcess() {
  if (!modeler.value || !current.value) return;
  modeler.value.saveXML({ format: true }).then(({ xml }) => {
    store.updateProcess(current.value.id, { name: editableName.value, bpmnXml: xml });
    alert('Process saved');
  });
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

function triggerImport() {
  importInput.value?.click();
}

function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file || !modeler.value) return;
  const reader = new FileReader();
  reader.onload = async () => {
    await modeler.value.importXML(reader.result);
  };
  reader.readAsText(file);
  event.target.value = '';
}

function goHome() {
  router.push('/');
}

function goView() {
  if (current.value) {
    router.push(`/viewer/${current.value.id}`);
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
  modeler.value?.destroy();
});
</script>
