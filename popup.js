const cookiesList = document.getElementById('cookies-list')
const localStorageList = document.getElementById('local-storage-list')
const sessionStorageList = document.getElementById('session-storage-list')
const cookiesCount = document.getElementById('cookies-count')
const localStorageCount = document.getElementById('local-storage-count')
const sessionStorageCount = document.getElementById('session-storage-count')
const activeDomainLabel = document.getElementById('active-domain')
const refreshButton = document.getElementById('refresh')
const cookiesDeleteAll = document.getElementById('cookies-delete-all')
const localStorageDeleteAll = document.getElementById(
  'local-storage-delete-all'
)
const sessionStorageDeleteAll = document.getElementById(
  'session-storage-delete-all'
)

let currentHost = ''

const maskValue = (value) => {
  const text = String(value ?? '')
  if (text.length <= 8) {
    return text
  }
  return `${text.slice(0, 4)}...${text.slice(-4)}`
}

const clearList = (element) => {
  element.innerHTML = ''
}

const renderEmpty = (element, message) => {
  const empty = document.createElement('p')
  empty.className = 'empty'
  empty.textContent = message
  element.appendChild(empty)
}

const copyWithPopupClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(String(text ?? ''))
    return true
  } catch (error) {
    return false
  }
}

const copyWithActiveTab = async (text) => {
  const tab = await fetchActiveTab()
  if (!tab?.id) {
    return false
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (value) => {
      const textValue = String(value ?? '')
      return navigator.clipboard
        .writeText(textValue)
        .then(() => ({ ok: true }))
        .catch((error) => ({ ok: false, error: String(error) }))
    },
    args: [text]
  })
  return Boolean(results?.[0]?.result?.ok)
}

const copyText = async (text, toastTarget) => {
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'COPY_TEXT', text }, (reply) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message })
        return
      }
      resolve(reply)
    })
  })

  if (response?.ok) {
    showToast(toastTarget, 'Copied')
    return
  }

  const popupCopied = await copyWithPopupClipboard(text)
  if (popupCopied) {
    showToast(toastTarget, 'Copied')
    return
  }

  const tabCopied = await copyWithActiveTab(text)
  if (tabCopied) {
    showToast(toastTarget, 'Copied')
    return
  }

  showToast(toastTarget, 'Copy failed', true)
}

const showToast = (target, message, isError = false) => {
  const toast = document.createElement('div')
  toast.className = `toast${isError ? ' error' : ''}`
  toast.textContent = message
  target.appendChild(toast)
  setTimeout(() => {
    toast.remove()
  }, 1500)
}

const setCookieValue = async (cookie, value) => {
  if (!cookie) {
    return false
  }
  const protocol = cookie.secure ? 'https://' : 'http://'
  const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain
  const url = `${protocol}${domain}${cookie.path}`
  const details = {
    url,
    name: cookie.name,
    value,
    path: cookie.path,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    storeId: cookie.storeId
  }

  if (cookie.domain) {
    details.domain = cookie.domain
  }

  if (typeof cookie.expirationDate === 'number') {
    details.expirationDate = cookie.expirationDate
  }

  const response = await chrome.runtime.sendMessage({
    type: 'SET_COOKIE',
    details
  })

  return Boolean(response?.ok)
}

const setStorageValue = async (storageType, key, value) => {
  const tab = await fetchActiveTab()
  if (!tab?.id) {
    return false
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (type, itemKey, itemValue) => {
      const storage = type === 'local' ? window.localStorage : window.sessionStorage
      storage.setItem(itemKey, itemValue)
      return true
    },
    args: [storageType, key, String(value ?? '')]
  })
  return Boolean(results?.[0]?.result)
}

const createItem = ({ name, value, showName = true, onSave }) => {
  const container = document.createElement('div')
  container.className = 'item'

  const content = document.createElement('div')
  if (showName) {
    const title = document.createElement('p')
    title.className = 'item-name'
    title.textContent = name
    content.appendChild(title)
  }

  const masked = document.createElement('p')
  masked.className = 'item-value'
  masked.textContent = maskValue(value)
  content.appendChild(masked)

  const controls = document.createElement('div')
  controls.className = 'item-controls'

  const showButton = document.createElement('button')
  showButton.className = 'item-button secondary'
  showButton.textContent = 'Show'

  const copyButton = document.createElement('button')
  copyButton.className = 'item-button'
  copyButton.textContent = 'Copy'

  const editButton = document.createElement('button')
  editButton.className = 'item-button warning'
  editButton.textContent = 'Edit'

  const deleteButton = document.createElement('button')
  deleteButton.className = 'item-button danger'
  deleteButton.textContent = 'Delete'

  let isMasked = true
  showButton.addEventListener('click', () => {
    isMasked = !isMasked
    masked.textContent = isMasked ? maskValue(value) : String(value ?? '')
    showButton.textContent = isMasked ? 'Show' : 'Hide'
  })

  const resetDeleteButton = (label = 'Delete') => {
    deleteButton.textContent = label
    deleteButton.dataset.confirming = 'false'
    deleteButton.classList.remove('confirming')
  }

  deleteButton.dataset.confirming = 'false'

  copyButton.addEventListener('click', async () => {
    copyButton.disabled = true
    await copyText(String(value ?? ''), container)
    copyButton.disabled = false
  })

  const enterEditMode = () => {
    if (!onSave) {
      return
    }

    const editWrapper = document.createElement('div')
    editWrapper.className = 'item-edit'
    const input = document.createElement('textarea')
    input.className = 'item-input'
    input.rows = 3
    input.value = String(value ?? '')

    const editControls = document.createElement('div')
    editControls.className = 'item-controls'

    const saveButton = document.createElement('button')
    saveButton.className = 'item-button'
    saveButton.textContent = 'Save'

    const cancelButton = document.createElement('button')
    cancelButton.className = 'item-button ghost'
    cancelButton.textContent = 'Cancel'

    editControls.appendChild(saveButton)
    editControls.appendChild(cancelButton)
    editWrapper.appendChild(input)
    editWrapper.appendChild(editControls)

    content.replaceChildren(editWrapper)
    controls.replaceChildren(saveButton, cancelButton)
    input.focus()

    const exitEdit = () => {
      content.replaceChildren(masked)
      if (showName) {
        const title = document.createElement('p')
        title.className = 'item-name'
        title.textContent = name
        content.prepend(title)
      }
      masked.textContent = isMasked ? maskValue(value) : String(value ?? '')
      controls.replaceChildren(showButton, copyButton, editButton, deleteButton)
    }

    cancelButton.addEventListener('click', exitEdit)

    saveButton.addEventListener('click', async () => {
      saveButton.disabled = true
      const newValue = input.value
      const ok = await onSave(newValue)
      saveButton.disabled = false
      if (!ok) {
        showToast(container, 'Save failed', true)
        return
      }
      value = newValue
      isMasked = true
      showButton.textContent = 'Show'
      showToast(container, 'Saved')
      exitEdit()
    })
  }

  editButton.addEventListener('click', enterEditMode)

  controls.appendChild(showButton)
  controls.appendChild(copyButton)
  controls.appendChild(editButton)
  controls.appendChild(deleteButton)
  container.appendChild(content)
  container.appendChild(controls)
  return { container, deleteButton, resetDeleteButton }
}

const sortByName = (entries) => {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name))
}

const fetchActiveTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

const getStorageEntries = async (type) => {
  const tab = await fetchActiveTab()
  if (!tab?.id) {
    return []
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (storageType) => {
      const storage =
        storageType === 'local' ? window.localStorage : window.sessionStorage
      const entries = []
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i)
        if (!key) {
          continue
        }
        entries.push({ name: key, value: storage.getItem(key) })
      }
      return entries
    },
    args: [type]
  })

  return results?.[0]?.result ?? []
}

const getCookies = async () => {
  const response = await chrome.runtime.sendMessage({ type: 'GET_COOKIES' })
  if (!response?.ok) {
    return []
  }
  return response.cookies ?? []
}

const deleteCookie = async (cookie) => {
  if (!cookie) {
    return false
  }
  const protocol = cookie.secure ? 'https://' : 'http://'
  const domain = cookie.domain.startsWith('.')
    ? cookie.domain.slice(1)
    : cookie.domain
  const url = `${protocol}${domain}${cookie.path}`
  const response = await chrome.runtime.sendMessage({
    type: 'REMOVE_COOKIE',
    details: {
      url,
      name: cookie.name,
      storeId: cookie.storeId
    }
  })
  return Boolean(response?.ok)
}

const deleteAllCookiesForHost = async (cookies, host) => {
  const exactCookies = cookies.filter((cookie) => cookie.domain === host)

  const results = await Promise.all(
    exactCookies.map((cookie) => deleteCookie(cookie))
  )
  return results.every(Boolean)
}

const updateListAfterDelete = (
  listElement,
  countElement,
  emptyMessage,
  deleteAllButton
) => {
  const remaining = listElement.querySelectorAll('.item').length
  countElement.textContent = String(remaining)
  if (deleteAllButton) {
    deleteAllButton.disabled = remaining === 0
  }
  if (remaining === 0) {
    renderEmpty(listElement, emptyMessage)
  }
}

const deleteStorageItem = async (storageType, key) => {
  const tab = await fetchActiveTab()
  if (!tab?.id) {
    return false
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (type, itemKey) => {
      const storage =
        type === 'local' ? window.localStorage : window.sessionStorage
      storage.removeItem(itemKey)
      return true
    },
    args: [storageType, key]
  })
  return Boolean(results?.[0]?.result)
}

const clearStorage = async (storageType) => {
  const tab = await fetchActiveTab()
  if (!tab?.id) {
    return false
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (type) => {
      const storage =
        type === 'local' ? window.localStorage : window.sessionStorage
      storage.clear()
      return true
    },
    args: [storageType]
  })
  return Boolean(results?.[0]?.result)
}

const renderCookies = (cookies) => {
  clearList(cookiesList)
  cookiesCount.textContent = String(cookies.length)
  cookiesDeleteAll.disabled = cookies.length === 0
  if (cookies.length === 0) {
    renderEmpty(cookiesList, 'No cookies available for this domain.')
    return
  }

  sortByName(cookies).forEach((cookie) => {
    const { container, deleteButton, resetDeleteButton } = createItem({
      name: cookie.name,
      value: cookie.value,
      onSave: async (newValue) => setCookieValue(cookie, newValue)
    })
    deleteButton.addEventListener('click', async () => {
      if (!triggerDeleteConfirm(deleteButton, resetDeleteButton, 'Delete')) {
        return
      }
      deleteButton.disabled = true
      const ok = await deleteCookie(cookie)
      deleteButton.disabled = false
      resetDeleteButton()
      if (!ok) {
        showToast(container, 'Delete failed', true)
        return
      }
      container.remove()
      updateListAfterDelete(
        cookiesList,
        cookiesCount,
        'No cookies available for this domain.',
        cookiesDeleteAll
      )
      showToast(cookiesList, 'Deleted')
    })
    cookiesList.appendChild(container)
  })
}

const renderStorage = (
  element,
  countElement,
  entries,
  emptyMessage,
  storageType,
  deleteAllButton
) => {
  clearList(element)
  countElement.textContent = String(entries.length)
  if (deleteAllButton) {
    deleteAllButton.disabled = entries.length === 0
  }
  if (entries.length === 0) {
    renderEmpty(element, emptyMessage)
    return
  }
  sortByName(entries).forEach((entry) => {
    const { container, deleteButton, resetDeleteButton } = createItem({
      name: entry.name,
      value: entry.value,
      onSave: async (newValue) => setStorageValue(storageType, entry.name, newValue)
    })
    deleteButton.addEventListener('click', async () => {
      if (!triggerDeleteConfirm(deleteButton, resetDeleteButton, 'Delete')) {
        return
      }
      deleteButton.disabled = true
      const ok = await deleteStorageItem(storageType, entry.name)
      deleteButton.disabled = false
      resetDeleteButton()
      if (!ok) {
        showToast(container, 'Delete failed', true)
        return
      }
      container.remove()
      updateListAfterDelete(
        element,
        countElement,
        emptyMessage,
        deleteAllButton
      )
      showToast(element, 'Deleted')
    })
    element.appendChild(container)
  })
}

const setActiveDomain = (url) => {
  try {
    const parsed = new URL(url)
    activeDomainLabel.textContent = parsed.host
    currentHost = parsed.host
  } catch (error) {
    activeDomainLabel.textContent = 'Unknown domain'
    currentHost = ''
  }
}

const loadData = async () => {
  refreshButton.disabled = true
  const tab = await fetchActiveTab()
  if (!tab?.url) {
    activeDomainLabel.textContent = 'No active tab'
    renderEmpty(cookiesList, 'No active tab.')
    renderEmpty(localStorageList, 'No active tab.')
    renderEmpty(sessionStorageList, 'No active tab.')
    cookiesDeleteAll.disabled = true
    localStorageDeleteAll.disabled = true
    sessionStorageDeleteAll.disabled = true
    refreshButton.disabled = false
    return
  }

  setActiveDomain(tab.url)

  const [cookies, localEntries, sessionEntries] = await Promise.all([
    getCookies(),
    getStorageEntries('local'),
    getStorageEntries('session')
  ])

  renderCookies(cookies)
  renderStorage(
    localStorageList,
    localStorageCount,
    localEntries,
    'No local storage entries.',
    'local',
    localStorageDeleteAll
  )
  renderStorage(
    sessionStorageList,
    sessionStorageCount,
    sessionEntries,
    'No session storage entries.',
    'session',
    sessionStorageDeleteAll
  )

  refreshButton.disabled = false
}

refreshButton.addEventListener('click', loadData)

const wireDeleteAll = () => {
  const createConfirmHandler = (button, onConfirm) => {
    let timeoutId = null

    const reset = () => {
      button.textContent = 'Delete All'
      button.dataset.confirming = 'false'
      button.classList.remove('confirming')
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const confirm = async () => {
      if (button.dataset.confirming !== 'true') {
        button.dataset.confirming = 'true'
        button.textContent = 'Confirm'
        button.classList.add('confirming')
        timeoutId = setTimeout(reset, 3000)
        return
      }
      await onConfirm(reset)
    }

    button.dataset.confirming = 'false'
    button.addEventListener('click', confirm)
  }

  createConfirmHandler(cookiesDeleteAll, async (reset) => {
    cookiesDeleteAll.disabled = true
    if (!currentHost) {
      cookiesDeleteAll.disabled = false
      reset()
      showToast(cookiesList, 'Delete failed', true)
      return
    }
    const cookies = await getCookies()
    const ok = await deleteAllCookiesForHost(cookies, currentHost)
    cookiesDeleteAll.disabled = false
    reset()
    if (!ok) {
      showToast(cookiesList, 'Delete failed', true)
      return
    }
    renderCookies(cookies.filter((cookie) => cookie.domain !== currentHost))
    showToast(cookiesList, 'Deleted')
  })

  createConfirmHandler(localStorageDeleteAll, async (reset) => {
    localStorageDeleteAll.disabled = true
    const ok = await clearStorage('local')
    localStorageDeleteAll.disabled = false
    reset()
    if (!ok) {
      showToast(localStorageList, 'Delete failed', true)
      return
    }
    renderStorage(
      localStorageList,
      localStorageCount,
      [],
      'No local storage entries.',
      'local',
      localStorageDeleteAll
    )
    showToast(localStorageList, 'Deleted')
  })

  createConfirmHandler(sessionStorageDeleteAll, async (reset) => {
    sessionStorageDeleteAll.disabled = true
    const ok = await clearStorage('session')
    sessionStorageDeleteAll.disabled = false
    reset()
    if (!ok) {
      showToast(sessionStorageList, 'Delete failed', true)
      return
    }
    renderStorage(
      sessionStorageList,
      sessionStorageCount,
      [],
      'No session storage entries.',
      'session',
      sessionStorageDeleteAll
    )
    showToast(sessionStorageList, 'Deleted')
  })
}

const triggerDeleteConfirm = (button, resetButton, label) => {
  if (button.dataset.confirming === 'true') {
    return true
  }
  button.dataset.confirming = 'true'
  button.textContent = 'Confirm'
  button.classList.add('confirming')
  setTimeout(() => {
    resetButton(label)
  }, 3000)
  return false
}

wireDeleteAll()

loadData()
