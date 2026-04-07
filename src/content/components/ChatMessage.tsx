import React from 'react';
import { renderMarkdown } from '../../lib/markdown';
import { copyToClipboard, downloadAsMarkdown, downloadAsCSV, convertTableToCSV } from '../../lib/export';
import { Copy, Download, Check, Play, Zap, Star, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { parseAIActions, runAutomationSequence } from '../../lib/automation';
import { speak, stopSpeaking, isSpeaking } from '../../lib/tts';
import { saveKnowledgeItem } from '../../lib/db';

interface ChatMessageProps {
  role: 'user' | 'ai';
  content: string;
  isStreaming?: boolean;
  onRetry?: () => void;
}

export default function ChatMessage({ role, content, isStreaming, onRetry }: ChatMessageProps) {
  const [copied, setCopied] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const automationActions = React.useMemo(() => !isStreaming ? parseAIActions(content) : null, [content, isStreaming]);
  const [running, setRunning] = React.useState(false);
  const [results, setResults] = React.useState<string[]>([]);

  const isError = content.startsWith('❌') || content.startsWith('🚨');

  const handleCopy = async () => {
    await copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    if (content.includes('|') && content.includes('---')) {
      downloadAsCSV(convertTableToCSV(content), 'omni-data.csv');
    } else {
      downloadAsMarkdown(content, 'omni-export.md');
    }
  };

  const handleRunAutomation = async () => {
    if (!automationActions) return;
    setRunning(true);
    setResults([]);
    const res = await runAutomationSequence(automationActions);
    setResults(res);
    setRunning(false);
  };

  const handleSaveToKB = async () => {
    try {
      await saveKnowledgeItem({
        content,
        summary: content.replace(/[#*`]/g, '').substring(0, 150) + (content.length > 150 ? '...' : ''),
        url: window.location.href,
        pageTitle: document.title,
        tags: [],
        type: 'clip',
        pinned: false,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save to knowledge base:', e);
    }
  };

  const handleTTS = () => {
    if (speaking || isSpeaking()) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      speak(content);
      setSpeaking(true);
      // Monitor speaking state
      const check = setInterval(() => {
        if (!isSpeaking()) {
          setSpeaking(false);
          clearInterval(check);
        }
      }, 500);
    }
  };

  // Handle copy button clicks on code blocks inside rendered markdown
  const handleBubbleClick = React.useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('copy-btn') && target.dataset.code) {
      const code = decodeURIComponent(target.dataset.code);
      navigator.clipboard.writeText(code);
      target.textContent = 'Copied!';
      setTimeout(() => { if (target) target.textContent = 'Copy'; }, 1200);
    }
  }, []);

  if (role === 'user') {
    return (
      <div className="omni-msg omni-msg-user">
        <div className="omni-bubble omni-bubble-user" style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
      </div>
    );
  }

  const html = renderMarkdown(content);

  return (
    <div className="omni-msg omni-msg-ai">
      <div style={{ maxWidth: '92%' }}>
        <div
          className="omni-bubble omni-bubble-ai"
          onClick={handleBubbleClick}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {!isStreaming && content.length > 0 && (
          <div className="omni-msg-actions">
            {/* Copy */}
            <button
              onClick={handleCopy}
              className={`omni-action-btn${copied ? ' active' : ''}`}
              title="Copy to clipboard"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="omni-action-btn"
              title="Download"
            >
              <Download size={12} />
            </button>

            {/* Save to KB */}
            <button
              onClick={handleSaveToKB}
              className={`omni-action-btn${saved ? ' active' : ''}`}
              title={saved ? 'Saved to Knowledge Base!' : 'Save to Knowledge Base'}
            >
              <Star size={12} />
            </button>

            {/* Text-to-Speech */}
            <button
              onClick={handleTTS}
              className={`omni-action-btn${speaking ? ' active' : ''}`}
              title={speaking ? 'Stop speaking' : 'Read aloud'}
            >
              {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>

            {/* Retry on error */}
            {isError && onRetry && (
              <button
                onClick={onRetry}
                className="omni-action-btn active"
                title="Retry this request"
              >
                <RotateCcw size={12} />
              </button>
            )}

            {/* Run Automation */}
            {automationActions && !isError && (
              <button
                onClick={handleRunAutomation}
                disabled={running}
                className="omni-action-btn"
                title="Run Automation"
              >
                {running ? <Zap size={12} className="omni-spin" /> : <Play size={12} />}
              </button>
            )}
          </div>
        )}

        {/* Automation results */}
        {results.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '11px', background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '8px', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>Automation Results:</div>
            {results.map((r, i) => <div key={i} style={{ marginBottom: '3px', lineHeight: 1.4 }}>{r}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
