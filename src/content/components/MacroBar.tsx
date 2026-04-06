import React from 'react';
import { Sparkles, Database, PenTool, Globe, Code2, RefreshCw, Mic, Square } from 'lucide-react';

export interface MacroAction {
  action: string;
  label: string;
  targetLang?: string;
  tone?: string;
}

interface MacroBarProps {
  onMacro: (action: string, label: string, extra?: Record<string, string>) => void;
  disabled: boolean;
  isRecording: boolean;
  onToggleRecording: () => void;
}

const MACROS: { action: string; label: string; icon: React.ReactNode; color: string }[] = [
  { action: 'SUMMARIZE_PAGE', label: 'Summarize', icon: <Sparkles size={13} />, color: 'rgba(99,102,241,0.12)' },
  { action: 'EXTRACT_DATA', label: 'Extract Data', icon: <Database size={13} />, color: 'rgba(168,85,247,0.12)' },
  { action: 'DRAFT_REPLY', label: 'Draft Reply', icon: <PenTool size={13} />, color: 'rgba(34,197,94,0.12)' },
  { action: 'TRANSLATE', label: 'Translate', icon: <Globe size={13} />, color: 'rgba(59,130,246,0.12)' },
  { action: 'EXPLAIN_CODE', label: 'Explain Code', icon: <Code2 size={13} />, color: 'rgba(245,158,11,0.12)' },
  { action: 'REWRITE', label: 'Rewrite', icon: <RefreshCw size={13} />, color: 'rgba(236,72,153,0.12)' },
];

export default function MacroBar({ onMacro, disabled, isRecording, onToggleRecording }: MacroBarProps) {
  return (
    <div className="omni-macros">
      {MACROS.map(m => (
        <button
          key={m.action}
          className="omni-macro-btn"
          onClick={() => onMacro(m.action, m.label)}
          disabled={disabled}
          title={m.label}
          style={{ background: m.color }}
        >
          {m.icon} {m.label}
        </button>
      ))}
      <button
        className="omni-macro-btn"
        onClick={onToggleRecording}
        disabled={disabled && !isRecording}
        style={{
          background: isRecording ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
          color: isRecording ? '#f87171' : undefined,
          ...(isRecording ? { animation: 'fabPulse 1.5s ease-in-out infinite' } : {})
        }}
      >
        {isRecording ? <><Square size={13} style={{ fill: 'currentColor' }} /> Stop</> : <><Mic size={13} /> Record</>}
      </button>
    </div>
  );
}
