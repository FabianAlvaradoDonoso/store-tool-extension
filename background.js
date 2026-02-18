const OFFSCREEN_URL = 'offscreen.html'

const ensureOffscreenDocument = async () => {
  const existing = await chrome.offscreen.hasDocument()
  if (existing) {
    return
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['CLIPBOARD'],
    justification: 'Copy access-token cookie to clipboard'
  })
}

const copyToClipboardWithOffscreen = async (text) => {
  await ensureOffscreenDocument()
  const response = await chrome.runtime.sendMessage({
    type: 'COPY_TO_CLIPBOARD',
    text
  })
  if (!response?.ok) {
    throw new Error(response?.error || 'Clipboard write failed')
  }
}

const copyToClipboard = async (text) => {
  await copyToClipboardWithOffscreen(text)
}

const getActiveTabUrl = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const activeTab = tabs[0]
  if (!activeTab || !activeTab.url) {
    return null
  }
  return activeTab.url
}

const setActionFeedback = async (text) => {
  await chrome.action.setBadgeText({ text })
  await chrome.action.setBadgeBackgroundColor({ color: '#2b6d4a' })
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' })
  }, 1500)
}

const setActionError = async (text) => {
  await chrome.action.setBadgeText({ text })
  await chrome.action.setBadgeBackgroundColor({ color: '#b5473e' })
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' })
  }, 2000)
}

const getCookiesForUrl = async (url) => {
  const allCookies = await chrome.cookies.getAll({ url })
  return allCookies
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'COPY_TEXT') {
    copyToClipboard(String(message.text ?? ''))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }))
    return true
  }

  if (message?.type === 'GET_COOKIES') {
    getActiveTabUrl()
      .then((url) => {
        if (!url) {
          throw new Error('Active tab URL not available')
        }
        return getCookiesForUrl(url)
      })
      .then((cookies) => sendResponse({ ok: true, cookies }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }))
    return true
  }

  if (message?.type === 'REMOVE_COOKIE') {
    const details = message.details
    if (!details?.url || !details?.name) {
      sendResponse({ ok: false, error: 'Invalid cookie details' })
      return false
    }
    chrome.cookies
      .remove(details)
      .then((result) => sendResponse({ ok: Boolean(result) }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }))
    return true
  }

  if (message?.type === 'SET_COOKIE') {
    const details = message.details
    if (!details?.url || !details?.name) {
      sendResponse({ ok: false, error: 'Invalid cookie details' })
      return false
    }
    chrome.cookies
      .set(details)
      .then((result) => sendResponse({ ok: Boolean(result) }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }))
    return true
  }
})
