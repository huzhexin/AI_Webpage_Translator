# AI 网页翻译插件改进设计

**日期：** 2026-05-26  
**范围：** Bug 修复 + 浮窗拖拽 + 选词翻译工程化提升

---

## 一、问题清单

### 用户发现的问题
1. 翻译浮窗无法拖拽移动
2. 选词翻译效率可以工程化提升

### 代码审查发现的 Bug
3. 进度条 track 元素在 JS 中从未创建，CSS 中的 `.ai-trans-progress-track` 样式无效
4. 全页翻译完成后再次触发，`pageTranslated` 未被检查，进度条重复出现

---

## 二、设计决策

| 问题 | 决策 |
|------|------|
| 拖拽范围 | 仅标题栏（header-only），内容区保持可选中复制 |
| API 并发 | 保持当前全量并发，无需限流 |
| 选词缓存 | 页面级 Map 缓存，刷新自动清空 |

---

## 三、各项改动详细设计

### 3.1 Bug 修复：进度条 track 元素

**文件：** `content/content.js`，函数 `showProgressBar()`

**问题：** CSS 定义了 `.ai-trans-progress-track`（灰色背景轨道，`flex:1`），但 JS 中从未创建该元素，`progressBarEl` 直接挂在容器上，导致轨道背景缺失、宽度不对。

**修复：**
```js
// 在 progressBarEl 外包一层 track
const progressTrackEl = document.createElement('div');
progressTrackEl.className = 'ai-trans-progress-track';
progressTrackEl.appendChild(progressBarEl);
progressContainerEl.appendChild(progressTrackEl);
```

---

### 3.2 Bug 修复：防止全页翻译重复执行

**文件：** `content/content.js`，函数 `startFullPageTranslation()`

**问题：** 函数只检查 `translationInProgress`，翻译完成后 `pageTranslated = true` 但不阻止再次执行，会重复出现进度条。

**修复：** 在函数开头加：
```js
if (translationInProgress || pageTranslated) return;
```

---

### 3.3 浮窗拖拽（Header-Only）

**文件：** `content/floating-panel.js`、`content/content.css`

#### floating-panel.js

**标题栏 HTML** — 在 title 左侧加 grip 图标：
```html
<div class="ai-trans-panel-header">
  <span class="ai-trans-panel-grip">⠿</span>
  <span class="ai-trans-panel-title">AI Translation</span>
  <span class="ai-trans-panel-close" ...>✕</span>
</div>
```

**拖拽逻辑** — 面板创建后绑定：
```js
const headerEl = panelEl.querySelector('.ai-trans-panel-header');
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

headerEl.addEventListener('mousedown', (e) => {
  // 不拦截关闭按钮
  if (e.target.classList.contains('ai-trans-panel-close')) return;
  isDragging = true;
  dragOffsetX = e.clientX - panelEl.getBoundingClientRect().left;
  dragOffsetY = e.clientY - panelEl.getBoundingClientRect().top;
  panelEl.classList.add('ai-trans-panel-dragging');
  e.preventDefault(); // 防止拖拽时意外选中文本
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const panelW = panelEl.offsetWidth;
  const panelH = panelEl.offsetHeight;
  let x = e.clientX - dragOffsetX + window.scrollX;
  let y = e.clientY - dragOffsetY + window.scrollY;
  // clamp 到视口
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

**注意：** `content.js` 中的 panel-close mousedown handler 检查 `panel.contains(e.target)`，header 在 panel 内，拖拽不会误触关闭逻辑，无冲突。

#### content.css

```css
.ai-trans-panel-grip {
  color: #ccc;
  font-size: 12px;
  margin-right: 6px;
  cursor: grab;
  user-select: none;
}

.ai-trans-panel-header {
  cursor: grab;
}

.ai-trans-panel-dragging .ai-trans-panel-header {
  cursor: grabbing;
}
```

---

### 3.4 选词翻译竞态条件修复

**文件：** `content/content.js`

**问题：** 快速连选两段文字时，两个异步请求同时在途，先发的若后到会覆盖最新翻译结果。

**修复：** 模块顶层加请求 ID 计数器：
```js
let currentSelectionRequestId = 0;
```

在 `handleSelectionTranslation` 函数内部自增（调用方无需传参，context menu 路径也自动覆盖）：
```js
async function handleSelectionTranslation(text, coords) {
  const reqId = ++currentSelectionRequestId;
  // ...await response...
  if (reqId !== currentSelectionRequestId) return; // 过期请求丢弃
  if (response && response.ok) {
    AI_TRANS.updateFloatingPanel(text, response.translation);
  } else {
    AI_TRANS.showFloatingPanelError(...);
  }
}
```

---

### 3.5 选词翻译结果缓存

**文件：** `content/content.js`

模块顶层加：
```js
const selectionCache = new Map();
```

在 `handleSelectionTranslation` 开头查缓存：
```js
const cacheKey = text.trim().toLowerCase();
if (selectionCache.has(cacheKey)) {
  if (reqId !== currentSelectionRequestId) return;
  AI_TRANS.updateFloatingPanel(text, selectionCache.get(cacheKey));
  return;
}
```

请求成功后写入缓存：
```js
selectionCache.set(cacheKey, response.translation);
```

缓存随页面生命周期存在，刷新自动清空，无需手动管理。

---

### 3.6 Settings 缓存（Service Worker）

**文件：** `background/service-worker.js`

**问题：** 每次选词翻译触发 `handleTranslateSelection`，都调用 `getSettingsAsync()` → `chrome.storage.sync.get()`，约 10-20ms 的 IPC 开销。

**修复：** 模块顶层加：
```js
let cachedSettings = null;
```

修改 `getSettingsAsync()`：
```js
async function getSettingsAsync() {
  if (cachedSettings) return cachedSettings;
  const defaults = { /* ... */ };
  const stored = await chrome.storage.sync.get(Object.keys(defaults));
  cachedSettings = { ...defaults, ...stored };
  return cachedSettings;
}
```

监听 storage 变更来失效缓存：
```js
chrome.storage.onChanged.addListener(() => {
  cachedSettings = null;
});
```

---

## 四、文件改动汇总

| 文件 | 改动内容 |
|------|---------|
| `content/floating-panel.js` | 加 grip 图标 HTML + 拖拽逻辑 |
| `content/content.css` | 加 grip 样式、grab/grabbing cursor |
| `content/content.js` | 修复进度条 track、pageTranslated 守卫、requestId 竞态修复、选词缓存 |
| `background/service-worker.js` | settings 内存缓存 + onChanged 失效 |

---

## 五、不在本次范围内

- API 并发限流控制（用户 API 无此需求）
- 选中已翻译文本的双语内容时的处理
- 全页翻译结果的持久缓存（跨页面）
