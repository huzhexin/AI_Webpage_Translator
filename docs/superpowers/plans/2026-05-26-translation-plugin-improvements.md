# Translation Plugin Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 2 bugs (progress bar track missing, double-translate guard), add header-only drag to the floating panel, and engineer the selection translation pipeline (race condition fix, result caching, settings caching).

**Architecture:** All changes are isolated to 4 existing files. No new files or modules are introduced. The floating panel grows drag state variables scoped to the `floating-panel.js` IIFE boundary. Selection caching and race-condition state live in the `content.js` IIFE. Service-worker settings cache is a module-level variable invalidated via `chrome.storage.onChanged`.

**Tech Stack:** Vanilla JS (ES2020), Chrome Extensions Manifest V3, no build step, no test framework — verification is manual in-browser.

---

## File Map

| File | What changes |
|------|-------------|
| `content/content.js` | Fix progress bar track element; add `pageTranslated` guard; add `currentSelectionRequestId`; add `selectionCache` Map |
| `content/floating-panel.js` | Add grip icon to header HTML; add drag state variables; bind mousedown/mousemove/mouseup for drag |
| `content/content.css` | Add `.ai-trans-panel-grip` styles; add `cursor: grab/grabbing` to header |
| `background/service-worker.js` | Add `cachedSettings` module variable; update `getSettingsAsync()`; add `chrome.storage.onChanged` listener |

---

## Task 1: Fix Progress Bar Track Element

**Files:**
- Modify: `content/content.js:170-188`

**Context:** `showProgressBar()` appends `progressBarEl` (`.ai-trans-progress-bar`) directly to `progressContainerEl`. The CSS class `.ai-trans-progress-track` (grey background, `flex:1`) is defined but never instantiated, so the track background is invisible and the bar width calculation is wrong.

- [ ] **Step 1: Replace the body of `showProgressBar()` in `content/content.js`**

Find the block starting at line 172 (`if (!progressContainerEl) {`) and replace the interior so it reads:

```js
function showProgressBar(current, total) {
  if (!progressContainerEl) {
    progressContainerEl = document.createElement('div');
    progressContainerEl.className = 'ai-trans-progress-container';

    progressBarEl = document.createElement('div');
    progressBarEl.className = 'ai-trans-progress-bar';

    const labelEl = document.createElement('span');
    labelEl.className = 'ai-trans-progress-label';
    labelEl.textContent = 'AI Translating...';

    const progressTrackEl = document.createElement('div');
    progressTrackEl.className = 'ai-trans-progress-track';
    progressTrackEl.appendChild(progressBarEl);

    progressContainerEl.appendChild(labelEl);
    progressContainerEl.appendChild(progressTrackEl);
    document.documentElement.appendChild(progressContainerEl);
  }

  progressContainerEl.style.display = 'flex';
  updateProgressBar(current, total);
}
```

- [ ] **Step 2: Verify manually**

Load the extension in Chrome (`chrome://extensions` → Load unpacked → select repo root). Open any webpage, click the extension popup → "Translate Page". Confirm the progress bar now shows a **grey track** behind the blue/green fill.

- [ ] **Step 3: Commit**

```bash
git add content/content.js
git commit -m "fix: create progress bar track element in showProgressBar"
```

---

## Task 2: Add `pageTranslated` Guard

**Files:**
- Modify: `content/content.js:103`

**Context:** `startFullPageTranslation()` checks `translationInProgress` but not `pageTranslated`. After a successful translation, clicking translate again re-shows the progress bar and re-runs the extraction (which returns 0 nodes due to `data-ai-translated` filtering), wasting cycles and causing a ghost progress bar.

- [ ] **Step 1: Update the guard at the top of `startFullPageTranslation()`**

Find line 103:
```js
if (translationInProgress) return;
```

Replace with:
```js
if (translationInProgress || pageTranslated) return;
```

- [ ] **Step 2: Verify manually**

Translate a page. After translation completes, click "Translate Page" again. Confirm the progress bar does **not** reappear and no console errors are thrown.

- [ ] **Step 3: Commit**

```bash
git add content/content.js
git commit -m "fix: prevent full-page translation from re-running after completion"
```

---

## Task 3: Add Header-Only Drag to Floating Panel

**Files:**
- Modify: `content/floating-panel.js`
- Modify: `content/content.css`

**Context:** The panel has no drag support. We add a grip icon to the header, then bind mousedown on the header (recording offset), mousemove on document (updating position, clamped to viewport), and mouseup on document (releasing). The existing `mousedown` panel-close handler in `content.js` checks `panel.contains(e.target)` — the header is inside the panel, so no conflict.

- [ ] **Step 1: Update header HTML in `floating-panel.js`**

In `AI_TRANS.showFloatingPanel`, find the `panelEl.innerHTML = ...` assignment (lines 20–27). Replace it with:

```js
    panelEl.innerHTML =
      '<div class="ai-trans-panel-header">' +
        '<span class="ai-trans-panel-grip" aria-hidden="true">⠿</span>' +
        '<span class="ai-trans-panel-title">AI Translation</span>' +
        '<span class="ai-trans-panel-close" role="button" aria-label="Close" tabindex="0">&#x2715;</span>' +
      '</div>' +
      '<div class="ai-trans-panel-body"></div>' +
      '<div class="ai-trans-panel-source"></div>';
```

- [ ] **Step 2: Add drag state variables and bind drag logic in `floating-panel.js`**

After the existing close button event bindings (after line 31, still inside the `if (!panelEl)` block), add:

```js
    // Drag state
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const headerEl = panelEl.querySelector('.ai-trans-panel-header');

    headerEl.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('ai-trans-panel-close')) return;
      isDragging = true;
      dragOffsetX = e.clientX - panelEl.getBoundingClientRect().left;
      dragOffsetY = e.clientY - panelEl.getBoundingClientRect().top;
      panelEl.classList.add('ai-trans-panel-dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const panelW = panelEl.offsetWidth;
      const panelH = panelEl.offsetHeight;
      let x = e.clientX - dragOffsetX + window.scrollX;
      let y = e.clientY - dragOffsetY + window.scrollY;
      x = Math.max(window.scrollX, Math.min(x, window.scrollX + window.innerWidth - panelW));
      y = Math.max(window.scrollY, Math.min(y, window.scrollY + window.innerHeight - panelH));
      panelEl.style.left = x + 'px';
      panelEl.style.top = y + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      panelEl.classList.remove('ai-trans-panel-dragging');
    });
```

- [ ] **Step 3: Add CSS styles in `content/content.css`**

Append to the end of `content/content.css`:

```css
/* ---- Floating Panel Drag ---- */
.ai-trans-panel-grip {
  color: #ccc;
  font-size: 12px;
  margin-right: 6px;
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
}

.ai-trans-panel-header {
  cursor: grab;
}

.ai-trans-panel-dragging .ai-trans-panel-header {
  cursor: grabbing;
}
```

- [ ] **Step 4: Verify manually**

Select some text on a webpage to trigger the floating panel. Confirm:
1. The `⠿` grip icon appears in the header left.
2. Hovering over the header shows `grab` cursor.
3. Dragging the header moves the panel freely.
4. Dragging stops at viewport edges (panel stays on screen).
5. The close button (✕) still works and is not treated as a drag handle.
6. The translation text in the body is still selectable/copyable.

- [ ] **Step 5: Commit**

```bash
git add content/floating-panel.js content/content.css
git commit -m "feat: add header-only drag to floating translation panel"
```

---

## Task 4: Fix Selection Translation Race Condition

**Files:**
- Modify: `content/content.js`

**Context:** When a user selects text A then quickly selects text B, both `handleSelectionTranslation` calls are in flight simultaneously. Whichever resolves last wins — if A resolves after B, the panel shows A's stale result. Fix: give each invocation a `reqId`; discard the response if a newer request has since been made.

- [ ] **Step 1: Add `currentSelectionRequestId` to the state block in `content/content.js`**

Find the state block at the top of the IIFE (around lines 8–10):
```js
  let translationInProgress = false;
  let pageTranslated = false;
  let currentSettings = null;
```

Add one line:
```js
  let translationInProgress = false;
  let pageTranslated = false;
  let currentSettings = null;
  let currentSelectionRequestId = 0;
```

- [ ] **Step 2: Update `handleSelectionTranslation` to capture and check `reqId`**

Find the function (lines 79–98):
```js
  async function handleSelectionTranslation(text, coords) {
    if (!coords) {
      coords = AI_TRANS.getSelectionCoords();
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_SELECTION',
        text
      });

      if (response && response.ok) {
        AI_TRANS.updateFloatingPanel(text, response.translation);
      } else {
        const errMsg = (response && response.error) || 'Translation failed';
        AI_TRANS.showFloatingPanelError(errMsg);
      }
    } catch (e) {
      AI_TRANS.showFloatingPanelError('Extension error: ' + e.message);
    }
  }
```

Replace with:
```js
  async function handleSelectionTranslation(text, coords) {
    const reqId = ++currentSelectionRequestId;

    if (!coords) {
      coords = AI_TRANS.getSelectionCoords();
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_SELECTION',
        text
      });

      if (reqId !== currentSelectionRequestId) return;

      if (response && response.ok) {
        AI_TRANS.updateFloatingPanel(text, response.translation);
      } else {
        const errMsg = (response && response.error) || 'Translation failed';
        AI_TRANS.showFloatingPanelError(errMsg);
      }
    } catch (e) {
      if (reqId !== currentSelectionRequestId) return;
      AI_TRANS.showFloatingPanelError('Extension error: ' + e.message);
    }
  }
```

- [ ] **Step 3: Verify manually**

Select a word, immediately drag to select a different longer phrase before the first translation returns. Confirm the panel shows the **second** selection's translation, not the first.

- [ ] **Step 4: Commit**

```bash
git add content/content.js
git commit -m "fix: discard stale selection translation responses using requestId"
```

---

## Task 5: Add Selection Translation Cache

**Files:**
- Modify: `content/content.js`

**Context:** Selecting the same text twice sends two identical API requests. A page-level `Map` cache (keyed by lowercased trimmed text) avoids redundant calls. The cache lives only for the page's lifetime and is cleared automatically on navigation/refresh.

- [ ] **Step 1: Add `selectionCache` to the state block**

In the same state block as Task 4 Step 1, add:
```js
  let translationInProgress = false;
  let pageTranslated = false;
  let currentSettings = null;
  let currentSelectionRequestId = 0;
  const selectionCache = new Map();
```

- [ ] **Step 2: Add cache lookup and store in `handleSelectionTranslation`**

Replace the function body from Task 4 Step 2 with the version that includes caching:

```js
  async function handleSelectionTranslation(text, coords) {
    const reqId = ++currentSelectionRequestId;

    if (!coords) {
      coords = AI_TRANS.getSelectionCoords();
    }

    // Cache hit: return immediately without an API call
    const cacheKey = text.trim().toLowerCase();
    if (selectionCache.has(cacheKey)) {
      if (reqId !== currentSelectionRequestId) return;
      AI_TRANS.updateFloatingPanel(text, selectionCache.get(cacheKey));
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_SELECTION',
        text
      });

      if (reqId !== currentSelectionRequestId) return;

      if (response && response.ok) {
        selectionCache.set(cacheKey, response.translation);
        AI_TRANS.updateFloatingPanel(text, response.translation);
      } else {
        const errMsg = (response && response.error) || 'Translation failed';
        AI_TRANS.showFloatingPanelError(errMsg);
      }
    } catch (e) {
      if (reqId !== currentSelectionRequestId) return;
      AI_TRANS.showFloatingPanelError('Extension error: ' + e.message);
    }
  }
```

- [ ] **Step 3: Verify manually**

Open browser DevTools → Network tab. Select a word, wait for translation. Select the **same word** again. Confirm: the second selection shows the translation **instantly** with **no new network request** in DevTools.

- [ ] **Step 4: Commit**

```bash
git add content/content.js
git commit -m "feat: cache selection translation results to avoid duplicate API calls"
```

---

## Task 6: Settings Cache in Service Worker

**Files:**
- Modify: `background/service-worker.js`

**Context:** `getSettingsAsync()` calls `chrome.storage.sync.get()` on every translation request (~10–20ms IPC each time). Settings rarely change. Cache the result in a module-level variable; invalidate when `chrome.storage.onChanged` fires.

- [ ] **Step 1: Add `cachedSettings` variable at module top**

After the context menu registration block (after line 16), add:
```js
// ---- Settings Cache ----
let cachedSettings = null;
```

- [ ] **Step 2: Update `getSettingsAsync()` to use the cache**

Find the function (lines 53–64):
```js
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
```

Replace with:
```js
async function getSettingsAsync() {
  if (cachedSettings) return cachedSettings;
  const defaults = {
    apiEndpoint: '',
    apiKey: '',
    model: '',
    targetLanguage: 'Chinese (Simplified)',
    displayMode: 'bilingual',
    chunkSize: 4000
  };
  const stored = await chrome.storage.sync.get(Object.keys(defaults));
  cachedSettings = { ...defaults, ...stored };
  return cachedSettings;
}
```

- [ ] **Step 3: Add `chrome.storage.onChanged` listener to invalidate cache**

After the message router block (after line 50), add:

```js
// ---- Invalidate settings cache on storage change ----
chrome.storage.onChanged.addListener(() => {
  cachedSettings = null;
});
```

- [ ] **Step 4: Verify manually**

1. Open DevTools → Sources → Service Workers, add a `console.log('storage.get called')` line inside `getSettingsAsync()` just before the `chrome.storage.sync.get()` call (temporarily).
2. Select several different words in quick succession. Confirm the log fires **once** (first call), then is silent for subsequent selections.
3. Open the extension options page, change any setting, save. Select a word again — confirm the log fires **once more** (cache invalidated).
4. Remove the temporary `console.log`.

- [ ] **Step 5: Commit**

```bash
git add background/service-worker.js
git commit -m "perf: cache settings in service worker, invalidate on storage change"
```

---

## Final Smoke Test

After all tasks, do a full end-to-end pass:

- [ ] Load unpacked extension in Chrome
- [ ] Open any article page
- [ ] Select text → floating panel appears → translation shows → panel has `⠿` grip icon
- [ ] Drag panel by header → it moves → stays within viewport
- [ ] Select same text again → result is instant (cache hit)
- [ ] Click "Translate Page" → progress bar shows grey track + blue fill → completes
- [ ] Click "Translate Page" again → nothing happens (pageTranslated guard)
- [ ] Open options → change target language → select text → new translation uses new language (settings cache invalidated)
