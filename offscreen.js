chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "COPY_TO_CLIPBOARD") {
    return;
  }

  navigator.clipboard
    .writeText(String(message.text ?? ""))
    .then(() => {
      sendResponse({ ok: true });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: String(error) });
    });

  return true;
});
