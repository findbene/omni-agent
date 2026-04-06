# Omni-Agent — AI Browser Assistant

> A powerful Chrome extension combining the best of **Sider AI** and **HARPA AI**.  
> Page-aware AI assistant with streaming responses, 6 smart macros, multi-model support, and a premium glassmorphism UI.

## Features

### Core AI Capabilities
- **Streaming AI Responses** — Real-time token-by-token rendering via Chrome port-based communication
- **Page Context Engine** — Automatically feeds webpage content to the AI for context-aware answers
- **Multi-Turn Chat** — Full conversation history maintained within each session
- **Persistent Memory** — Tell the agent to remember facts — it stores them permanently via function calling

### Smart Macros
| Macro | Description |
|---|---|
| 📝 Summarize | Instant page summary with key takeaways |
| 📊 Extract Data | Extracts tables, lists, and structured data as Markdown/JSON |
| ✍️ Draft Reply | Generates professional responses for emails, posts, messages |
| 🌐 Translate | Translates page content into any target language |
| 💻 Explain Code | Breaks down code found on the page (GitHub, docs, etc.) |
| 🔄 Rewrite | Rewrites content with customizable tone |

### YouTube Integration
- Auto-detects YouTube video pages
- Extracts video title, description, and transcript (when panel is open)
- Enables AI Q&A about video content

### Audio Transcription
- Captures tab audio via Chrome TabCapture API
- Transcribes speech using Gemini's multimodal capabilities

### Export
- Copy AI responses to clipboard
- Download as Markdown (.md)
- Download extracted data as CSV

## Tech Stack
- **React 18** + **TypeScript** — Component-based UI
- **Vite** + **@crxjs/vite-plugin** — Fast builds with Manifest V3 support
- **Tailwind CSS** — Compiled and injected into Shadow DOM
- **Google Gemini API** (`@google/genai`) — Primary AI provider
- **Chrome Manifest V3** — Service worker, content scripts, offscreen documents

## Project Structure
```
src/
├── background.ts          # Service worker — AI streaming, recording, shortcuts
├── content/
│   ├── index.tsx           # Shadow DOM mount point
│   └── components/
│       ├── Sidebar.tsx     # Main UI container + state management
│       ├── ChatMessage.tsx # Markdown rendering + export actions
│       └── MacroBar.tsx    # 6 AI macro buttons + audio toggle
├── lib/
│   ├── storage.ts          # Type-safe chrome.storage wrapper
│   ├── providers.ts        # AI model definitions
│   ├── markdown.ts         # Custom Markdown → HTML renderer
│   ├── youtube.ts          # YouTube detection + context extraction
│   └── export.ts           # Copy, download MD/CSV utilities
├── options/
│   ├── options.html        # Options page shell
│   └── options.tsx         # Settings UI (API keys, model, memory)
├── offscreen/
│   ├── offscreen.html      # Offscreen document for audio recording
│   └── offscreen.ts        # MediaRecorder + base64 encoding
└── styles/
    └── tailwind.css        # Tailwind + glassmorphism theme + syntax highlighting
```

## Quick Start
1. `npm install`
2. `npm run build`
3. Open `chrome://extensions/`, enable **Developer mode**
4. Click **Load unpacked** → select the `dist/` folder
5. Right-click the extension icon → **Options** → enter your Gemini API Key
6. Visit any webpage and click the glowing orb or press **Ctrl+Shift+O**

## Keyboard Shortcuts
- **Ctrl+Shift+O** (Cmd+Shift+O on Mac) — Toggle sidebar
- **Enter** — Send message
- **Shift+Enter** — New line in input

## Documentation
- [CHANGELOG.md](./CHANGELOG.md) — Version history
- [DECISIONS.md](./DECISIONS.md) — Architectural decisions
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — Known issues and Phase 2 roadmap
- [SESSION_HANDOFF.md](./SESSION_HANDOFF.md) — Session continuity