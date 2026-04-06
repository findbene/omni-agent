/**
 * Omni-Agent Options Page
 * Multi-provider API key management, model selection, theme toggle, and memory viewer.
 */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Settings, Key, Brain, Sparkles, ShieldCheck, Trash2, CheckCircle } from 'lucide-react';
import '../styles/tailwind.css';
import { MODELS, DEFAULT_MODEL } from '../lib/providers';

function Options() {
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [brain, setBrain] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(
      ['geminiApiKey', 'openaiApiKey', 'anthropicApiKey', 'selectedModel', 'omniAgentBrain'],
      (res) => {
        if (res.geminiApiKey) setGeminiKey(res.geminiApiKey);
        if (res.openaiApiKey) setOpenaiKey(res.openaiApiKey);
        if (res.anthropicApiKey) setAnthropicKey(res.anthropicApiKey);
        if (res.selectedModel) setSelectedModel(res.selectedModel);
        if (res.omniAgentBrain) setBrain(res.omniAgentBrain);
      }
    );
  }, []);

  const saveAll = () => {
    chrome.storage.local.set({
      geminiApiKey: geminiKey,
      openaiApiKey: openaiKey,
      anthropicApiKey: anthropicKey,
      selectedModel,
      omniAgentBrain: brain,
    }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  };

  const clearBrain = () => {
    setBrain('');
    chrome.storage.local.set({ omniAgentBrain: '' });
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0e1a', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '32px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    }}>
      <div style={{ maxWidth: '560px', width: '100%' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '16px 16px 0 0',
          padding: '28px 32px', display: 'flex', alignItems: 'center', gap: '14px'
        }}>
          <Settings size={28} color="rgba(255,255,255,0.85)" />
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '0.02em' }}>
              Omni-Agent Settings
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: '4px 0 0' }}>
              Configure your AI providers, model preferences, and agent memory.
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div style={{
          background: '#111827', borderRadius: '0 0 16px 16px',
          border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none', padding: '32px'
        }}>
          {/* API Keys Section */}
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={16} color="#818cf8" /> API Keys
          </h2>

          {/* Gemini */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Google Gemini <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace',
                outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s'
              }}
            />
          </div>

          {/* OpenAI */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              OpenAI <span style={{ color: '#64748b', fontWeight: 400 }}>(Phase 2)</span>
            </label>
            <input
              type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Anthropic */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Anthropic <span style={{ color: '#64748b', fontWeight: 400 }}>(Phase 2)</span>
            </label>
            <input
              type="password" value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '0 0 24px', paddingTop: '24px' }}>
            <p style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <ShieldCheck size={14} color="#22c55e" /> Keys are stored locally in your browser and never shared with third-party servers.
            </p>
          </div>

          {/* Model Selection */}
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#818cf8" /> Default Model
          </h2>
          <select
            value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '13px', outline: 'none',
              marginBottom: '24px', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box'
            }}
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id} style={{ background: '#1a1f35' }}>
                {m.icon} {m.name} — {m.description}
              </option>
            ))}
          </select>

          {/* Brain / Memory */}
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Brain size={16} color="#818cf8" /> Agent Memory
          </h2>
          <textarea
            value={brain} onChange={e => setBrain(e.target.value)} rows={5}
            placeholder="Facts and directives the AI will always remember..."
            style={{
              width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px', fontFamily: 'monospace',
              outline: 'none', resize: 'vertical', marginBottom: '8px', lineHeight: 1.6, boxSizing: 'border-box'
            }}
          />
          <button onClick={clearBrain} style={{
            background: 'none', border: 'none', color: '#f87171', fontSize: '11px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0', marginBottom: '24px'
          }}>
            <Trash2 size={12} /> Clear all memory
          </button>

          {/* Save Button */}
          <button onClick={saveAll} style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer',
            background: saved ? '#22c55e' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white', fontSize: '14px', fontWeight: 700, transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}>
            {saved ? <><CheckCircle size={18} /> Saved Successfully!</> : 'Save All Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Mount
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<Options />);
}
