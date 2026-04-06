import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Youtube } from 'lucide-react';
import ChatMessage from './ChatMessage';
import MacroBar from './MacroBar';
import { MODELS, DEFAULT_MODEL } from '../../lib/providers';
import { isYouTubePage, buildYouTubeContext } from '../../lib/youtube';
import type { Message } from '../../lib/storage';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [isRecording, setIsRecording] = useState(false);
  const [isYT, setIsYT] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, loading]);

  // Detect YouTube
  useEffect(() => {
    setIsYT(isYouTubePage());
    const observer = new MutationObserver(() => setIsYT(isYouTubePage()));
    observer.observe(document.body, { childList: true, subtree: false });
    return () => observer.disconnect();
  }, []);

  // Listen for toggle from background (keyboard shortcut / icon click)
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.type === 'TOGGLE_SIDEBAR') setIsOpen(prev => !prev);
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // ─── Streaming AI Request ───
  const sendMessage = useCallback((action: string, userLabel: string, extra?: Record<string, string>) => {
    if (loading) return;

    setLoading(true);
    setStreamingText('');
    const prompt = action === 'CUSTOM_PROMPT' ? userLabel : undefined;
    const newMessages: Message[] = [...messages, { role: 'user', content: userLabel }];
    setMessages(newMessages);

    // Defer DOM read so React can paint the user message first
    setTimeout(() => {
      let pageContent = '';
      try {
        if (isYT) {
          pageContent = buildYouTubeContext();
        } else {
          pageContent = (document.body.innerText || '').substring(0, 30000);
        }
      } catch { /* ignore DOM errors */ }

      try {
        const port = chrome.runtime.connect({ name: 'omni-stream' });
        port.postMessage({
          action,
          content: pageContent,
          prompt: prompt || userLabel,
          history: newMessages,
          model: selectedModel,
          isYouTube: isYT,
          ...(extra || {}),
        });

        let accumulated = '';
        port.onMessage.addListener((msg) => {
          if (msg.type === 'chunk') {
            accumulated += msg.text;
            setStreamingText(accumulated);
          } else if (msg.type === 'done') {
            if (accumulated) {
              setMessages(prev => [...prev, { role: 'ai', content: accumulated }]);
            }
            setStreamingText('');
            setLoading(false);
            try { port.disconnect(); } catch { /* already disconnected */ }
          } else if (msg.type === 'error') {
            setMessages(prev => [...prev, { role: 'ai', content: `❌ ${msg.error}` }]);
            setStreamingText('');
            setLoading(false);
            try { port.disconnect(); } catch { /* already disconnected */ }
          }
        });

        port.onDisconnect.addListener(() => {
          if (loading) {
            setLoading(false);
            if (accumulated) {
              setMessages(prev => [...prev, { role: 'ai', content: accumulated }]);
              setStreamingText('');
            }
          }
        });
      } catch (e: any) {
        setLoading(false);
        const errorMsg = e.message?.includes('Extension context invalidated')
          ? '🚨 Extension updated. Please refresh this page (F5).'
          : `❌ ${e.message}`;
        setMessages(prev => [...prev, { role: 'ai', content: errorMsg }]);
      }
    }, 30);
  }, [messages, loading, selectedModel, isYT]);

  // ─── Audio Recording ───
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      setLoading(true);
      setMessages(prev => [...prev, { role: 'user', content: '🎙️ Transcribe captured audio...' }]);
      try {
        chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (response) => {
          setLoading(false);
          if (chrome.runtime.lastError) {
            setMessages(prev => [...prev, { role: 'ai', content: `❌ ${chrome.runtime.lastError?.message}` }]);
          } else if (response?.error) {
            setMessages(prev => [...prev, { role: 'ai', content: `❌ ${response.error}` }]);
          } else if (response?.data) {
            setMessages(prev => [...prev, { role: 'ai', content: response.data }]);
          }
        });
      } catch (e: any) {
        setLoading(false);
        setMessages(prev => [...prev, { role: 'ai', content: `❌ ${e.message}` }]);
      }
    } else {
      setIsRecording(true);
      try {
        chrome.runtime.sendMessage({ type: 'START_RECORDING' }, (response) => {
          if (chrome.runtime.lastError || response?.error) {
            setIsRecording(false);
            setMessages(prev => [...prev, { role: 'ai', content: `❌ ${chrome.runtime.lastError?.message || response?.error}` }]);
          }
        });
      } catch (e: any) {
        setIsRecording(false);
        setMessages(prev => [...prev, { role: 'ai', content: `❌ ${e.message}` }]);
      }
    }
  }, [isRecording]);

  // ─── Send Custom Message ───
  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage('CUSTOM_PROMPT', input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Render ───
  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button className="omni-fab" onClick={() => setIsOpen(true)} aria-label="Open Omni-Agent">
          <Bot size={26} />
        </button>
      )}

      {/* Sidebar Panel */}
      {isOpen && (
        <div className="omni-sidebar">
          {/* Header */}
          <div className="omni-header">
            <div className="omni-header-title">
              <Bot size={20} />
              <span>Omni-Agent</span>
            </div>
            <div className="omni-header-actions">
              <select
                className="omni-model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                ))}
              </select>
              <button className="omni-header-btn" onClick={() => setIsOpen(false)} aria-label="Close sidebar">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* YouTube Indicator */}
          {isYT && (
            <div className="omni-yt-badge">
              <Youtube size={14} /> YouTube detected — video context enabled
            </div>
          )}

          {/* Macro Bar */}
          <MacroBar
            onMacro={sendMessage}
            disabled={loading}
            isRecording={isRecording}
            onToggleRecording={toggleRecording}
          />

          {/* Chat Area */}
          <div className="omni-chat">
            {messages.length === 0 && !streamingText && (
              <div className="omni-empty">
                <Bot size={48} className="omni-empty-icon" />
                <p className="omni-empty-title">Welcome to Omni-Agent</p>
                <p className="omni-empty-sub">
                  Select a macro above or type a question below to analyze this page with AI.
                  Press <strong>Ctrl+Shift+O</strong> to toggle anytime.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <ChatMessage key={i} role={m.role} content={m.content} />
            ))}

            {/* Streaming message */}
            {streamingText && (
              <ChatMessage role="ai" content={streamingText} isStreaming={true} />
            )}

            {/* Loading dots (only when waiting for first chunk) */}
            {loading && !streamingText && (
              <div className="omni-msg omni-msg-ai">
                <div className="omni-bubble omni-bubble-ai">
                  <div className="omni-dots">
                    <div className="omni-dot" />
                    <div className="omni-dot" />
                    <div className="omni-dot" />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input Bar */}
          <div className="omni-input-bar">
            <textarea
              ref={textareaRef}
              className="omni-textarea"
              placeholder="Ask anything about this page..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
            />
            <button
              className="omni-send-btn"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
