<template>
  <div class="card">
    <div class="section-title">
      <h2>Processes</h2>
      <div class="actions">
        <button class="btn btn-primary" @click="handleNew">New process</button>
        <label class="btn btn-secondary" for="import-input">Import .bpmn</label>
        <input id="import-input" ref="fileInput" type="file" accept=".bpmn,text/xml" @change="handleImport" hidden />
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Updated</th>
          <th style="width: 260px">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="proc in processes" :key="proc.id">
          <td>{{ proc.name }}</td>
          <td>{{ formatDate(proc.updatedAt) }}</td>
          <td>
            <div class="actions">
              <button class="btn btn-secondary" @click="edit(proc.id)">Edit</button>
              <button class="btn btn-secondary" @click="view(proc.id)">View</button>
              <button class="btn btn-secondary" @click="exportProcess(proc.id)">Export</button>
              <button class="btn btn-danger" @click="remove(proc.id)">Delete</button>
            </div>
          </td>
        </tr>
        <tr v-if="!processes.length">
          <td colspan="3">No processes yet. Create or import one to get started.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useProcessStore } from '../stores/processStore.js';

const store = useProcessStore();
const router = useRouter();
const fileInput = ref(null);

const processes = computed(() => store.processes);

const formatDate = (iso) => new Date(iso).toLocaleString();

function handleNew() {
  const created = store.createProcess('New process');
  router.push(`/editor/${created.id}`);
}

function edit(id) {
  router.push(`/editor/${id}`);
}

function view(id) {
  router.push(`/viewer/${id}`);
}

function remove(id) {
  if (confirm('Delete this process?')) {
    store.deleteProcess(id);
  }
}

function exportProcess(id) {
  const blob = store.exportProcessToBlob(id);
  if (!blob) return;
  const proc = store.getProcessById(id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${proc.name || 'process'}.bpmn`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const name = prompt('Name for imported process?', file.name.replace(/\.bpmn$/i, '')) || 'Imported process';
    const proc = store.importProcessFromFile(name, reader.result);
    router.push(`/editor/${proc.id}`);
  };
  reader.readAsText(file);
  if (fileInput.value) fileInput.value.value = '';
}
</script>
