import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer'
import { is } from 'bpmn-js/lib/util/ModelUtil'

const HIGH_PRIORITY = 1500

function getVar(theme, key, fallback) {
  return theme?.cssVars?.[key] || fallback
}

class ThemedRenderer extends BaseRenderer {
  constructor(eventBus, bpmnRenderer, config = {}) {
    super(eventBus, HIGH_PRIORITY)
    this.bpmnRenderer = bpmnRenderer
    this.getTheme = config.getTheme || (() => config.theme || {})
  }

  canRender(element) {
    return !element.labelTarget
  }

  drawShape(parentNode, element) {
    const shape = this.bpmnRenderer.drawShape(parentNode, element)
    const theme = this.getTheme()
    const colors = this._getShapeColors(element, theme)

    if (shape && colors) {
      Object.entries(colors).forEach(([attr, value]) => {
        if (value != null) {
          shape.setAttribute(attr, value)
        }
      })
    }

    return shape
  }

  drawConnection(parentNode, element) {
    const connection = this.bpmnRenderer.drawConnection(parentNode, element)
    const theme = this.getTheme()
    const stroke = getVar(theme, '--pp-primary', '#2563eb')

    if (connection && stroke) {
      connection.setAttribute('stroke', stroke)
    }

    return connection
  }

  _getShapeColors(element, theme) {
    const primary = getVar(theme, '--pp-primary', '#2563eb')
    const accent = getVar(theme, '--pp-accent', '#ec4899')
    const surface = getVar(theme, '--pp-surface', '#ffffff')
    const background = getVar(theme, '--pp-bg', '#f5f7fb')
    const border = getVar(theme, '--pp-border', '#d2d7e0')
    const success = getVar(theme, '--pp-success', '#22c55e')

    if (is(element, 'bpmn:Task')) {
      return {
        fill: '#ffffff',
        stroke: primary,
        'stroke-width': 2,
      }
    }

    if (is(element, 'bpmn:StartEvent')) {
      return {
        fill: surface,
        stroke: success || primary,
        'stroke-width': 2,
      }
    }

    if (is(element, 'bpmn:EndEvent')) {
      return {
        fill: surface,
        stroke: accent || primary,
        'stroke-width': 2,
      }
    }

    if (is(element, 'bpmn:Gateway')) {
      return {
        fill: surface,
        stroke: primary,
        'stroke-width': 2,
      }
    }

    if (is(element, 'bpmn:Participant') || is(element, 'bpmn:Lane')) {
      return {
        fill: background,
        stroke: border,
      }
    }

    return {
      fill: surface,
      stroke: border,
    }
  }
}

ThemedRenderer.$inject = ['eventBus', 'bpmnRenderer', 'themedRendererConfig']

export default function createThemedRendererModule(options = {}) {
  return {
    __init__: ['themedRenderer'],
    themedRenderer: ['type', ThemedRenderer],
    themedRendererConfig: ['value', options],
  }
}
