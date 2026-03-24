// AI Webpage Translator - Floating Translation Panel
// Displays selection translation results near the cursor

window.AI_TRANS = window.AI_TRANS || {};

let panelEl = null;

/**
 * Show the floating translation panel.
 * If translation is null, shows a loading state.
 *
 * @param {string} sourceText - Original selected text
 * @param {string|null} translation - Translated text, or null for loading
 * @param {{ x: number, y: number }} coords - Viewport coordinates to position near
 */
AI_TRANS.showFloatingPanel = function(sourceText, translation, coords) {
  if (!panelEl) {
    panelEl = document.createElement('div');
    panelEl.className = 'ai-trans-panel';
    panelEl.innerHTML =
      '<div class="ai-trans-panel-header">' +
        '<span class="ai-trans-panel-title">AI Translation</span>' +
        '<span class="ai-trans-panel-close" role="button" aria-label="Close" tabindex="0">&#x2715;</span>' +
      '</div>' +
      '<div class="ai-trans-panel-body"></div>' +
      '<div class="ai-trans-panel-source"></div>';

    panelEl.querySelector('.ai-trans-panel-close').addEventListener('click', AI_TRANS.hideFloatingPanel);
    panelEl.querySelector('.ai-trans-panel-close').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') AI_TRANS.hideFloatingPanel();
    });

    document.documentElement.appendChild(panelEl);
  }

  // Position the panel near the cursor, keeping it within viewport
  const panelWidth = 360;
  const panelHeight = 150; // estimated
  const margin = 12;

  let x = coords.x + margin + window.scrollX;
  let y = coords.y + margin + window.scrollY;

  // Clamp to viewport
  const maxX = window.scrollX + window.innerWidth - panelWidth - margin;
  const maxY = window.scrollY + window.innerHeight - panelHeight - margin;
  x = Math.max(window.scrollX + margin, Math.min(x, maxX));
  y = Math.max(window.scrollY + margin, Math.min(y, maxY));

  panelEl.style.left = x + 'px';
  panelEl.style.top = y + 'px';

  const bodyEl = panelEl.querySelector('.ai-trans-panel-body');
  const sourceEl = panelEl.querySelector('.ai-trans-panel-source');

  if (translation !== null) {
    bodyEl.textContent = translation;
    sourceEl.textContent = sourceText.length > 80
      ? sourceText.slice(0, 80) + '…'
      : sourceText;
  } else {
    // Loading state
    bodyEl.innerHTML = '<span class="ai-trans-panel-loading">Translating...</span>';
    sourceEl.textContent = '';
  }

  panelEl.style.display = 'block';
};

/**
 * Update the floating panel with the translation result.
 * @param {string} sourceText
 * @param {string} translation
 */
AI_TRANS.updateFloatingPanel = function(sourceText, translation) {
  if (!panelEl || panelEl.style.display === 'none') return;

  const bodyEl = panelEl.querySelector('.ai-trans-panel-body');
  const sourceEl = panelEl.querySelector('.ai-trans-panel-source');

  bodyEl.textContent = translation;
  sourceEl.textContent = sourceText.length > 80
    ? sourceText.slice(0, 80) + '…'
    : sourceText;
};

/**
 * Show an error in the floating panel.
 * @param {string} errorMsg
 */
AI_TRANS.showFloatingPanelError = function(errorMsg) {
  if (!panelEl) return;
  const bodyEl = panelEl.querySelector('.ai-trans-panel-body');
  bodyEl.innerHTML = '<span class="ai-trans-panel-error">' +
    escapeHtml(errorMsg) + '</span>';
};

/**
 * Hide the floating panel.
 */
AI_TRANS.hideFloatingPanel = function() {
  if (panelEl) {
    panelEl.style.display = 'none';
  }
};

/**
 * Get coordinates of the current selection's end point.
 * @returns {{ x: number, y: number }}
 */
AI_TRANS.getSelectionCoords = function() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return { x: 100, y: 100 };

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  return {
    x: rect.right,
    y: rect.bottom
  };
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
