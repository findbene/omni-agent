# Changelog

## [2.0.0] - 2026-04-06
### Complete Rebuild — Sider + HARPA AI Fusion (Phase 1)
- Rebuilt entire UI with premium glassmorphism dark theme
- Added real-time streaming AI responses via Chrome ports
- Added proper Markdown rendering with syntax-highlighted code blocks
- Added multi-model architecture (Gemini Flash, Pro, 2.0 Flash)
- Added 6 AI macros: Summarize, Extract Data, Draft Reply, Translate, Explain Code, Rewrite
- Added YouTube page detection with transcript-aware prompts
- Added export capabilities (copy, download MD, download CSV)
- Added keyboard shortcut (Ctrl+Shift+O) to toggle sidebar
- Added comprehensive options page with multi-provider key management
- Fixed Shadow DOM styling — eliminated dual inline-style/className chaos
- Fixed broken Markdown regex in AI message rendering
- Modularized codebase into lib/, components/ architecture

## [1.0.0] - 2026-03-29
### Initial Build (Phase 1-2 Legacy)
- Basic slide-out chat sidebar
- Page summarization, data extraction, draft reply macros
- Custom chat with page context
- Audio transcription via TabCapture + offscreen document
- Persistent memory via Gemini function calling
- Options page for Gemini API key storage
