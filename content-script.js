const getStorage = (storageType) => {
  if (storageType === 'local') {
    return window.localStorage
  }
  if (storageType === 'session') {
    return window.sessionStorage
  }
  return null
}

const readStorageEntries = (storageType) => {
  const storage = getStorage(storageType)
  if (!storage) {
    return { ok: false, error: 'Invalid storage type' }
  }
  const entries = []
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (!key) {
      continue
    }
    entries.push({ name: key, value: storage.getItem(key) })
  }
  return { ok: true, entries }
}

const setStorageEntry = (storageType, key, value) => {
  const storage = getStorage(storageType)
  if (!storage) {
    return { ok: false, error: 'Invalid storage type' }
  }
  if (!key) {
    return { ok: false, error: 'Invalid storage key' }
  }
  storage.setItem(String(key), String(value ?? ''))
  return { ok: true }
}

const removeStorageEntry = (storageType, key) => {
  const storage = getStorage(storageType)
  if (!storage) {
    return { ok: false, error: 'Invalid storage type' }
  }
  if (!key) {
    return { ok: false, error: 'Invalid storage key' }
  }
  storage.removeItem(key)
  return { ok: true }
}

const clearStorageEntries = (storageType) => {
  const storage = getStorage(storageType)
  if (!storage) {
    return { ok: false, error: 'Invalid storage type' }
  }
  storage.clear()
  return { ok: true }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'READ_STORAGE') {
    sendResponse(readStorageEntries(message.storageType))
    return true
  }

  if (message?.type === 'SET_STORAGE') {
    sendResponse(setStorageEntry(message.storageType, message.key, message.value))
    return true
  }

  if (message?.type === 'REMOVE_STORAGE') {
    sendResponse(removeStorageEntry(message.storageType, message.key))
    return true
  }

  if (message?.type === 'CLEAR_STORAGE') {
    sendResponse(clearStorageEntries(message.storageType))
    return true
  }
})
