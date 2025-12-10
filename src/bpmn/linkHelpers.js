const NAMESPACE_PREFIX = 'pp'
const ATTRIBUTE_NAME = `${NAMESPACE_PREFIX}:linkedProcessId`

export function getLinkedProcessId(businessObject) {
  if (!businessObject) return null

  if (typeof businessObject.get === 'function') {
    const value = businessObject.get('linkedProcessId')
    if (value !== undefined) {
      return value || null
    }
  }

  if ('linkedProcessId' in businessObject) {
    return businessObject.linkedProcessId || null
  }

  const attr = businessObject.$attrs?.[ATTRIBUTE_NAME]
  return attr ?? null
}

export function setLinkedProcessId(businessObject, id) {
  if (!businessObject) return

  const isUnset = id === null || id === undefined || id === ''

  if (isUnset) {
    if (typeof businessObject.set === 'function') {
      businessObject.set('linkedProcessId', undefined)
    } else if ('linkedProcessId' in businessObject) {
      delete businessObject.linkedProcessId
    }

    if (businessObject.$attrs && ATTRIBUTE_NAME in businessObject.$attrs) {
      delete businessObject.$attrs[ATTRIBUTE_NAME]
    }
    return
  }

  if (typeof businessObject.set === 'function') {
    businessObject.set('linkedProcessId', id)
  } else {
    businessObject.linkedProcessId = id
  }

  if (businessObject.$attrs) {
    businessObject.$attrs[ATTRIBUTE_NAME] = id
  }
}
