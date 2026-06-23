chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.type === 'create-blob-url') {
    const { buffer, mime } = message as { buffer: ArrayBuffer; mime?: string };
    const blob = new Blob([buffer], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    sendResponse({ url });
    return true;
  }

  if (message.type === 'revoke-blob-url') {
    URL.revokeObjectURL(message.url as string);
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

export {};
