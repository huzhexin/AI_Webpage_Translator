# AI 网页翻译插件

[English](README.md) | 中文

一款 Chrome 浏览器扩展，调用任意 OpenAI 兼容 API 对网页内容进行翻译。

![Chrome Extension](https://img.shields.io/badge/Chrome-扩展插件-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)

## 功能特性

- **全页翻译** — 一键翻译页面上的所有文字
- **划词翻译** — 选中任意文字，自动弹出翻译浮窗
- **双语对照模式** — 原文与译文同时显示
- **替换模式** — 直接用译文替换原文
- **并发处理** — 所有分块同时发起翻译请求，速度最快
- **兼容任意 OpenAI 接口** — 支持 OpenAI、DeepSeek、Ollama 等兼容接口
- **无需刷新页面** — 脚本按需注入，打开即用

## 安装方法

1. 克隆或下载本仓库
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角的**开发者模式**
4. 点击**加载已解压的扩展程序**，选择项目文件夹
5. 工具栏中会出现插件图标

## 配置说明

点击插件图标 → **Full Settings**，填写以下信息：

| 字段 | 说明 |
|------|------|
| **API Endpoint** | API 地址，例如 `https://api.openai.com/v1`<br>也可填写完整路径（以 `/chat/completions` 结尾） |
| **API Key** | 你的 API 密钥（本地 Ollama 可留空） |
| **Model Name** | 模型名称，例如 `gpt-4o-mini` |
| **Target Language** | 目标翻译语言（默认：简体中文） |
| **Display Mode** | 双语对照 或 替换原文 |
| **Chunk Size** | 每次 API 调用的字符数（默认：4000） |

填写完成后点击 **Test Connection** 验证配置是否正确。

## 使用方法

### 全页翻译
1. 打开任意网页
2. 点击插件图标
3. 选择目标语言和展示模式
4. 点击 **Translate Page**

### 划词翻译
- **选中**页面上的任意文字 — 自动弹出翻译浮窗
- 或**右键**选中文字 → **Translate "..."**

### 恢复原文
点击插件图标 → **Restore Original**，撤销翻译恢复原始页面。

## 支持的 API 服务

任何 OpenAI 兼容接口均可使用，包括：

- [OpenAI](https://platform.openai.com) — `https://api.openai.com/v1`
- [DeepSeek](https://platform.deepseek.com) — `https://api.deepseek.com/v1`
- [Ollama](https://ollama.com)（本地部署）— `http://localhost:11434/v1`
- 其他兼容接口

## 项目结构

```
├── manifest.json              # Chrome 扩展配置（MV3）
├── background/
│   └── service-worker.js      # API 调用与消息路由
├── content/
│   ├── content.js             # 主协调器
│   ├── text-extractor.js      # DOM 文本节点提取
│   ├── dom-manipulator.js     # 双语/替换 DOM 操作
│   ├── floating-panel.js      # 划词翻译浮窗
│   └── content.css            # 翻译 UI 样式
├── popup/
│   ├── popup.html/js/css      # 插件弹窗
└── options/
    ├── options.html/js/css    # 设置页面
```

## 开源协议

MIT
