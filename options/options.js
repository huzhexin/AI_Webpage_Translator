// AI Webpage Translator - Options Page Script

const STORAGE_KEYS = ['apiEndpoint', 'apiKey', 'model', 'targetLanguage', 'displayMode', 'chunkSize'];

async function loadSettings() {
  const defaults = {
    apiEndpoint: '',
    apiKey: '',
    model: '',
    targetLanguage: 'Chinese (Simplified)',
    displayMode: 'bilingual',
    chunkSize: 4000
  };

  const stored = await chrome.storage.sync.get(STORAGE_KEYS);
  const settings = { ...defaults, ...stored };

  document.getElementById('api-endpoint').value   = settings.apiEndpoint;
  document.getElementById('api-key').value        = settings.apiKey;
  document.getElementById('model-name').value     = settings.model;
  document.getElementById('target-language').value = settings.targetLanguage;
  document.getElementById('display-mode').value   = settings.displayMode;
  document.getElementById('chunk-size').value     = settings.chunkSize;
}

document.getElementById('save-settings').addEventListener('click', async () => {
  const endpoint = document.getElementById('api-endpoint').value.trim().replace(/\/$/, '');
  const apiKey   = document.getElementById('api-key').value.trim();
  const model    = document.getElementById('model-name').value.trim();
  const lang     = document.getElementById('target-language').value;
  const mode     = document.getElementById('display-mode').value;
  const chunk    = parseInt(document.getElementById('chunk-size').value, 10) || 2000;

  if (!endpoint) {
    showSaveStatus('error', 'API endpoint is required.');
    return;
  }

  await chrome.storage.sync.set({
    apiEndpoint:    endpoint,
    apiKey:         apiKey,
    model:          model,
    targetLanguage: lang,
    displayMode:    mode,
    chunkSize:      Math.max(500, Math.min(8000, chunk))
  });

  showSaveStatus('success', 'Settings saved!');
});

document.getElementById('test-connection').addEventListener('click', async () => {
  const resultEl = document.getElementById('test-result');
  resultEl.textContent = 'Testing...';
  resultEl.className = 'test-result test-result--pending';

  // Save current values to storage before testing
  const endpoint = document.getElementById('api-endpoint').value.trim().replace(/\/$/, '');
  const apiKey   = document.getElementById('api-key').value.trim();
  const model    = document.getElementById('model-name').value.trim();

  await chrome.storage.sync.set({
    apiEndpoint: endpoint,
    apiKey:      apiKey,
    model:       model
  });

  const response = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });

  if (response && response.ok) {
    resultEl.textContent = 'Connection successful!';
    resultEl.className = 'test-result test-result--success';
  } else {
    const errMsg = (response && response.error) || 'Unknown error';
    resultEl.textContent = 'Failed: ' + errMsg;
    resultEl.className = 'test-result test-result--error';
  }
});

// Toggle API key visibility
document.getElementById('toggle-api-key').addEventListener('click', () => {
  const input = document.getElementById('api-key');
  input.type = input.type === 'password' ? 'text' : 'password';
});

function showSaveStatus(type, message) {
  const el = document.getElementById('save-status');
  el.textContent = message;
  el.className = 'save-status save-status--' + type;
  setTimeout(() => {
    el.textContent = '';
    el.className = 'save-status';
  }, 3000);
}

loadSettings();
