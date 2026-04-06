# Architectural Decisions

## Decision 001 — Shadow DOM for Style Isolation
All UI is rendered inside a Shadow DOM to prevent CSS conflicts with host websites. Tailwind CSS is compiled at build time and injected as a `<style>` element within the shadow root.

## Decision 002 — Port-Based Streaming over sendMessage
Chrome `runtime.connect` ports are used for AI streaming instead of `runtime.sendMessage`. Ports allow continuous data flow and keep the service worker alive during long-running generation.

## Decision 003 — Gemini-First with Provider Abstraction
Gemini is the primary and fully-wired AI provider. The architecture supports OpenAI and Anthropic via a provider abstraction layer, ready for Phase 2 integration.

## Decision 004 — Inline CSS Compilation for Shadow DOM
Using Vite's `?inline` CSS import to compile Tailwind + custom CSS into a string that gets injected into the Shadow DOM. This is the only reliable way to style content inside a shadow root without external stylesheet links.

## Decision 005 — Lightweight Custom Markdown Renderer
Built a custom Markdown-to-HTML renderer (~150 lines) instead of importing `marked` or `markdown-it` to keep the extension bundle small and avoid unnecessary dependencies.

## Decision 006 — Component Modularization
Split the monolithic AgentOverlay.tsx (242 lines) into focused components: Sidebar, ChatMessage, MacroBar. Each handles a single concern with clear prop interfaces.
