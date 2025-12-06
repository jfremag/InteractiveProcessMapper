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
        <button class="btn btn-secondary" @click="triggerImport">
          Import XML
        </button>
        <button class="btn btn-secondary" @click="downloadXml">Export</button>
        <button class="btn btn-primary" @click="saveProcess">Save</button>
      </div>
    </div>

    <div class="editor-grid">
      <div class="toolbar">
        <p class="toolbar-title">Quick add</p>
        <div class="toolbar-actions">
          <button
            class="btn btn-secondary"
            @click="createTask"
            :disabled="loadingModel || !modelReady"
          >
            Task
          </button>
          <button
            class="btn btn-secondary"
            @click="createGateway"
            :disabled="loadingModel || !modelReady"
          >
            Gateway
          </button>
          <button
            class="btn btn-secondary"
            @click="createStart"
            :disabled="loadingModel || !modelReady"
          >
            Start Event
          </button>
          <button
            class="btn btn-secondary"
            @click="createEnd"
            :disabled="loadingModel || !modelReady"
          >
            End Event
          </button>
        </div>
        <p class="toolbar-hint">
          Use the palette or quick buttons to drop new BPMN elements into your
          process.
          <span v-if="loadingModel">Loading diagram…</span>
        </p>
      </div>

      <div ref="canvas" class="modeler-canvas"></div>
    </div>
    <input
      ref="importInput"
      type="file"
      accept=".bpmn,text/xml"
      hidden
      @change="handleImport"
    />
  </div>
  <div v-else class="card">
    <p>Process not found.</p>
    <button class="btn btn-primary" @click="goHome">Back to list</button>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'
import { useProcessStore } from '../stores/processStore.js'

const route = useRoute()
const router = useRouter()
const store = useProcessStore()

const canvas = ref(null)
const importInput = ref(null)
const modeler = ref(null)
const editableName = ref('')
const current = ref(null)
const modelReady = ref(false)
const loadingModel = ref(false)
const placementCursor = ref({ x: 260, y: 180 })
const lastElement = ref(null)

async function loadProcess(id) {
  modelReady.value = false
  const proc = store.getProcessById(id)
  if (!proc) {
    current.value = null
    return
  }
  current.value = proc
  editableName.value = proc.name
  placementCursor.value = { x: 260, y: 180 }
  if (!modeler.value) {
    modeler.value = new BpmnModeler({ container: canvas.value })
  }
}

function saveProcess() {
  if (!modeler.value || !current.value) return
  modeler.value.saveXML({ format: true }).then(({ xml }) => {
    store.updateProcess(current.value.id, {
      name: editableName.value,
      bpmnXml: xml,
    })
    alert('Process saved')
  })
}

function downloadXml() {
  if (!current.value) return
  const blob = store.exportProcessToBlob(current.value.id)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${current.value.name || 'process'}.bpmn`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function triggerImport() {
  importInput.value?.click()
}

function handleImport(event) {
  const file = event.target.files?.[0]
  if (!file || !modeler.value) return
  const reader = new FileReader()
  reader.onload = async () => {
    await importDiagram(reader.result)
  }
  reader.readAsText(file)
  event.target.value = ''
}

function nextPlacement() {
  const coords = { ...placementCursor.value }
  placementCursor.value.x += 140
  if (placementCursor.value.x > 900) {
    placementCursor.value.x = 260
    placementCursor.value.y += 140
  }
  return coords
}

function createShape(type, label) {
  if (!modeler.value || !modelReady.value) return
  const elementFactory = modeler.value.get('elementFactory')
  const modeling = modeler.value.get('modeling')
  const canvasApi = modeler.value.get('canvas')
  const root = canvasApi.getRootElement()
  const position = nextPlacement()

  const shape = elementFactory.createShape({ type })
  modeling.createShape(shape, position, root)

  if (label) {
    modeling.updateLabel(shape, label)
  }

  const canConnectFromLast = lastElement.value && !lastElement.value.waypoints

  if (canConnectFromLast && lastElement.value !== shape) {
    try {
      modeling.connect(lastElement.value, shape)
    } catch (err) {
      console.warn('Unable to connect elements', err)
    }
  }

  lastElement.value = shape
}

function createTask() {
  createShape('bpmn:Task', 'Task')
}

function createGateway() {
  createShape('bpmn:ExclusiveGateway', 'Gateway')
}

function createStart() {
  createShape('bpmn:StartEvent', 'Start')
}

function createEnd() {
  createShape('bpmn:EndEvent', 'End')
}

function goHome() {
  router.push('/')
}

function goView() {
  if (current.value) {
    router.push(`/viewer/${current.value.id}`)
  }
}

function setLastElementFromDiagram() {
  if (!modeler.value) return
  const elementRegistry = modeler.value.get('elementRegistry')
  const root = modeler.value.get('canvas').getRootElement()
  const flowNodes = elementRegistry
    .getAll()
    .filter(
      (el) =>
        el.type &&
        el.type.startsWith('bpmn:') &&
        !el.waypoints &&
        el.id !== root.id
    )

  lastElement.value = flowNodes[flowNodes.length - 1] || null
}

async function importDiagram(xml) {
  if (!modeler.value) return
  modelReady.value = false
  loadingModel.value = true
  try {
    await modeler.value.importXML(xml)
    setLastElementFromDiagram()
    modelReady.value = true
  } catch (error) {
    console.error('Failed to import BPMN', error)
    alert('Unable to load the BPMN diagram. Please verify the file.')
  } finally {
    loadingModel.value = false
  }
}

function setLastElementFromDiagram() {
  if (!modeler.value) return
  const elementRegistry = modeler.value.get('elementRegistry')
  const root = modeler.value.get('canvas').getRootElement()
  const flowNodes = elementRegistry
    .getAll()
    .filter(
      (el) =>
        el.type &&
        el.type.startsWith('bpmn:') &&
        !el.waypoints &&
        el.id !== root.id
    )

  lastElement.value = flowNodes[flowNodes.length - 1] || null
}

async function importDiagram(xml) {
  if (!modeler.value) return
  modelReady.value = false
  loadingModel.value = true
  try {
    await modeler.value.importXML(xml)
    setLastElementFromDiagram()
    modelReady.value = true
  } catch (error) {
    console.error('Failed to import BPMN', error)
    alert('Unable to load the BPMN diagram. Please verify the file.')
  } finally {
    loadingModel.value = false
  }
}

onMounted(async () => {
  await loadProcess(route.params.id)
  if (current.value && modeler.value) {
    await importDiagram(current.value.bpmnXml)
  }
})

watch(
  () => route.params.id,
  async (id) => {
    await loadProcess(id)
    if (current.value && modeler.value) {
      await importDiagram(current.value.bpmnXml)
    }
  }
)

onBeforeUnmount(() => {
  modeler.value?.destroy()
})
</script>

<style scoped>
.editor-grid {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 1rem;
}

.toolbar {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toolbar-title {
  margin: 0;
  font-weight: 700;
}

.toolbar-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.toolbar-hint {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.modeler-canvas {
  height: 600px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

@media (max-width: 900px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-actions {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
}
</style>
