// AI Webpage Translator - Main Content Script
// Orchestrates full-page translation and selection translation

(function() {
  'use strict';

  // ---- State ----
  let translationInProgress = false;
  let pageTranslated = false;
  let currentSettings = null;

  // Progress bar element
  let progressBarEl = null;
  let progressContainerEl = null;

  // ---- Message Listener (from background / popup) ----
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'TRIGGER_FULL_PAGE':
        startFullPageTranslation();
        sendResponse({ ok: true });
        break;

      case 'RESTORE_PAGE':
        AI_TRANS.restoreOriginal();
        removeProgressBar();
        pageTranslated = false;
        translationInProgress = false;
        sendResponse({ ok: true });
        break;

      case 'SHOW_SELECTION_TRANSLATION':
        // Triggered from context menu via background
        handleSelectionTranslation(message.text);
        sendResponse({ ok: true });
        break;

      case 'GET_PAGE_STATUS':
        sendResponse({
          status: translationInProgress ? 'translating' : (pageTranslated ? 'translated' : 'idle')
        });
        break;
    }
  });

  // ---- Selection Translation via MouseUp ----
  document.addEventListener('mouseup', onMouseUp);

  // Close panel when clicking elsewhere
  document.addEventListener('mousedown', (e) => {
    const panel = document.querySelector('.ai-trans-panel');
    if (panel && !panel.contains(e.target)) {
      AI_TRANS.hideFloatingPanel();
    }
  });

  async function onMouseUp(e) {
    // Small delay to let selection settle
    await new Promise(r => setTimeout(r, 50));

    const selection = window.getSelection();
    const selectedText = selection && selection.toString().trim();

    // Require at least 2 characters of actual content
    if (!selectedText || selectedText.length < 2) {
      return;
    }

    // Only show panel for text that looks like natural language (not just numbers/symbols)
    if (/^[\d\s.,\-+()[\]\/\\:@#%*&^~`"'!?;|<>=_{}]+$/.test(selectedText)) {
      return;
    }

    const coords = AI_TRANS.getSelectionCoords();
    AI_TRANS.showFloatingPanel(selectedText, null, coords);
    await handleSelectionTranslation(selectedText, coords);
  }

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

  // ---- Full Page Translation ----
  async function startFullPageTranslation() {
    if (translationInProgress) return;
    translationInProgress = true;

    try {
      // Get current settings (for display mode and chunk size)
      const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      currentSettings = settings;

      const displayMode = settings.displayMode || 'bilingual';
      const chunkSize = settings.chunkSize || 4000;

      // Extract all translatable text nodes
      const records = AI_TRANS.extractTextNodes(document.body);
      if (records.length === 0) {
        translationInProgress = false;
        return;
      }

      // Split into chunks
      const chunks = AI_TRANS.chunkTextNodes(records, chunkSize);

      // Apply loading shimmer to all nodes
      records.forEach(r => AI_TRANS.addLoadingShimmer(r));

      // Show progress bar
      let completedChunks = 0;
      showProgressBar(0, chunks.length);

      // Fire all chunks concurrently — each one renders as soon as it comes back
      await Promise.all(chunks.map(chunk => {
        return chrome.runtime.sendMessage({
          type: 'TRANSLATE_CHUNKS',
          index: chunk.index,
          texts: chunk.records.map(r => r.text)
        }).then(response => {
          const translations = response && response.translations;

          chunk.records.forEach((record, idx) => {
            AI_TRANS.removeLoadingShimmer(record);
            const translatedText = translations && translations[idx];
            if (!translatedText) return;
            if (displayMode === 'replace') {
              AI_TRANS.applyReplace(record, translatedText);
            } else {
              AI_TRANS.applyBilingual(record, translatedText);
            }
          });
        }).catch(e => {
          console.error('[AI Translator] Chunk error:', e);
          chunk.records.forEach(r => AI_TRANS.removeLoadingShimmer(r));
        }).finally(() => {
          completedChunks++;
          updateProgressBar(completedChunks, chunks.length);
        });
      }));

      pageTranslated = true;
    } catch (e) {
      console.error('[AI Translator] Full page translation error:', e);
    } finally {
      translationInProgress = false;
      // Keep progress bar visible briefly then fade out
      setTimeout(removeProgressBar, 1500);
    }
  }

  // ---- Progress Bar ----
  function showProgressBar(current, total) {
    if (!progressContainerEl) {
      progressContainerEl = document.createElement('div');
      progressContainerEl.className = 'ai-trans-progress-container';

      progressBarEl = document.createElement('div');
      progressBarEl.className = 'ai-trans-progress-bar';

      const labelEl = document.createElement('span');
      labelEl.className = 'ai-trans-progress-label';
      labelEl.textContent = 'AI Translating...';

      progressContainerEl.appendChild(labelEl);
      progressContainerEl.appendChild(progressBarEl);
      document.documentElement.appendChild(progressContainerEl);
    }

    progressContainerEl.style.display = 'flex';
    updateProgressBar(current, total);
  }

  function updateProgressBar(current, total) {
    if (!progressBarEl) return;
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    progressBarEl.style.width = pct + '%';

    const label = progressContainerEl && progressContainerEl.querySelector('.ai-trans-progress-label');
    if (label) {
      label.textContent = pct >= 100 ? 'Translation complete!' : 'AI Translating... ' + pct + '%';
    }
  }

  function removeProgressBar() {
    if (progressContainerEl) {
      progressContainerEl.style.opacity = '0';
      setTimeout(() => {
        if (progressContainerEl && progressContainerEl.parentNode) {
          progressContainerEl.parentNode.removeChild(progressContainerEl);
        }
        progressContainerEl = null;
        progressBarEl = null;
      }, 400);
    }
  }

})();
