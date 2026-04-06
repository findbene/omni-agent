# Known Issues

## Active Issues
- **Extension Context Invalidation**: After reloading the extension in `chrome://extensions`, all open tabs must be refreshed (F5) before the sidebar will work again. This is a Chrome platform limitation.
- **Audio Transcription Fragility**: The TabCapture → offscreen document → MediaRecorder pipeline can fail silently on some sites. Error handling exists but UX could be improved.
- **YouTube Transcript**: Transcript extraction relies on DOM scraping which may break if YouTube changes their page structure.

## Phase 2 TODO
- OpenAI and Anthropic API integration (architecture exists, wiring pending)
- PDF/document upload and analysis
- Web automation engine (DOM clicking, form filling)
- Website monitoring and price tracking
- Custom prompt library with save/load
- Node-based workflow builder
