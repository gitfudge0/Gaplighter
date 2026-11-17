const api = globalThis.browser || globalThis.chrome;
const button = document.querySelector('#toggle');
const status = document.querySelector('#status');
let tab, active = false;
function restricted(url) {
  if (!url || !/^https?:|^file:/.test(url)) return true;
  try {
    const { hostname, pathname } = new URL(url);
    return hostname === 'chromewebstore.google.com' || (hostname === 'chrome.google.com' && pathname.startsWith('/webstore')) || hostname === 'addons.mozilla.org';
  } catch { return true; }
}
function update() { button.textContent = active ? 'Stop inspection' : 'Start inspection'; button.disabled = false; }
async function initialize() {
  try {
    [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (restricted(tab?.url)) {
      button.textContent = 'Unavailable on this page';
      status.textContent = 'Open a regular website. Browser pages and extension stores block inspection.';
      return;
    }
    try { active = Boolean((await api.tabs.sendMessage(tab.id, { type: 'gaplighter:status' }, { frameId: 0 }))?.active); } catch { /* Not injected into this document yet. */ }
    update();
  } catch { button.textContent = 'Page unavailable'; status.textContent = 'Close this popup and try again on a regular website.'; }
}
button.addEventListener('click', async () => {
  button.disabled = true; status.textContent = '';
  try {
    await api.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, files: ['content.js'] });
    const result = await api.tabs.sendMessage(tab.id, { type: 'gaplighter:toggle' }, { frameId: 0 });
    active = result.active;
    update();
    if (active) window.close();
  } catch {
    update();
    status.textContent = 'This page blocked inspection. Try reloading it, or use a regular website. For local files, enable file URL access in extension settings.';
  }
});
initialize();
