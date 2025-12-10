<template>
  <div class="card viewer-card" v-if="current">
    <div class="section-title">
      <div>
        <h2>{{ current.name }}</h2>
        <div class="process-meta">
          <span class="pill" :data-status="current.status">
            {{ current.status }} • v{{ current.version }}
          </span>
          <span>Area: {{ current.area || '—' }}</span>
          <span>Updated: {{ formatDate(current.updatedAt) }}</span>
        </div>
      </div>
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
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BpmnViewer from 'bpmn-js/lib/Viewer'
import MoveCanvasModule from 'diagram-js/lib/navigation/movecanvas'
import createThemedRenderer from '../bpmn/ThemedRenderer.js'
import { useThemeStore } from '../stores/themeStore.js'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'
import { useProcessStore, defaultBpmn } from '../stores/processStore.js'
import ppModdle from '../bpmn/pp-moddle.json'

const route = useRoute()
const router = useRouter()
const store = useProcessStore()
const themeStore = useThemeStore()

const canvas = ref(null)
const viewer = ref(null)
const current = ref(null)
const resizeObserver = ref(null)
const removeWheelListener = ref(null)

const formatDate = (iso) => new Date(iso).toLocaleString()

async function ensureCanvasSized() {
  await nextTick()

  const element = canvas.value
  if (!element) return false

  if (element.clientWidth > 0 && element.clientHeight > 0) return true

  return new Promise((resolve) => {
    let observer
    const timeout = setTimeout(() => {
      observer?.disconnect()
      resolve(false)
    }, 500)

    const checkSize = (entries) => {
      const target = entries?.[0]?.target ?? element
      if (target.clientWidth > 0 && target.clientHeight > 0) {
        clearTimeout(timeout)
        observer?.disconnect()
        resolve(true)
      }
    }

    observer = new ResizeObserver(checkSize)
    observer.observe(element)

    requestAnimationFrame(() => checkSize())
  })
}

// Self-test logger: logs sizes of viewer containers at lifecycle steps
function logSizes(step) {
  try {
    console.groupCollapsed(`ProcessViewer sizes — ${step}`)
    const canvasEl = canvas.value
    console.log('viewer.current id:', current.value?.id)
    if (!canvasEl) {
      console.log('canvas: (null)')
      console.groupEnd()
      return
    }

    const rect = canvasEl.getBoundingClientRect()
    console.log('canvas:', {
      width: rect.width,
      height: rect.height,
      clientWidth: canvasEl.clientWidth,
      clientHeight: canvasEl.clientHeight,
      inlineStyle: canvasEl.getAttribute('style') || null,
    })

    const bjs = canvasEl.querySelector('.bjs-container')
    if (bjs) {
      const r = bjs.getBoundingClientRect()
      console.log('bjs-container:', {
        width: r.width,
        height: r.height,
        inlineStyle: bjs.getAttribute('style') || null,
      })
    } else {
      console.log('bjs-container: (not found)')
    }

    const djs = canvasEl.querySelector('.djs-container')
    if (djs) {
      const r2 = djs.getBoundingClientRect()
      console.log('djs-container:', {
        width: r2.width,
        height: r2.height,
        inlineStyle: djs.getAttribute('style') || null,
      })
      const svg = djs.querySelector('svg')
      if (svg) {
        const rs = svg.getBoundingClientRect()
        console.log('svg:', {
          width: rs.width,
          height: rs.height,
          inlineStyle: svg.getAttribute('style') || null,
          viewBox: svg.getAttribute('viewBox') || null,
        })
      } else {
        console.log('svg: (not found)')
      }
    } else {
      console.log('djs-container: (not found)')
    }

    // If viewer is available, also log the canvas module container
    if (viewer.value) {
      try {
        const canvasModule = viewer.value.get('canvas')
        const cmContainer =
          canvasModule &&
          canvasModule.getContainer &&
          canvasModule.getContainer()
        if (cmContainer) {
          const rc = cmContainer.getBoundingClientRect()
          console.log('canvasModule.getContainer():', {
            width: rc.width,
            height: rc.height,
            inlineStyle: cmContainer.getAttribute('style') || null,
          })
        }
      } catch (e) {
        console.log('canvasModule.getContainer() error', e)
      }
    }
    console.groupEnd()
  } catch (err) {
    console.error('logSizes error', err)
  }
}

function refreshViewport() {
  if (!viewer.value) return

  const canvasModule = viewer.value.get('canvas')
  if (!canvasModule) return

  const container = canvasModule.getContainer()

  // Set height/width FIRST so resized() can measure correctly
  if (container) {
    container.style.height = '100%'
    container.style.width = '100%'
  }

  // Now let bpmn-js re-measure with the correct container size
  canvasModule.resized()

  // Wait a tick for layout to settle before zooming
  setTimeout(() => {
    logSizes('refreshViewport (before fit-viewport)')
    if (viewer.value) {
      const api = viewer.value.get('canvas')
      if (api) {
        api.zoom('fit-viewport')
      }
    }
    // log after zoom
    logSizes('refreshViewport (after fit-viewport)')
  }, 0)
}

async function loadProcess(id) {
  const proc = store.getProcessById(id)
  if (!proc) {
    current.value = null
    return
  }
  current.value = proc
  if (!viewer.value) {
    // Wait until the canvas element has a usable size before creating the viewer.
    // If we create/import while the canvas is collapsed, bpmn-js may set
    // an inline height (commonly 100px) which then stays and crops the diagram.
    const ready = await ensureCanvasSized()
    if (!ready) {
      console.error('Canvas element is not sized for BPMN viewer.')
      return
    }
    logSizes('canvas sized (before creating viewer)')
    // Ensure the DOM is updated so <div ref="canvas"> exists
    await nextTick()
    if (!canvas.value) {
      console.error('Canvas element is not available for BPMN viewer.')
      return
    }
    // Force an explicit pixel height on the canvas so bpmn-js measures correctly.
    // bpmn-js sometimes measures before CSS layout settles and falls back to
    // a small default (commonly ~150px). Setting an explicit height prevents that.
    try {
      const canvasEl = canvas.value
      const ch =
        canvasEl.clientHeight || canvasEl.getBoundingClientRect().height
      if (ch && ch > 0) {
        canvasEl.style.height = `${Math.round(ch)}px`
        canvasEl.style.width = `${Math.round(canvasEl.clientWidth)}px`
      }
    } catch (e) {
      // ignore
    }
    viewer.value = new BpmnViewer({
      container: canvas.value,
      moddleExtensions: { pp: ppModdle },
      additionalModules: [
        MoveCanvasModule,
        createThemedRenderer({ getTheme: () => themeStore.currentTheme }),
      ],
    })

    logSizes('viewer created')

    setupWheelZoom()

    resizeObserver.value = new ResizeObserver(() => {
      logSizes('resizeObserver')
      refreshViewport()
    })
    resizeObserver.value.observe(canvas.value)

    // Add a second observer to force the internal containers to fill the canvas
    const canvasModule = viewer.value.get('canvas')
    const container = canvasModule?.getContainer()
    if (container?.parentElement) {
      const heightFixer = new ResizeObserver(() => {
        if (container) {
          container.style.height = '100%'
          container.style.width = '100%'
        }
        const parent = container?.parentElement
        if (parent && parent !== canvas.value) {
          parent.style.height = '100%'
          parent.style.width = '100%'
        }
      })
      heightFixer.observe(container.parentElement)
    }
  }
  const xml = proc.bpmnXml || defaultBpmn
  try {
    await viewer.value.importXML(xml)
    logSizes('after importXML')
  } catch (err) {
    console.error('Failed to import BPMN for viewer', err)
    if (xml !== defaultBpmn) {
      try {
        await viewer.value.importXML(defaultBpmn)
      } catch (fallbackError) {
        console.error('Fallback import for viewer also failed', fallbackError)
        return
      }
    } else {
      return
    }
  }
  await ensureCanvasSized()
  refreshViewport()
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

function goHome() {
  router.push('/')
}

function goEdit() {
  if (current.value) {
    router.push(`/editor/${current.value.id}`)
  }
}

function setupWheelZoom() {
  if (!canvas.value) return

  const handleWheel = (event) => {
    if (!viewer.value) return

    event.preventDefault()

    const canvasApi = viewer.value.get('canvas')
    const currentZoom = canvasApi.zoom() || 1
    const delta = event.deltaY
    const step = delta > 0 ? 0.9 : 1.1
    const nextZoom = Math.min(5, Math.max(0.1, currentZoom * step))

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

onMounted(async () => {
  await loadProcess(route.params.id)
})

watch(
  () => route.params.id,
  async (id) => {
    await loadProcess(id)
  }
)

watch(
  () => themeStore.currentTheme,
  () => {
    if (!viewer.value) return

    const elementRegistry = viewer.value.get('elementRegistry')
    const elements = elementRegistry?.getAll?.() || []
    if (elements.length) {
      viewer.value.get('eventBus')?.fire('elements.changed', { elements })
    }
    refreshViewport()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  resizeObserver.value?.disconnect()
  viewer.value?.destroy()
  removeWheelListener.value?.()
})
</script>

<style scoped>
.viewer-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.section-title {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-title h2 {
  margin: 0;
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.process-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 0.35rem;
  color: #4b5563;
  font-size: 0.95rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-weight: 700;
  text-transform: capitalize;
}

.pill[data-status='published'] {
  background: #ecfdf3;
  color: #065f46;
  border: 1px solid #bbf7d0;
}

.pill[data-status='draft'] {
  background: #fff7ed;
  color: #92400e;
  border: 1px solid #fed7aa;
}

.viewer-canvas {
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  overflow: auto;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  width: 100%;
}

/* Viewer uses an intermediate .bjs-container before .djs-container */
:deep(.viewer-canvas > .bjs-container) {
  width: 100% !important;
  height: 100% !important;
  position: relative !important;
}

:deep(.viewer-canvas .djs-container) {
  width: 100% !important;
  height: 100% !important;
  position: relative !important;
  overflow: visible !important;
}

:deep(.djs-container > svg) {
  width: 100% !important;
  height: 100% !important;
  display: block !important;
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
