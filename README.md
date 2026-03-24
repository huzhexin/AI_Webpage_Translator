# AI Webpage Translator

A Chrome extension that translates web pages using any OpenAI-compatible API.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)

## Features

- **Full-page translation** — translates all text on the page with a single click
- **Selection translation** — select any text to get an instant floating translation panel
- **Bilingual mode** — shows original text and translation side by side
- **Replace mode** — replaces original text with the translation
- **Concurrent processing** — all chunks are translated in parallel for maximum speed
- **Any OpenAI-compatible API** — works with OpenAI, DeepSeek, Ollama, and any compatible endpoint
- **No page refresh needed** — scripts are injected on demand

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the project folder
5. The extension icon will appear in your toolbar

## Configuration

Click the extension icon → **Full Settings**, then fill in:

| Field | Description |
|-------|-------------|
| **API Endpoint** | Your API base URL, e.g. `https://api.openai.com/v1`<br>Or a full path ending with `/chat/completions` |
| **API Key** | Your API key (leave blank for local Ollama) |
| **Model Name** | The model to use, e.g. `gpt-4o-mini` |
| **Target Language** | Language to translate into (default: Chinese Simplified) |
| **Display Mode** | Bilingual or Replace |
| **Chunk Size** | Characters per API call (default: 4000) |

Click **Test Connection** to verify your settings before use.

## Usage

### Translate a full page
1. Navigate to any web page
2. Click the extension icon
3. Select target language and display mode
4. Click **Translate Page**

### Translate selected text
- **Select** any text on the page — a floating panel appears automatically
- Or **right-click** selected text → **Translate "..."**

### Restore original
Click the extension icon → **Restore Original** to undo the translation.

## Supported APIs

Any OpenAI-compatible API works, including:

- [OpenAI](https://platform.openai.com) — `https://api.openai.com/v1`
- [DeepSeek](https://platform.deepseek.com) — `https://api.deepseek.com/v1`
- [Ollama](https://ollama.com) (local) — `http://localhost:11434/v1`
- Other compatible providers

## Project Structure

```
├── manifest.json              # Chrome extension manifest (MV3)
├── background/
│   └── service-worker.js      # API calls and message routing
├── content/
│   ├── content.js             # Main orchestrator
│   ├── text-extractor.js      # DOM text node extraction
│   ├── dom-manipulator.js     # Bilingual / replace DOM operations
│   ├── floating-panel.js      # Selection translation panel
│   └── content.css            # Styles for translation UI
├── popup/
│   ├── popup.html/js/css      # Extension popup
└── options/
    ├── options.html/js/css    # Settings page
```

## License

MIT
