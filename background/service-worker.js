// AI Webpage Translator - Background Service Worker
// All API calls happen here to avoid CORS issues in content scripts

// ---- Context Menu Registration ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate "%s"',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'translate-page',
    title: 'Translate Full Page',
    contexts: ['page']
  });
});

// ---- Context Menu Handler ----
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_SELECTION_TRANSLATION',
      text: info.selectionText
    });
  }
  if (info.menuItemId === 'translate-page') {
    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_FULL_PAGE' });
  }
});

// ---- Message Router ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'TRANSLATE_CHUNKS':
      handleTranslateChunks(message, sendResponse);
      return true; // keep channel open for async

    case 'TRANSLATE_SELECTION':
      handleTranslateSelection(message, sendResponse);
      return true;

    case 'GET_SETTINGS':
      getSettingsAsync().then(sendResponse);
      return true;

    case 'TEST_CONNECTION':
      handleTestConnection(sendResponse);
      return true;
  }
});

// ---- Settings ----
async function getSettingsAsync() {
  const defaults = {
    apiEndpoint: '',
    apiKey: '',
    model: '',
    targetLanguage: 'Chinese (Simplified)',
    displayMode: 'bilingual',
    chunkSize: 4000
  };
  const stored = await chrome.storage.sync.get(Object.keys(defaults));
  return { ...defaults, ...stored };
}

// ---- Core API Call ----
async function callOpenAI(settings, systemPrompt, userContent) {
  const endpoint = settings.apiEndpoint.replace(/\/$/, '');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  // If endpoint already ends with /chat/completions (full URL), use directly.
  // Otherwise append the standard OpenAI path.
  const url = /\/chat\/completions$/.test(endpoint)
    ? endpoint
    : `${endpoint}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try {
      const errData = await response.json();
      errMsg = errData.error?.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await response.json();

  // Guard against unexpected response shapes
  if (!data.choices || data.choices.length === 0) {
    const detail = JSON.stringify(data).slice(0, 200);
    throw new Error(`Unexpected API response (no choices): ${detail}`);
  }

  const content = data.choices[0]?.message?.content;
  if (content === undefined || content === null) {
    throw new Error(`Unexpected API response (no content): ${JSON.stringify(data.choices[0]).slice(0, 200)}`);
  }

  return content.trim();
}

// ---- System Prompt Builder ----
function buildTranslationSystemPrompt(targetLanguage) {
  return `You are a professional translator. Translate the following numbered lines to ${targetLanguage}.

Rules:
- Return EXACTLY the same number of lines as input, each prefixed with its original number like [1], [2], etc.
- Do NOT merge, split, or skip any lines.
- Preserve HTML entities and special characters exactly as they appear.
- Do NOT translate: proper nouns, code snippets, URLs, email addresses, brand names.
- Return ONLY the translated numbered lines, nothing else — no explanations, no extra text.`;
}

// ---- Parse Numbered Response ----
function parseNumberedResponse(raw, expectedCount) {
  const results = new Array(expectedCount).fill('');
  const lines = raw.split('\n');
  for (const line of lines) {
    const match = line.match(/^\[(\d+)\]\s*(.*)/);
    if (match) {
      const idx = parseInt(match[1], 10) - 1;
      if (idx >= 0 && idx < expectedCount) {
        results[idx] = match[2].trim();
      }
    }
  }
  return results;
}

// ---- Translate Single Chunk Handler ----
// Each chunk is now sent as an individual message and processed independently.
async function handleTranslateChunks(message, sendResponse) {
  const settings = await getSettingsAsync();
  const { index, texts } = message;

  const numbered = texts.map((t, i) => `[${i + 1}] ${t}`).join('\n');
  const systemPrompt = buildTranslationSystemPrompt(settings.targetLanguage);

  try {
    const raw = await callOpenAI(settings, systemPrompt, numbered);
    sendResponse({ ok: true, index, translations: parseNumberedResponse(raw, texts.length) });
  } catch (e) {
    console.error('[AI Translator] Chunk translation error:', e.message);
    sendResponse({ ok: false, index, translations: texts.map(() => '') });
  }
}

// ---- Translate Selection Handler ----
async function handleTranslateSelection(message, sendResponse) {
  const settings = await getSettingsAsync();
  const systemPrompt = `You are a professional translator. Translate the following text to ${settings.targetLanguage}. Return ONLY the translation, nothing else.`;

  try {
    const translation = await callOpenAI(settings, systemPrompt, message.text);
    sendResponse({ ok: true, translation });
  } catch (e) {
    console.error('[AI Translator] Selection translation error:', e.message);
    sendResponse({ ok: false, error: e.message });
  }
}

// ---- Test Connection Handler ----
async function handleTestConnection(sendResponse) {
  const settings = await getSettingsAsync();
  if (!settings.apiEndpoint) {
    sendResponse({ ok: false, error: 'API endpoint not configured' });
    return;
  }

  const systemPrompt = 'You are a helpful assistant.';
  const userContent = 'Reply with exactly: OK';

  try {
    const result = await callOpenAI(settings, systemPrompt, userContent);
    sendResponse({ ok: true, message: result });
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
}
