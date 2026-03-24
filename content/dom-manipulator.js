// AI Webpage Translator - DOM Manipulator
// Applies translated text to the DOM in replace or bilingual mode

window.AI_TRANS = window.AI_TRANS || {};

/**
 * Apply translation in "replace" mode.
 * Replaces the text node content with the translation,
 * storing the original in a data attribute for restoration.
 *
 * @param {{ node: Text, text: string }} record
 * @param {string} translatedText
 */
AI_TRANS.applyReplace = function(record, translatedText) {
  if (!translatedText) return;

  const node = record.node;
  const parent = node.parentElement;
  if (!parent) return;

  // Store original text for restoration
  if (!parent.dataset.aiOriginalText) {
    parent.dataset.aiOriginalText = node.textContent;
  }
  parent.dataset.aiTranslated = 'replace';

  node.textContent = translatedText;
};

/**
 * Apply translation in "bilingual" mode.
 * Wraps the original text node in a span, then adds a sibling
 * span below it with the translation.
 *
 * @param {{ node: Text, text: string }} record
 * @param {string} translatedText
 */
AI_TRANS.applyBilingual = function(record, translatedText) {
  if (!translatedText) return;

  const originalNode = record.node;
  const parent = originalNode.parentElement;
  if (!parent) return;

  // Avoid double-wrapping
  if (originalNode.parentElement && originalNode.parentElement.classList.contains('ai-trans-original')) {
    return;
  }

  // 1. Create span wrapping the original text
  const originalSpan = document.createElement('span');
  originalSpan.className = 'ai-trans-original';
  originalSpan.textContent = originalNode.textContent;

  // 2. Create the translation span
  const translationSpan = document.createElement('span');
  translationSpan.className = 'ai-trans-translation';
  translationSpan.textContent = translatedText;

  // 3. Create wrapper holding both
  const wrapper = document.createElement('span');
  wrapper.className = 'ai-trans-wrapper';
  wrapper.setAttribute(AI_TRANS.TRANSLATED_ATTR, 'bilingual');
  wrapper.appendChild(originalSpan);
  wrapper.appendChild(translationSpan);

  // 4. Replace the original text node with the wrapper
  parent.replaceChild(wrapper, originalNode);
};

/**
 * Restore the page to its original state.
 * Removes all bilingual wrappers and restores replace-mode nodes.
 */
AI_TRANS.restoreOriginal = function() {
  // Restore bilingual mode wrappers
  const wrappers = document.querySelectorAll('.ai-trans-wrapper');
  wrappers.forEach(wrapper => {
    const originalSpan = wrapper.querySelector('.ai-trans-original');
    const originalText = originalSpan ? originalSpan.textContent : '';
    const textNode = document.createTextNode(originalText);
    if (wrapper.parentNode) {
      wrapper.parentNode.replaceChild(textNode, wrapper);
    }
  });

  // Restore replace-mode nodes
  const replacedEls = document.querySelectorAll('[data-ai-original-text]');
  replacedEls.forEach(el => {
    // Find the direct text node children and restore
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
        child.textContent = el.dataset.aiOriginalText;
        break;
      }
    }
    delete el.dataset.aiOriginalText;
    delete el.dataset.aiTranslated;
  });
};

/**
 * Add loading shimmer class to a text node's parent element.
 * @param {{ node: Text }} record
 */
AI_TRANS.addLoadingShimmer = function(record) {
  const parent = record.node.parentElement;
  if (parent) {
    parent.classList.add('ai-trans-loading-node');
  }
};

/**
 * Remove loading shimmer class from a text node's parent element.
 * @param {{ node: Text }} record
 */
AI_TRANS.removeLoadingShimmer = function(record) {
  const parent = record.node.parentElement;
  if (parent) {
    parent.classList.remove('ai-trans-loading-node');
  }
};
