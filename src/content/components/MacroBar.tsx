import React from 'react';
import { Sparkles, Database, PenTool, Globe, Code2, RefreshCw, Mic, Square, Zap, Search, AlignLeft, HelpCircle, DollarSign, SpellCheck2 } from 'lucide-react';

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

interface MacroDef {
  action: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  title: string;
}

const MACROS: MacroDef[] = [
  { action: 'SUMMARIZE_PAGE', label: 'Summarize', icon: <Sparkles size={13} />, color: 'rgba(99,102,241,0.12)', title: 'Summarize this page with key takeaways' },
  { action: 'BULLET_POINTS', label: 'Bullets', icon: <AlignLeft size={13} />, color: 'rgba(168,85,247,0.12)', title: 'Convert page to concise bullet points' },
  { action: 'EXTRACT_DATA', label: 'Extract Data', icon: <Database size={13} />, color: 'rgba(59,130,246,0.12)', title: 'Extract tables, lists, and structured data' },
  { action: 'DRAFT_REPLY', label: 'Draft Reply', icon: <PenTool size={13} />, color: 'rgba(34,197,94,0.12)', title: 'Draft a professional reply to this content' },
  { action: 'TRANSLATE', label: 'Translate', icon: <Globe size={13} />, color: 'rgba(14,165,233,0.12)', title: 'Translate page content' },
  { action: 'FIX_GRAMMAR', label: 'Fix Grammar', icon: <SpellCheck2 size={13} />, color: 'rgba(16,185,129,0.12)', title: 'Fix grammar and spelling errors' },
  { action: 'EXPLAIN_CODE', label: 'Explain Code', icon: <Code2 size={13} />, color: 'rgba(245,158,11,0.12)', title: 'Explain the code on this page' },
  { action: 'REWRITE', label: 'Rewrite', icon: <RefreshCw size={13} />, color: 'rgba(236,72,153,0.12)', title: 'Rewrite content in a professional tone' },
  { action: 'FIND_PRICES', label: 'Find Prices', icon: <DollarSign size={13} />, color: 'rgba(250,204,21,0.12)', title: 'Extract all prices and costs from this page' },
  { action: 'GENERATE_QUIZ', label: 'Quiz Me', icon: <HelpCircle size={13} />, color: 'rgba(139,92,246,0.12)', title: 'Generate a quiz from this page content' },
  { action: 'DEEP_RESEARCH', label: 'Research', icon: <Search size={13} />, color: 'rgba(6,182,212,0.15)', title: 'Deep multi-source research on this topic' },
  { action: 'AUTOMATE_PAGE', label: 'Automate', icon: <Zap size={13} fill="currentColor" />, color: 'rgba(234,179,8,0.15)', title: 'Generate and run automation on this page' },
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
          title={m.title}
          style={{ background: m.color }}
        >
          {m.icon} {m.label}
        </button>
      ))}
      <button
        className="omni-macro-btn"
        onClick={onToggleRecording}
        disabled={disabled && !isRecording}
        title={isRecording ? 'Stop recording' : 'Record voice input'}
        style={{
          background: isRecording ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
          color: isRecording ? '#f87171' : undefined,
          ...(isRecording ? { animation: 'fabPulse 1.5s ease-in-out infinite' } : {})
        }}
      >
        {isRecording
          ? <><Square size={13} style={{ fill: 'currentColor' }} /> Stop</>
          : <><Mic size={13} /> Record</>}
      </button>
    </div>
  );
}
