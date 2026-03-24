// AI Webpage Translator - Popup Script

async function init() {
  const settings = await chrome.storage.sync.get([
    'targetLanguage', 'displayMode', 'apiKey', 'apiEndpoint', 'model'
  ]);

  // Populate quick settings
  document.getElementById('select-target-lang').value = settings.targetLanguage || 'Chinese (Simplified)';
  document.getElementById('select-display-mode').value = settings.displayMode || 'bilingual';

  // Show model indicator
  const modelEl = document.getElementById('model-indicator');
  modelEl.textContent = settings.model || 'No model configured';

  // Show warning if API not configured
  if (!settings.apiKey || !settings.apiEndpoint || !settings.model) {
    showBanner('warning', 'API not configured. Open Settings to get started.');
    document.getElementById('btn-translate-page').disabled = true;
    return;
  }

  // Query current tab translation status
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  // Check if this is a page we can translate
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
    showBanner('warning', 'Cannot translate this page.');
    document.getElementById('btn-translate-page').disabled = true;
    return;
  }

  // Try to get page status (content script may or may not be loaded yet)
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_STATUS' });
    if (response && response.status === 'translating') {
      showBanner('info', 'Translation in progress...');
      document.getElementById('btn-translate-page').disabled = true;
      document.getElementById('btn-restore').disabled = false;
    } else if (response && response.status === 'translated') {
      document.getElementById('btn-restore').disabled = false;
      showBanner('success', 'Page has been translated.');
    }
  } catch (_) {
    // Content script not yet injected — that's fine, we'll inject on demand
  }
}

// Ensure content scripts are injected into the tab, then send a message
async function ensureContentScriptAndSend(tabId, message) {
  // First try sending directly
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (_) {
    // Content script not loaded — inject all scripts and CSS first
  }

  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content/content.css']
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      'content/text-extractor.js',
      'content/dom-manipulator.js',
      'content/floating-panel.js',
      'content/content.js'
    ]
  });

  // Small delay to let scripts initialize
  await new Promise(r => setTimeout(r, 100));

  return await chrome.tabs.sendMessage(tabId, message);
}

document.getElementById('btn-translate-page').addEventListener('click', async () => {
  await chrome.storage.sync.set({
    targetLanguage: document.getElementById('select-target-lang').value,
    displayMode: document.getElementById('select-display-mode').value
  });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await ensureContentScriptAndSend(tab.id, { type: 'TRIGGER_FULL_PAGE' });
    window.close();
  } catch (e) {
    showBanner('error', 'Error: ' + e.message);
  }
});

document.getElementById('btn-restore').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_PAGE' });
    window.close();
  } catch (e) {
    showBanner('error', 'Failed to restore page: ' + e.message);
  }
});

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
});

document.getElementById('select-target-lang').addEventListener('change', saveQuickSettings);
document.getElementById('select-display-mode').addEventListener('change', saveQuickSettings);

async function saveQuickSettings() {
  await chrome.storage.sync.set({
    targetLanguage: document.getElementById('select-target-lang').value,
    displayMode: document.getElementById('select-display-mode').value
  });
}

function showBanner(type, text) {
  const banner = document.getElementById('status-banner');
  banner.textContent = text;
  banner.className = 'status-banner status-banner--' + type;
  banner.style.display = 'block';
}

init();
