// AI Webpage Translator - Text Node Extractor
// Walks the DOM to find translatable text nodes and groups them into chunks

const AI_TRANS = window.AI_TRANS || {};
window.AI_TRANS = AI_TRANS;

// Tags whose text content should never be translated
AI_TRANS.SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE',
  'KBD', 'SAMP', 'VAR', 'MATH', 'SVG', 'CANVAS', 'AUDIO',
  'VIDEO', 'INPUT', 'SELECT', 'BUTTON', 'IFRAME', 'OBJECT',
  'EMBED', 'APPLET', 'HEAD', 'META', 'LINK', 'TITLE'
]);

// Attribute used to mark already-translated wrapper elements
AI_TRANS.TRANSLATED_ATTR = 'data-ai-translated';

// Minimum text length (trimmed) to bother translating
const MIN_TEXT_LENGTH = 2;

// Regex to skip nodes that are purely numbers/symbols/punctuation
const SKIP_PATTERN = /^[\d\s.,\-+()[\]\/\\:@#%*&^~`"'!?;|<>=_{}]+$/;

/**
 * Walk the DOM and return an ordered array of text node records.
 * @param {Element} root - Root element to start from
 * @returns {{ node: Text, text: string, id: number }[]}
 */
AI_TRANS.extractTextNodes = function(root) {
  if (!root) return [];

  const records = [];
  let id = 0;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip disallowed tag types
        if (AI_TRANS.SKIP_TAGS.has(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip nodes inside already-translated wrappers
        if (parent.closest(`[${AI_TRANS.TRANSLATED_ATTR}]`)) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip invisible nodes
        try {
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
        } catch (_) {}

        // Skip whitespace-only or too-short nodes
        const text = node.textContent.trim();
        if (text.length < MIN_TEXT_LENGTH) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip nodes that are purely numbers/punctuation
        if (SKIP_PATTERN.test(text)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    records.push({
      node,
      text: node.textContent.trim(),
      id: id++
    });
  }

  return records;
};

/**
 * Group text node records into chunks for batched API calls.
 * @param {{ node: Text, text: string, id: number }[]} records
 * @param {number} maxCharsPerChunk - Max characters per chunk
 * @returns {{ index: number, records: object[], charCount: number }[]}
 */
AI_TRANS.chunkTextNodes = function(records, maxCharsPerChunk) {
  maxCharsPerChunk = maxCharsPerChunk || 2000;
  const chunks = [];
  let current = { index: 0, records: [], charCount: 0 };

  for (const record of records) {
    const textLen = record.text.length;

    // Start a new chunk if this one would exceed the limit
    if (current.charCount + textLen > maxCharsPerChunk && current.records.length > 0) {
      chunks.push(current);
      current = { index: chunks.length, records: [], charCount: 0 };
    }

    current.records.push(record);
    current.charCount += textLen;
  }

  if (current.records.length > 0) {
    chunks.push(current);
  }

  return chunks;
};
