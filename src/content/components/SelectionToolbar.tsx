/**
 * Floating AI toolbar that appears when user selects text on any page.
 * Provides quick AI actions: Explain, Translate, Rewrite, Summarize, Fix Grammar, Ask.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Globe, RefreshCw, Sparkles, SpellCheck, MessageSquare, Copy, Check } from 'lucide-react';

interface SelectionToolbarProps {
  onAction: (action: string, selectedText: string, openSidebar?: boolean) => void;
}

interface ToolbarPosition {
  x: number;
  y: number;
  flipped: boolean;
}

const TOOLBAR_ACTIONS = [
  { id: 'EXPLAIN_SELECTION', icon: Brain, label: 'Explain', color: '#818cf8' },
  { id: 'TRANSLATE_SELECTION', icon: Globe, label: 'Translate', color: '#60a5fa' },
  { id: 'REWRITE_SELECTION', icon: RefreshCw, label: 'Rewrite', color: '#f472b6' },
  { id: 'SUMMARIZE_SELECTION', icon: Sparkles, label: 'Summarize', color: '#a78bfa' },
  { id: 'FIX_GRAMMAR', icon: SpellCheck, label: 'Fix', color: '#34d399' },
  { id: 'ASK_ABOUT_SELECTION', icon: MessageSquare, label: 'Ask', color: '#fb923c' },
];

export default function SelectionToolbar({ onAction }: SelectionToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<ToolbarPosition>({ x: 0, y: 0, flipped: false });
  const [selectedText, setSelectedText] = useState('');
  const [copied, setCopied] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';

    if (text.length < 20) {
      setVisible(false);
      setSelectedText('');
      return;
    }

    const range = selection?.getRangeAt(0);
    if (!range) return;

    const rect = range.getBoundingClientRect();
    if (!rect.width) return;

    const toolbarHeight = 44;
    const toolbarWidth = 280;
    const margin = 8;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Position above selection, centered
    let x = rect.left + scrollX + rect.width / 2 - toolbarWidth / 2;
    let y = rect.top + scrollY - toolbarHeight - margin;
    let flipped = false;

    // Flip below if too close to top
    if (y < scrollY + margin) {
      y = rect.bottom + scrollY + margin;
      flipped = true;
    }

    // Clamp to viewport
    x = Math.max(margin + scrollX, Math.min(x, window.innerWidth + scrollX - toolbarWidth - margin));

    setPosition({ x, y, flipped });
    setSelectedText(text);
    setVisible(true);
  }, []);

  useEffect(() => {
    const onMouseUp = () => {
      // Small delay to let selection settle
      clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(handleSelectionChange, 100);
    };

    const onMouseDown = (e: MouseEvent) => {
      // Hide if clicking outside the toolbar
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim().length < 20) {
          setVisible(false);
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(hideTimeout.current);
    };
  }, [handleSelectionChange]);

  const handleAction = (actionId: string) => {
    setVisible(false);
    onAction(actionId, selectedText, true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(selectedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 2147483646,
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        background: 'rgba(10, 14, 26, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: '12px',
        padding: '6px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
        animation: 'omniToolbarFadeIn 0.15s ease-out',
        pointerEvents: 'auto',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Caret pointer */}
      <div style={{
        position: 'absolute',
        [position.flipped ? 'bottom' : 'top']: '-6px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        ...(position.flipped
          ? { borderTop: '6px solid rgba(99,102,241,0.3)' }
          : { borderBottom: '6px solid rgba(99,102,241,0.3)' }
        ),
      }} />

      {TOOLBAR_ACTIONS.map(({ id, icon: Icon, label, color }) => (
        <button
          key={id}
          onClick={() => handleAction(id)}
          title={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 8px',
            borderRadius: '8px',
            border: 'none',
            background: 'transparent',
            color,
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            whiteSpace: 'nowrap',
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}

      {/* Divider */}
      <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0 }} />

      {/* Copy button */}
      <button
        onClick={handleCopy}
        title="Copy selection"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '5px 8px',
          borderRadius: '8px',
          border: 'none',
          background: 'transparent',
          color: copied ? '#22c55e' : '#94a3b8',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          transition: 'all 0.12s',
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}
