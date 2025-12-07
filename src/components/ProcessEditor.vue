<template>
  <div class="card editor-card" v-if="current">
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
import { onMounted, onBeforeUnmount, ref, watch, nextTick, toRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'
import { useProcessStore, defaultBpmn } from '../stores/processStore.js'

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
const resizeObserver = ref(null)
const removeWheelListener = ref(null)

function refreshViewport() {
  if (!modeler.value) return
  const canvasApi = modeler.value.get('canvas')
  canvasApi.resized()
  canvasApi.zoom('fit-viewport')
}

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

  // Ensure DOM is updated so <div ref="canvas"> exists
  if (!modeler.value) {
    await nextTick()
    if (!canvas.value) {
      console.error('Canvas element is not available for BPMN modeler.')
      return
    }
    modeler.value = new BpmnModeler({
      container: canvas.value,
      // Disable ZoomScroll to avoid non-passive wheel listeners in Chrome
      additionalModules: [{ zoomScroll: ['value', null] }],
    })

    setupWheelZoom()

    resizeObserver.value = new ResizeObserver(() => {
      refreshViewport()
    })
    resizeObserver.value.observe(canvas.value)
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
    const source = toRaw(lastElement.value)
    const target = toRaw(shape)

    try {
      modeling.connect(source, target)
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

function setupWheelZoom() {
  if (!canvas.value) return

  const handleWheel = (event) => {
    if (!modeler.value) return

    event.preventDefault()

    const canvasApi = modeler.value.get('canvas')
    const currentZoom = canvasApi.zoom() || 1
    const delta = event.deltaY
    const step = delta > 0 ? 0.9 : 1.1
    const nextZoom = Math.min(4, Math.max(0.2, currentZoom * step))

    const rect = canvas.value.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    canvasApi.zoom(nextZoom, { x, y })
  }

  canvas.value.addEventListener('wheel', handleWheel, { passive: false })
  removeWheelListener.value = () => {
    canvas.value?.removeEventListener('wheel', handleWheel)
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
  const diagramXml = xml || defaultBpmn
  try {
    await modeler.value.importXML(diagramXml)
    refreshViewport()
    setLastElementFromDiagram()
    modelReady.value = true
  } catch (error) {
    console.error('Failed to import BPMN', error)
    if (diagramXml !== defaultBpmn) {
      try {
        await modeler.value.importXML(defaultBpmn)
        refreshViewport()
        setLastElementFromDiagram()
        if (current.value) {
          store.updateProcess(current.value.id, { bpmnXml: defaultBpmn })
        }
        modelReady.value = true
        alert(
          'Loaded a blank starter diagram because the file could not be loaded.'
        )
        return
      } catch (fallbackError) {
        console.error('Fallback import failed', fallbackError)
      }
    }

    try {
      await modeler.value.createDiagram()
      refreshViewport()
      setLastElementFromDiagram()
      modelReady.value = true
      if (current.value) {
        const { xml: freshXml } = await modeler.value.saveXML({ format: true })
        store.updateProcess(current.value.id, { bpmnXml: freshXml })
      }
      alert('Started a new blank diagram because the file could not be loaded.')
    } catch (createError) {
      console.error('Creating a new diagram also failed', createError)
      alert('Unable to load the BPMN diagram. Please verify the file.')
    }
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
  resizeObserver.value?.disconnect()
  modeler.value?.destroy()
  removeWheelListener.value?.()
})
</script>

<style scoped>
.editor-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: calc(100vh - 200px);
}

.editor-grid {
  display: grid;
  grid-template-columns: minmax(240px, 320px) 1fr;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  height: 100%;
  align-items: stretch;
}

.toolbar {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 100%;
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
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
  height: calc(100vh - 240px);
  min-height: 520px;
  max-height: none;
}

:deep(.modeler-canvas > .djs-container) {
  height: 100%;
  width: 100%;
}

@media (max-width: 900px) {
  .editor-card {
    min-height: calc(100vh - 140px);
  }

  .editor-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-actions {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }

  .modeler-canvas {
    height: calc(100vh - 200px);
  }
}

@media (max-width: 640px) {
  .modeler-canvas {
    min-height: 440px;
    height: calc(100vh - 180px);
  }
}
</style>
