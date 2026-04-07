import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Youtube, BookOpen, Paperclip, Camera, History, BookMarked, Search, SplitSquareHorizontal, Sun, Moon, Plus, ChevronDown, Sparkles, Clapperboard, Globe, Database, Check, Mic, Square } from 'lucide-react';
import Toast from './Toast';
import ChatMessage from './ChatMessage';
import MacroBar from './MacroBar';
import SelectionToolbar from './SelectionToolbar';
import KnowledgePanel from './KnowledgeBase';
import { MODELS, DEFAULT_MODEL } from '../../lib/providers';
import { isYouTubePage, buildYouTubeContext } from '../../lib/youtube';
import type { Message } from '../../lib/storage';
import { CustomPrompt, getSettings, safeStorageSet, isExtensionContextValid } from '../../lib/storage';
import { extractTextFromPDF } from '../../lib/pdf';
import { extractPageContent } from '../../lib/pageExtractor';
import { captureScreenshot, getClipboardImage } from '../../lib/screenshot';
import { conductResearch, buildResearchPrompt } from '../../lib/research';
import { captureVideoAudio, transcribeVideoAudio, getVideoSourceTitle, type VideoTranscribeProgress } from '../../lib/videoTranscribe';
import {
  getOrCreateConversation, createNewConversation, getConversationMessages,
  appendMessage, getAllConversations, deleteConversation,
} from '../../lib/db';

interface SidebarInternalMessage extends Message {
  id?: string;
  action?: string;
}

interface ResearchProgress {
  stage: string;
  detail: string;
  progress: number;
}

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SidebarInternalMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [isRecording, setIsRecording] = useState(false);
  const [isYT, setIsYT] = useState(false);
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [showPrompts, setShowPrompts] = useState(false);
  const [attachedFileText, setAttachedFileText] = useState('');
  const [attachedFileName, setAttachedFileName] = useState('');
  const [attachedImage, setAttachedImage] = useState<string>(''); // base64 data URL
  const [attachedImageMime, setAttachedImageMime] = useState<string>('image/png');
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isDragging, setIsDragging] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [conversations, setConversations] = useState<Awaited<ReturnType<typeof getAllConversations>>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [researchProgress, setResearchProgress] = useState<ResearchProgress | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareModel, setCompareModel] = useState('');
  const [compareStreaming, setCompareStreaming] = useState('');
  const [compareMessages, setCompareMessages] = useState<SidebarInternalMessage[]>([]);
  const [lastRequest, setLastRequest] = useState<{ action: string; label: string; extra?: Record<string, string> } | null>(null);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [contextInvalid, setContextInvalid] = useState(false);
  const [videoTranscribeProgress, setVideoTranscribeProgress] = useState<VideoTranscribeProgress | null>(null);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const videoAbortRef = useRef<AbortController | null>(null);

  // Wave 2A — new UI state
  const [fabExpanded, setFabExpanded] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(420);

  // ─── Toast helper ───
  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2500);
  }, []);

  // Auto-scroll
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

  // Load settings
  useEffect(() => {
    getSettings().then(res => {
      setPrompts(res.savedPrompts || []);
      setSelectedModel(res.selectedModel || DEFAULT_MODEL);
      setTheme(res.theme === 'light' ? 'light' : 'dark');
      setSidebarWidth(res.sidebarWidth || 420);
    });
  }, [isOpen]);

  // Proactively detect when extension context is invalidated (e.g. after reload/update)
  // so the FAB turns red before any chrome API call throws.
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        if (!chrome.runtime?.id) setContextInvalid(true);
      } catch {
        setContextInvalid(true);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Listen for toggle from background
  useEffect(() => {
    const handler = (msg: { type: string; action?: string; selectedText?: string; openSidebar?: boolean }) => {
      if (msg.type === 'TOGGLE_SIDEBAR') setIsOpen(prev => !prev);
      if (msg.type === 'SIDEBAR_ACTION' && msg.openSidebar) {
        setIsOpen(true);
        if (msg.action && msg.selectedText) {
          // Delay to let sidebar open first
          setTimeout(() => {
            sendMessage(msg.action!, msg.selectedText!, { selectedText: msg.selectedText || '' });
          }, 200);
        }
      }
    };
    try {
      chrome.runtime.onMessage.addListener(handler);
    } catch {
      setContextInvalid(true);
    }
    return () => { try { chrome.runtime.onMessage.removeListener(handler); } catch { /* gone */ } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Load conversation from DB when sidebar opens
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const domain = window.location.hostname;
      const conv = await getOrCreateConversation(domain, document.title, window.location.href);
      setConversationId(conv.id);
      const msgs = await getConversationMessages(conv.id);
      setMessages(msgs.map(m => ({ role: m.role, content: m.content, action: m.action })));
    })();
  }, [isOpen]);

  // Sidebar resize drag
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.min(720, Math.max(320, dragStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };
    const onUp = () => {
      setIsDragging(false);
      safeStorageSet({ sidebarWidth });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, sidebarWidth]);

  // ─── Selection Toolbar Action Handler ───
  const handleSelectionAction = useCallback((action: string, selectedText: string, openSidebar?: boolean) => {
    if (openSidebar) setIsOpen(true);
    setTimeout(() => {
      // Map selection actions to prompts
      const actionPrompts: Record<string, string> = {
        'EXPLAIN_SELECTION': `Explain the following text in detail:\n\n"${selectedText}"`,
        'TRANSLATE_SELECTION': `Translate the following text to English (or Spanish if already English):\n\n"${selectedText}"`,
        'REWRITE_SELECTION': `Rewrite the following text to be clearer and more professional:\n\n"${selectedText}"`,
        'SUMMARIZE_SELECTION': `Summarize the following text in 2-3 sentences:\n\n"${selectedText}"`,
        'FIX_GRAMMAR': `Fix all grammar and spelling errors in:\n\n"${selectedText}"`,
        'ASK_ABOUT_SELECTION': ``,
      };
      if (action === 'ASK_ABOUT_SELECTION') {
        setInput(`"${selectedText.substring(0, 200)}..." — `);
        textareaRef.current?.focus();
      } else {
        const prompt = actionPrompts[action] || selectedText;
        if (prompt) sendMessage('CUSTOM_PROMPT', prompt);
      }
    }, openSidebar ? 250 : 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Build page context ───
  const buildPageContext = useCallback((fileText: string, fileName: string, imageDataUrl: string): string => {
    let pageContent = '';
    try {
      if (isYT) {
        pageContent = buildYouTubeContext();
      } else {
        const { text } = extractPageContent();
        pageContent = text;
      }
      if (fileText) {
        pageContent = `DOCUMENT ATTACHMENT (${fileName}):\n\n${fileText}\n\nPAGE CONTEXT:\n\n${pageContent}`;
      }
    } catch { /* ignore DOM errors */ }
    return pageContent;
  }, [isYT]);

  // ─── Streaming AI Request ───
  const sendMessage = useCallback((action: string, userLabel: string, extra?: Record<string, string>) => {
    if (loading) return;

    // Video transcription is handled separately — show duration picker
    if (action === 'VIDEO_TRANSCRIBE') {
      setShowDurationPicker(true);
      setIsOpen(true);
      return;
    }

    // Capture file state atomically before clearing
    const currentFileText = attachedFileText;
    const currentFileName = attachedFileName;
    const currentImage = attachedImage;
    const currentImageMime = attachedImageMime;

    // Clear attachments immediately
    setAttachedFileText('');
    setAttachedFileName('');
    setAttachedImage('');

    setLoading(true);
    setStreamingText('');

    const prompt = action === 'CUSTOM_PROMPT' ? userLabel : undefined;
    const newMessages: SidebarInternalMessage[] = [...messages, { role: 'user', content: userLabel, action }];
    setMessages(newMessages);
    setLastRequest({ action, label: userLabel, extra });

    // Save user message to DB
    if (conversationId) {
      appendMessage(conversationId, 'user', userLabel, action).catch(() => {});
    }

    setTimeout(async () => {
      const pageContent = buildPageContext(currentFileText, currentFileName, currentImage);
      const imageBase64 = currentImage ? currentImage.split(',')[1] : undefined;
      const imageMime = currentImage ? currentImageMime : undefined;

      // Handle Deep Research specially
      if (action === 'DEEP_RESEARCH') {
        try {
          const topic = userLabel === 'Research' ? (extractPageContent().title || document.title) : userLabel;
          const ctx = await conductResearch(topic, (p) => setResearchProgress(p));
          setResearchProgress(null);
          const researchPrompt = buildResearchPrompt(ctx);
          // Now send to AI
          if (!isExtensionContextValid()) { setContextInvalid(true); setLoading(false); return; }
          const port = chrome.runtime.connect({ name: 'omni-stream' });
          port.postMessage({
            action: 'CUSTOM_PROMPT',
            content: '',
            prompt: researchPrompt,
            history: [],
            model: selectedModel,
            isYouTube: isYT,
          });
          let accumulated = '';
          port.onMessage.addListener((msg: { type: string; text?: string; error?: string }) => {
            if (msg.type === 'chunk') { accumulated += msg.text; setStreamingText(accumulated); }
            else if (msg.type === 'done') {
              setMessages(prev => [...prev, { role: 'ai', content: accumulated }]);
              if (conversationId) appendMessage(conversationId, 'ai', accumulated, action).catch(() => {});
              setStreamingText(''); setLoading(false);
              port.disconnect();
            } else if (msg.type === 'error') {
              setMessages(prev => [...prev, { role: 'ai', content: `❌ ${msg.error}` }]);
              setStreamingText(''); setLoading(false);
              port.disconnect();
            }
          });
          port.onDisconnect.addListener(() => { if (loading) { setLoading(false); setStreamingText(''); } });
        } catch (e: unknown) {
          setResearchProgress(null);
          const msg = e instanceof Error ? e.message : String(e);
          setMessages(prev => [...prev, { role: 'ai', content: `❌ Research error: ${msg}` }]);
          setLoading(false);
        }
        return;
      }

      if (!isExtensionContextValid()) {
        setContextInvalid(true);
        setLoading(false);
        setMessages(prev => [...prev, { role: 'ai', content: '🚨 Extension updated. Please refresh this page (F5).' }]);
        return;
      }
      try {
        const port = chrome.runtime.connect({ name: 'omni-stream' });
        port.postMessage({
          action,
          content: pageContent,
          prompt: prompt || userLabel,
          history: newMessages.slice(-20), // Send last 20 messages for context
          model: selectedModel,
          isYouTube: isYT,
          imageBase64,
          imageMime,
          ...(extra || {}),
        });

        // Handle compare mode: also stream to second model
        let comparePort: chrome.runtime.Port | null = null;
        let compareAccumulated = '';
        if (compareMode && compareModel && compareModel !== selectedModel) {
          comparePort = chrome.runtime.connect({ name: 'omni-stream' });
          comparePort.postMessage({
            action,
            content: pageContent,
            prompt: prompt || userLabel,
            history: newMessages.slice(-20),
            model: compareModel,
            isYouTube: isYT,
            imageBase64,
            imageMime,
            ...(extra || {}),
          });
          comparePort.onMessage.addListener((msg: { type: string; text?: string; error?: string }) => {
            if (msg.type === 'chunk') { compareAccumulated += msg.text; setCompareStreaming(compareAccumulated); }
            else if (msg.type === 'done') {
              setCompareMessages(prev => [...prev, { role: 'ai', content: compareAccumulated }]);
              setCompareStreaming('');
              comparePort?.disconnect();
            } else if (msg.type === 'error') {
              setCompareMessages(prev => [...prev, { role: 'ai', content: `❌ ${msg.error}` }]);
              setCompareStreaming('');
              comparePort?.disconnect();
            }
          });
        }

        let accumulated = '';
        port.onMessage.addListener((msg: { type: string; text?: string; error?: string; brain?: string }) => {
          if (msg.type === 'chunk') {
            accumulated += msg.text;
            setStreamingText(accumulated);
          } else if (msg.type === 'done') {
            if (accumulated) {
              setMessages(prev => [...prev, { role: 'ai', content: accumulated, action }]);
              if (conversationId) appendMessage(conversationId, 'ai', accumulated, action).catch(() => {});
            }
            setStreamingText('');
            setLoading(false);
            port.disconnect();
          } else if (msg.type === 'error') {
            setMessages(prev => [...prev, { role: 'ai', content: `❌ ${msg.error}` }]);
            setStreamingText('');
            setLoading(false);
            port.disconnect();
          }
        });

        port.onDisconnect.addListener(() => {
          if (loading) {
            setLoading(false);
            if (accumulated) {
              setMessages(prev => [...prev, { role: 'ai', content: accumulated, action }]);
              setStreamingText('');
            }
          }
        });
      } catch (e: unknown) {
        setLoading(false);
        const isInvalidated = e instanceof Error && e.message.includes('Extension context invalidated');
        if (isInvalidated) setContextInvalid(true);
        const errMsg = isInvalidated
          ? '🚨 Extension updated. Please refresh this page (F5).'
          : `❌ ${e instanceof Error ? e.message : 'Unknown error'}`;
        setMessages(prev => [...prev, { role: 'ai', content: errMsg }]);
      }
    }, 30);
  }, [messages, loading, selectedModel, isYT, attachedFileText, attachedFileName, attachedImage, attachedImageMime, conversationId, compareMode, compareModel, buildPageContext]);

  // ─── Retry last message ───
  const handleRetry = useCallback(() => {
    if (!lastRequest) return;
    // Remove the last error message
    setMessages(prev => {
      const msgs = [...prev];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === 'ai') msgs.pop();
      if (msgs.length > 0 && msgs[msgs.length - 1].role === 'user') msgs.pop();
      return msgs;
    });
    setTimeout(() => sendMessage(lastRequest.action, lastRequest.label, lastRequest.extra), 50);
  }, [lastRequest, sendMessage]);

  // ─── Video Transcription ───
  const handleVideoTranscribe = useCallback(async (durationSec: number) => {
    setShowDurationPicker(false);
    if (!isExtensionContextValid()) { setContextInvalid(true); return; }

    const abort = new AbortController();
    videoAbortRef.current = abort;
    setLoading(true);
    setVideoTranscribeProgress({ stage: 'detecting', message: 'Looking for video on this page…' });

    const title = getVideoSourceTitle();
    setMessages(prev => [...prev, { role: 'user', content: `🎬 Transcribe video: "${title}" (${durationSec}s)` }]);

    try {
      const { base64, mimeType, durationSec: actual } = await captureVideoAudio(
        durationSec * 1000,
        p => setVideoTranscribeProgress(p),
        abort.signal,
      );

      const result = await transcribeVideoAudio(base64, mimeType, actual, p => setVideoTranscribeProgress(p));

      const output = `## 📝 Transcript — "${result.title}"\n\n*Captured ${result.durationSec}s · transcribed by ${result.source === 'gemini' ? 'Gemini' : 'OpenAI Whisper'}*\n\n${result.transcript}`;
      setMessages(prev => [...prev, { role: 'ai', content: output }]);
      if (conversationId) appendMessage(conversationId, 'ai', output, 'VIDEO_TRANSCRIBE').catch(() => {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'Cancelled') {
        setMessages(prev => [...prev, { role: 'ai', content: `❌ ${msg}` }]);
      }
    } finally {
      setVideoTranscribeProgress(null);
      setLoading(false);
      videoAbortRef.current = null;
    }
  }, [conversationId, isExtensionContextValid]);

  // ─── Audio Dictation ───
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          stream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Data = (reader.result as string).split(',')[1];
            setLoading(true);
            setMessages(prev => [...prev, { role: 'user', content: '🎙️ Processing audio...' }]);

            // Timeout wrapper
            let responded = false;
            const timeout = setTimeout(() => {
              if (!responded) {
                responded = true;
                setLoading(false);
                setMessages(prev => prev.filter(m => m.content !== '🎙️ Processing audio...'));
                setMessages(prev => [...prev, { role: 'ai', content: '❌ Audio transcription timed out. Please try again.' }]);
              }
            }, 30000);

            chrome.runtime.sendMessage({ type: 'TRANSCRIBE_AUDIO', base64: base64Data, mimeType: 'audio/webm' }, (response) => {
              if (responded) return;
              responded = true;
              clearTimeout(timeout);
              setLoading(false);
              setMessages(prev => prev.filter(m => m.content !== '🎙️ Processing audio...'));

              if (chrome.runtime.lastError) {
                setMessages(prev => [...prev, { role: 'ai', content: `❌ ${chrome.runtime.lastError?.message || 'Extension error'}` }]);
              } else if (response?.error) {
                setMessages(prev => [...prev, { role: 'ai', content: `❌ ${response.error}` }]);
              } else if (response?.text) {
                const transcribed = response.text.trim();
                if (!transcribed) {
                  setMessages(prev => [...prev, { role: 'ai', content: '⚠️ No speech detected in recording.' }]);
                } else {
                  setInput(prev => {
                    const newVal = prev + (prev ? ' ' : '') + transcribed;
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                      textareaRef.current.value = newVal;
                    }
                    return newVal;
                  });
                }
              }
            });
          };
          reader.readAsDataURL(audioBlob);
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (e: unknown) {
        setIsRecording(false);
        const msg = e instanceof Error ? e.message : String(e);
        setMessages(prev => [...prev, { role: 'ai', content: `❌ Mic Error: ${msg}` }]);
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ─── File Upload ───
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Handle image files
    if (file.type.startsWith('image/')) {
      const { readFileAsDataUrl } = await import('../../lib/screenshot');
      const dataUrl = await readFileAsDataUrl(file);
      setAttachedImage(dataUrl);
      setAttachedImageMime(file.type);
      setAttachedFileName(file.name);
      if (e.target) e.target.value = '';
      return;
    }

    setLoading(true);
    try {
      let text = '';
      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else {
        text = await file.text();
      }
      setAttachedFileText(text.substring(0, 150000));
      setAttachedFileName(file.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { role: 'ai', content: `❌ File error: ${msg}` }]);
    } finally {
      setLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  // ─── Screenshot ───
  const handleScreenshot = async () => {
    try {
      setLoading(true);
      const { dataUrl } = await captureScreenshot();
      setAttachedImage(dataUrl);
      setAttachedImageMime('image/png');
      setAttachedFileName('screenshot.png');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages(prev => [...prev, { role: 'ai', content: `❌ Screenshot error: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Clipboard Paste (images) ───
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const img = await getClipboardImage(e);
    if (img?.dataUrl) {
      e.preventDefault();
      setAttachedImage(img.dataUrl);
      setAttachedImageMime(img.mimeType);
      setAttachedFileName('pasted-image.png');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // ─── New Chat ───
  const startNewChat = async () => {
    const conv = await createNewConversation(window.location.hostname, document.title, window.location.href);
    setConversationId(conv.id);
    setMessages([]);
    setStreamingText('');
    setCompareMessages([]);
    setShowHistory(false);
  };

  // ─── Load Conversation ───
  const loadConversation = async (id: string) => {
    setConversationId(id);
    const msgs = await getConversationMessages(id);
    setMessages(msgs.map(m => ({ role: m.role, content: m.content, action: m.action })));
    setShowHistory(false);
  };

  // ─── Load History ───
  const loadHistory = async () => {
    const convs = await getAllConversations();
    setConversations(convs);
    setShowHistory(true);
  };

  // Filtered messages for search
  const filteredMessages = searchQuery
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const isDark = theme === 'dark';

  // ─── Render ───
  return (
    <>
      {/* Selection Toolbar (always mounted, shows on selection) */}
      <SelectionToolbar onAction={handleSelectionAction} />

      {/* Floating Action Button — hover reveals satellites, click opens sidebar */}
      {!isOpen && (
        <div className="omni-fab-container" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2147483645 }}>
          <button
            className="omni-fab"
            onClick={() => {
              if (contextInvalid) { window.location.reload(); return; }
              setIsOpen(true);
            }}
            aria-label={contextInvalid ? 'Extension updated — click to reload page' : 'Open Omni-Agent'}
            title={contextInvalid ? 'Extension updated. Click to reload the page.' : 'Open Omni-Agent'}
            style={contextInvalid ? { background: 'linear-gradient(135deg, #ef4444, #dc2626)', animation: 'none' } : undefined}
          >
            {contextInvalid ? '↻' : <Sparkles size={20} />}

            {/* Satellite: Screenshot */}
            <button
              className="omni-fab-satellite"
              style={{ '--sat-x': '-60px', '--sat-y': '-60px' } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation();
                setFabExpanded(false);
                setIsOpen(true);
                setTimeout(() => handleScreenshot(), 100);
              }}
              title="Screenshot"
              aria-label="Screenshot"
            >
              <Camera size={16} />
            </button>

            {/* Satellite: Voice */}
            <button
              className="omni-fab-satellite"
              style={{ '--sat-x': '0px', '--sat-y': '-76px' } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation();
                setFabExpanded(false);
                toggleRecording();
              }}
              title={isRecording ? 'Stop recording' : 'Record voice'}
              aria-label={isRecording ? 'Stop recording' : 'Record voice'}
            >
              {isRecording ? <Square size={16} style={{ fill: 'currentColor' }} /> : <Mic size={16} />}
            </button>

            {/* Satellite: Transcribe video */}
            <button
              className="omni-fab-satellite"
              style={{ '--sat-x': '-76px', '--sat-y': '0px' } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation();
                setFabExpanded(false);
                setIsOpen(true);
                setTimeout(() => sendMessage('VIDEO_TRANSCRIBE', 'Transcribe'), 100);
              }}
              title="Transcribe video"
              aria-label="Transcribe video"
            >
              <Clapperboard size={16} />
            </button>

            {/* Satellite: New chat */}
            <button
              className="omni-fab-satellite"
              style={{ '--sat-x': '-60px', '--sat-y': '60px' } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation();
                setFabExpanded(false);
                setIsOpen(true);
                setTimeout(() => startNewChat(), 100);
              }}
              title="New chat"
              aria-label="New chat"
            >
              <Plus size={16} />
            </button>
          </button>
        </div>
      )}

      {/* Sidebar Panel */}
      {isOpen && (
        <div
          ref={sidebarRef}
          className="omni-sidebar"
          style={{ width: `${sidebarWidth}px` }}
          data-theme={theme}
          data-streaming={loading && streamingText ? 'true' : 'false'}
        >
          {/* Resize handle */}
          <div
            onMouseDown={(e) => {
              setIsDragging(true);
              dragStartX.current = e.clientX;
              dragStartWidth.current = sidebarWidth;
            }}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px',
              cursor: 'ew-resize', zIndex: 10,
              background: isDragging ? 'rgba(99,102,241,0.4)' : 'transparent',
              transition: 'background 0.15s',
            }}
            title="Drag to resize"
          />

          {/* Header */}
          <div className="omni-header">
            {/* Wordmark */}
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--omni-text)', letterSpacing: -0.3 }}>
              omni<span style={{ color: 'var(--omni-accent)' }}>.</span>
            </span>

            {/* Model badge — click to open model picker modal */}
            <button
              className="omni-model-badge"
              onClick={() => setShowModelModal(v => !v)}
              title="Change model"
              style={{ marginLeft: 'auto', marginRight: 4 }}
            >
              {MODELS.find(m => m.id === selectedModel)?.name?.split(' ').slice(0, 2).join(' ') || 'Model'}
            </button>

            {/* Secondary header actions */}
            <button className="omni-close" onClick={startNewChat} title="New chat" aria-label="New chat"><Plus size={15} /></button>
            <button className="omni-close" onClick={loadHistory} title="Chat history" aria-label="Chat history"><History size={15} /></button>
            <button className="omni-close" onClick={() => setShowSearch(!showSearch)} title="Search chat" aria-label="Search chat"><Search size={15} /></button>
            <button className="omni-close" onClick={() => setCompareMode(!compareMode)} title="Compare AI models" aria-label="Compare mode" style={{ color: compareMode ? 'var(--omni-accent)' : undefined }}><SplitSquareHorizontal size={15} /></button>
            <button className="omni-close" onClick={() => { const next = isDark ? 'light' : 'dark'; setTheme(next); safeStorageSet({ theme: next }); }} title="Toggle theme" aria-label="Toggle theme">
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {/* Knowledge Base */}
            <button className="omni-close" onClick={() => setShowKnowledge(true)} title="Knowledge base" aria-label="Knowledge base">
              <BookOpen size={15} />
            </button>
            {/* Close */}
            <button className="omni-close" onClick={() => setIsOpen(false)} aria-label="Close sidebar"><X size={15} /></button>
          </div>

          {/* Model picker modal — slide up from bottom */}
          {showModelModal && (
            <div className="omni-model-modal" onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--omni-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Select Model
              </div>
              {['google', 'openai', 'anthropic', 'deepseek', 'groq', 'ollama'].map(provider => {
                const providerModels = MODELS.filter(m => m.provider === provider);
                if (!providerModels.length) return null;
                return (
                  <div key={provider}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--omni-text-muted)', padding: '4px 4px 2px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{provider}</div>
                    {providerModels.map(m => (
                      <button
                        key={m.id}
                        className={`omni-model-modal-item${selectedModel === m.id ? ' selected' : ''}`}
                        onClick={() => { setSelectedModel(m.id); safeStorageSet({ selectedModel: m.id }); setShowModelModal(false); }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14 }}>{m.icon}</span>
                          <span>{m.name}</span>
                        </span>
                        {selectedModel === m.id && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {showModelModal && <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setShowModelModal(false)} />}

          {/* Knowledge Base Panel */}
          {showKnowledge && (
            <KnowledgePanel onClose={() => setShowKnowledge(false)} />
          )}

          {/* History Panel */}
          {showHistory && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,14,26,0.98)', zIndex: 10, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'white', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><History size={16} /> Chat History</span>
                <button onClick={() => setShowHistory(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '11px' }}>Close</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {conversations.length === 0
                  ? <div style={{ color: '#64748b', textAlign: 'center', padding: '24px', fontSize: '13px' }}>No conversation history.</div>
                  : conversations.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '8px', background: c.id === conversationId ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                      onClick={() => loadConversation(c.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.pageTitle || c.domain}</div>
                        <div style={{ fontSize: '10px', color: '#475569' }}>{c.domain} · {c.messageCount} msgs · {new Date(c.updatedAt).toLocaleDateString()}</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteConversation(c.id).then(loadHistory); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>✕</button>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* Search Bar */}
          {showSearch && (
            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{ width: '100%', padding: '7px 7px 7px 30px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* YouTube Indicator */}
          {isYT && (
            <div className="omni-yt-badge">
              <Youtube size={14} /> YouTube detected — video context enabled
            </div>
          )}

          {/* Duration Picker — shown when VIDEO_TRANSCRIBE macro is clicked */}
          {showDurationPicker && !loading && (
            <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', flexShrink: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', marginBottom: '8px' }}>🎬 How long to capture?</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[30, 120, 300, 600].map(sec => (
                  <button
                    key={sec}
                    onClick={() => handleVideoTranscribe(sec)}
                    style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {sec < 60 ? `${sec}s` : `${sec / 60} min`}
                  </button>
                ))}
                <button
                  onClick={() => setShowDurationPicker(false)}
                  style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', fontSize: '11px', cursor: 'pointer', marginLeft: 'auto' }}
                >
                  Cancel
                </button>
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>Make sure the video is playing before capturing. Works on YouTube, Vimeo, and most sites.</div>
            </div>
          )}

          {/* Video Transcription Progress */}
          {videoTranscribeProgress && (
            <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#f87171' }}>{videoTranscribeProgress.message}</div>
                {videoTranscribeProgress.stage === 'recording' && (
                  <button
                    onClick={() => videoAbortRef.current?.abort()}
                    style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#f87171', fontSize: '10px', fontWeight: 600, cursor: 'pointer', padding: '2px 8px' }}
                  >
                    Stop early
                  </button>
                )}
              </div>
              {videoTranscribeProgress.stage === 'recording' && videoTranscribeProgress.secondsRemaining !== undefined && (
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #ef4444, #f87171)', transition: 'width 0.5s linear', borderRadius: '4px',
                    width: `${100 - (videoTranscribeProgress.secondsRemaining / (videoTranscribeProgress.secondsRemaining + 1)) * 100}%` }} />
                </div>
              )}
            </div>
          )}

          {/* Compare Mode selector */}
          {compareMode && (
            <div style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SplitSquareHorizontal size={13} style={{ color: '#818cf8' }} />
              <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600 }}>Compare with:</span>
              <select value={compareModel} onChange={e => setCompareModel(e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', color: '#e2e8f0', fontSize: '11px', padding: '4px 8px', outline: 'none' }}>
                <option value="">Select second model</option>
                {MODELS.filter(m => m.id !== selectedModel).map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
              </select>
            </div>
          )}

          {/* Macro Bar */}
          <MacroBar onMacro={sendMessage} disabled={loading} isRecording={isRecording} onToggleRecording={toggleRecording} />

          {/* Research Progress */}
          {researchProgress && (
            <div style={{ padding: '10px 16px', background: 'rgba(6,182,212,0.08)', borderBottom: '1px solid rgba(6,182,212,0.2)', flexShrink: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#22d3ee', marginBottom: '4px' }}>{researchProgress.detail}</div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg, #6366f1, #22d3ee)', width: `${researchProgress.progress}%`, transition: 'width 0.4s ease', borderRadius: '4px' }} />
              </div>
            </div>
          )}

          {/* Chat Area */}
          <div className="omni-chat" style={{ display: compareMode && compareModel ? 'grid' : 'flex', gridTemplateColumns: compareMode && compareModel ? '1fr 1fr' : undefined, gap: compareMode && compareModel ? '0' : '14px' }}>
            {compareMode && compareModel ? (
              // Compare mode: split view
              <>
                {/* Primary model */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '12px', borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {MODELS.find(m => m.id === selectedModel)?.icon} {MODELS.find(m => m.id === selectedModel)?.name}
                  </div>
                  {filteredMessages.filter(m => m.role === 'ai').map((m, i) => (
                    <ChatMessage key={i} role="ai" content={m.content} onRetry={handleRetry} />
                  ))}
                  {streamingText && <ChatMessage role="ai" content={streamingText} isStreaming />}
                  {loading && !streamingText && <div className="omni-msg omni-msg-ai"><div className="omni-bubble omni-bubble-ai"><div className="omni-dots"><div className="omni-dot" /><div className="omni-dot" /><div className="omni-dot" /></div></div></div>}
                </div>
                {/* Compare model */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '12px', overflowY: 'auto' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {MODELS.find(m => m.id === compareModel)?.icon} {MODELS.find(m => m.id === compareModel)?.name}
                  </div>
                  {compareMessages.filter(m => m.role === 'ai').map((m, i) => (
                    <ChatMessage key={i} role="ai" content={m.content} />
                  ))}
                  {compareStreaming && <ChatMessage role="ai" content={compareStreaming} isStreaming />}
                </div>
              </>
            ) : (
              // Normal chat view
              <>
                {filteredMessages.length === 0 && !streamingText && !loading && (() => {
                  const emptyStateTitle = isYT
                    ? 'YouTube detected'
                    : 'What can I help with?';
                  const emptyStateSubtitle = isYT
                    ? 'Summarize, translate, or ask about this video'
                    : 'Ask anything about this page, or use a quick action below';
                  const emptySuggestedActions = isYT
                    ? [
                        { action: 'SUMMARIZE_PAGE', label: 'Summarize', icon: <Sparkles size={12} /> },
                        { action: 'VIDEO_TRANSCRIBE', label: 'Transcribe', icon: <Clapperboard size={12} /> },
                        { action: 'TRANSLATE', label: 'Translate', icon: <Globe size={12} /> },
                      ]
                    : [
                        { action: 'SUMMARIZE_PAGE', label: 'Summarize', icon: <Sparkles size={12} /> },
                        { action: 'EXTRACT_DATA', label: 'Extract Data', icon: <Database size={12} /> },
                        { action: 'DEEP_RESEARCH', label: 'Research', icon: <Search size={12} /> },
                      ];
                  return (
                    <div className="omni-empty-state">
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--omni-accent), var(--omni-accent-2, #7c3aed))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 24px var(--omni-accent-glow)',
                      }}>
                        <Sparkles size={22} color="white" />
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--omni-text)', marginBottom: 6 }}>
                          {emptyStateTitle}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--omni-text-muted)', lineHeight: 1.6 }}>
                          {emptyStateSubtitle}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                        {emptySuggestedActions.map(action => (
                          <button
                            key={action.action}
                            className="omni-chip"
                            onClick={() => sendMessage(action.action, action.label)}
                          >
                            {action.icon} {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {filteredMessages.map((m, i) => (
                  <ChatMessage
                    key={i}
                    role={m.role}
                    content={m.content}
                    onRetry={m.role === 'ai' && i === filteredMessages.length - 1 ? handleRetry : undefined}
                  />
                ))}
                {streamingText && <ChatMessage role="ai" content={streamingText} isStreaming />}
                {loading && !streamingText && !researchProgress && (
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
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Bar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {/* Prompt Library */}
            {showPrompts && (
              <div style={{ position: 'absolute', bottom: '100%', left: '16px', right: '16px', background: 'rgba(15,20,40,0.97)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', marginBottom: '8px', padding: '8px', maxHeight: '220px', overflowY: 'auto', boxShadow: '0 -4px 24px rgba(0,0,0,0.4)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prompt Library</div>
                {prompts.length === 0
                  ? <div style={{ fontSize: '12px', color: '#64748b', padding: '8px', textAlign: 'center' }}>No prompts saved. Add them in Options.</div>
                  : prompts.map(p => (
                    <button key={p.id} onClick={() => { setInput(prev => prev ? prev + '\n' + p.content : p.content); setShowPrompts(false); textareaRef.current?.focus(); }}
                      style={{ background: 'transparent', border: 'none', borderRadius: '8px', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{p.title}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{p.content}</div>
                    </button>
                  ))
                }
              </div>
            )}

            {/* Attachment badge */}
            {(attachedFileName) && (
              <div style={{ position: 'absolute', bottom: '100%', left: '16px', marginBottom: '8px', zIndex: 10, display: 'flex', gap: '6px', alignItems: 'center' }}>
                {attachedImage && (
                  <img src={attachedImage} alt="attachment" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.4)' }} />
                )}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '12px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, color: '#818cf8', backdropFilter: 'blur(12px)' }}>
                  <Paperclip size={12} /> {attachedFileName}
                  <button onClick={() => { setAttachedFileName(''); setAttachedFileText(''); setAttachedImage(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} /></button>
                </div>
              </div>
            )}

            <div className="omni-input-bar">
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif" onChange={handleFileUpload} />
              {/* Attach file */}
              <button onClick={() => fileInputRef.current?.click()} disabled={loading} style={{ background: attachedFileName ? 'rgba(99,102,241,0.2)' : 'transparent', border: 'none', cursor: 'pointer', color: attachedFileName ? '#818cf8' : '#94a3b8', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }} title="Attach file or image">
                <Paperclip size={17} />
              </button>
              {/* Screenshot */}
              <button onClick={handleScreenshot} disabled={loading} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }} title="Capture screenshot">
                <Camera size={17} />
              </button>
              {/* Prompt library */}
              <button onClick={() => setShowPrompts(!showPrompts)} style={{ background: showPrompts ? 'rgba(99,102,241,0.2)' : 'transparent', border: 'none', cursor: 'pointer', color: showPrompts ? '#818cf8' : '#94a3b8', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }} title="Prompt Library" aria-label="Toggle Prompt Library">
                <BookOpen size={17} />
              </button>
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
              <button className="omni-send-btn" onClick={handleSend} disabled={loading || !input.trim()} aria-label="Send message">
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Toast notification */}
          <Toast message={toastMsg} visible={toastVisible} />
        </div>
      )}
    </>
  );
}
