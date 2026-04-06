import React from 'react';
import { renderMarkdown } from '../../lib/markdown';
import { copyToClipboard, downloadAsMarkdown, downloadAsCSV, convertTableToCSV } from '../../lib/export';
import { Copy, Download, Check } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'ai';
  content: string;
  isStreaming?: boolean;
}

export default function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const [copied, setCopied] = React.useState(false);

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

  // Handle copy button clicks on code blocks inside rendered markdown
  const handleBubbleClick = React.useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('copy-btn') && target.dataset.code) {
      const code = decodeURIComponent(target.dataset.code);
      navigator.clipboard.writeText(code);
      target.textContent = 'Copied!';
      setTimeout(() => { target.textContent = 'Copy'; }, 1200);
    }
  }, []);

  if (role === 'user') {
    return (
      <div className="omni-msg omni-msg-user">
        <div className="omni-bubble omni-bubble-user">{content}</div>
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
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px', paddingLeft: '4px' }}>
            <button
              onClick={handleCopy}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                color: copied ? '#22c55e' : '#64748b', display: 'flex', alignItems: 'center', gap: '3px',
                fontSize: '10px', transition: 'color 0.15s'
              }}
              title="Copy to clipboard"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px',
                fontSize: '10px', transition: 'color 0.15s'
              }}
              title="Download"
            >
              <Download size={12} /> Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
