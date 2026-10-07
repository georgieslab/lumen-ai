const api = globalThis.browser || globalThis.chrome;
const $ = (id) => document.getElementById(id);
const MAX_CHARS = 20000;
const DEFAULT_LUMEN_URL = 'http://localhost:5173';

const setStatus = (msg) => { $('status').textContent = msg; };

// Runs inside the shared tab. Prefers the user's selection, never reads form field values.
function extractPage(maxChars) {
  const selection = String(window.getSelection() || '').trim();
  const text = (selection || document.body?.innerText || '').slice(0, maxChars);
  return { title: document.title, url: location.href, text, selectionOnly: Boolean(selection) };
}

// Runs inside the Lumen tab. The Lumen app only accepts same-origin window messages.
function deliver(message) {
  window.postMessage({ channel: 'lumen-tab-bridge', ...message }, window.location.origin);
}

async function getActiveTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function parseLumenOrigin(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Lumen URL must be http(s).');
  return url;
}

async function findOrOpenLumenTab(lumenUrl) {
  const pattern = `${lumenUrl.origin}/*`;
  const [existing] = await api.tabs.query({ url: pattern });
  if (existing) return existing;
  const created = await api.tabs.create({ url: lumenUrl.href, active: false });
  await new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === created.id && info.status === 'complete') {
        api.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    api.tabs.onUpdated.addListener(listener);
    setTimeout(resolve, 15000);
  });
  await new Promise((r) => setTimeout(r, 1500));
  return created;
}

async function send(message, lumenUrl) {
  const lumenTab = await findOrOpenLumenTab(lumenUrl);
  await api.scripting.executeScript({ target: { tabId: lumenTab.id }, func: deliver, args: [message] });
  return lumenTab;
}

async function share() {
  try {
    const lumenUrl = parseLumenOrigin($('lumenUrl').value.trim() || DEFAULT_LUMEN_URL);
    // Must be the first awaited call so it stays inside the click's user gesture.
    const granted = await api.permissions.request({ origins: [`${lumenUrl.origin}/*`] });
    if (!granted) return setStatus('Permission to talk to Lumen was declined.');
    await api.storage.local.set({ lumenUrl: lumenUrl.origin });

    const tab = await getActiveTab();
    const [result] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: extractPage, args: [MAX_CHARS] });
    if (!result?.result) return setStatus('This page cannot be shared.');
    const lumenTab = await send({ type: 'TAB_SHARED', payload: result.result }, lumenUrl);
    await api.tabs.update(lumenTab.id, { active: true });
    setStatus('Shared. Lumen can now see this tab until you stop sharing.');
  } catch (err) {
    setStatus(`Could not share: ${err.message}`);
  }
}

async function stop() {
  try {
    const lumenUrl = parseLumenOrigin($('lumenUrl').value.trim() || DEFAULT_LUMEN_URL);
    const [existing] = await api.tabs.query({ url: `${lumenUrl.origin}/*` });
    if (existing) await api.scripting.executeScript({ target: { tabId: existing.id }, func: deliver, args: [{ type: 'TAB_STOPPED' }] });
    setStatus('Sharing stopped.');
  } catch (err) {
    setStatus(`Could not stop: ${err.message}`);
  }
}

(async () => {
  const { lumenUrl } = await api.storage.local.get('lumenUrl');
  $('lumenUrl').value = lumenUrl || DEFAULT_LUMEN_URL;
  const tab = await getActiveTab();
  $('tab').textContent = tab ? `${tab.title || ''} — ${tab.url || ''}` : 'No active tab';
  $('share').addEventListener('click', share);
  $('stop').addEventListener('click', stop);
})();
