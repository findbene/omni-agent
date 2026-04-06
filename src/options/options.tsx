/**
 * Omni-Agent Options Page v3.0
 * Multi-provider API keys, model selection, memory, prompts, trackers, webhooks, and TTS settings.
 */
import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Settings, Key, Brain, Sparkles, ShieldCheck, Trash2, CheckCircle, BookOpen,
  Plus, Edit2, Save, X, Activity, Webhook, Volume2, Download, Upload, ExternalLink
} from 'lucide-react';
import '../styles/tailwind.css';
import { MODELS, DEFAULT_MODEL } from '../lib/providers';
import { CustomPrompt, MonitorJob, WebhookConfig, getSettings, saveSettings, exportSettings, importSettings } from '../lib/storage';

type Tab = 'settings' | 'prompts' | 'tracking' | 'webhooks' | 'voice';

function Options() {
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [brain, setBrain] = useState('');
  const [saved, setSaved] = useState(false);
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<CustomPrompt | null>(null);
  const [jobs, setJobs] = useState<MonitorJob[]>([]);
  const [editingJob, setEditingJob] = useState<MonitorJob | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [ttsVoice, setTtsVoice] = useState('');
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showSelectionToolbar, setShowSelectionToolbar] = useState(true);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then(res => {
      setGeminiKey(res.geminiApiKey || '');
      setOpenaiKey(res.openaiApiKey || '');
      setAnthropicKey(res.anthropicApiKey || '');
      setDeepseekKey(res.deepseekApiKey || '');
      setGroqKey(res.groqApiKey || '');
      setOllamaUrl(res.ollamaUrl || 'http://localhost:11434');
      setSelectedModel(res.selectedModel || DEFAULT_MODEL);
      setBrain(res.omniAgentBrain || '');
      setPrompts(res.savedPrompts || []);
      setJobs(res.trackerJobs || []);
      setWebhooks(res.webhooks || []);
      setTtsVoice(res.ttsVoice || '');
      setTtsRate(res.ttsRate || 1.0);
      setTtsPitch(res.ttsPitch || 1.0);
      setShowSelectionToolbar(res.showSelectionToolbar !== false);
    });

    // Load TTS voices
    const loadVoices = () => setAvailableVoices(speechSynthesis.getVoices());
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const saveAllSettings = async () => {
    await saveSettings({
      geminiApiKey: geminiKey,
      openaiApiKey: openaiKey,
      anthropicApiKey: anthropicKey,
      deepseekApiKey: deepseekKey,
      groqApiKey: groqKey,
      ollamaUrl,
      selectedModel,
      omniAgentBrain: brain,
      ttsVoice,
      ttsRate,
      ttsPitch,
      showSelectionToolbar,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const clearBrain = async () => {
    if (!window.confirm('Clear all agent memory? This cannot be undone.')) return;
    setBrain('');
    await saveSettings({ omniAgentBrain: '' });
  };

  // ── Prompt Management ──
  const handleSavePrompt = async () => {
    if (!editingPrompt || !editingPrompt.title.trim() || !editingPrompt.content.trim()) return;
    let newPrompts = [...prompts];
    if (editingPrompt.id) {
      newPrompts = newPrompts.map(p => p.id === editingPrompt.id ? editingPrompt : p);
    } else {
      newPrompts.push({ ...editingPrompt, id: 'p_' + Date.now().toString() });
    }
    setPrompts(newPrompts);
    await saveSettings({ savedPrompts: newPrompts });
    setEditingPrompt(null);
  };
  const handleDeletePrompt = async (id: string) => {
    const newPrompts = prompts.filter(p => p.id !== id);
    setPrompts(newPrompts);
    await saveSettings({ savedPrompts: newPrompts });
  };

  // ── Tracker Management ──
  const handleSaveJob = async () => {
    if (!editingJob || !editingJob.name.trim() || !editingJob.url.trim() || !editingJob.selector.trim()) return;
    // Validate URL
    try { new URL(editingJob.url); } catch { alert('Invalid URL. Include https://'); return; }
    let newJobs = [...jobs];
    if (editingJob.id) {
      newJobs = newJobs.map(j => j.id === editingJob.id ? editingJob : j);
    } else {
      newJobs.push({ ...editingJob, id: 'j_' + Date.now().toString(), intervalMin: Math.max(1, editingJob.intervalMin || 15) });
    }
    setJobs(newJobs);
    await saveSettings({ trackerJobs: newJobs });
    setEditingJob(null);
  };
  const handleDeleteJob = async (id: string) => {
    const newJobs = jobs.filter(j => j.id !== id);
    setJobs(newJobs);
    await saveSettings({ trackerJobs: newJobs });
  };

  // ── Webhook Management ──
  const handleSaveWebhook = async () => {
    if (!editingWebhook || !editingWebhook.name.trim() || !editingWebhook.url.trim()) return;
    try { new URL(editingWebhook.url); } catch { alert('Invalid webhook URL'); return; }
    let newWebhooks = [...webhooks];
    if (editingWebhook.id) {
      newWebhooks = newWebhooks.map(w => w.id === editingWebhook.id ? editingWebhook : w);
    } else {
      newWebhooks.push({ ...editingWebhook, id: 'wh_' + Date.now().toString() });
    }
    setWebhooks(newWebhooks);
    await saveSettings({ webhooks: newWebhooks });
    setEditingWebhook(null);
  };
  const handleDeleteWebhook = async (id: string) => {
    const newWebhooks = webhooks.filter(w => w.id !== id);
    setWebhooks(newWebhooks);
    await saveSettings({ webhooks: newWebhooks });
  };
  const handleTestWebhook = async (url: string) => {
    try {
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trigger: 'test', timestamp: Date.now(), source: 'Omni-Agent' }) });
      alert('✅ Webhook sent! Check your endpoint for the test payload.');
    } catch (e: unknown) {
      alert(`❌ Webhook failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ── Settings Export / Import ──
  const handleExport = async () => {
    const json = await exportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'omni-agent-settings.json'; a.click();
    URL.revokeObjectURL(url);
  };
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importSettings(text);
      alert('✅ Settings imported! Reload this page to see changes.');
      window.location.reload();
    } catch (err: unknown) {
      alert(`❌ Import failed: ${err instanceof Error ? err.message : 'Invalid settings file'}`);
    }
    if (e.target) e.target.value = '';
  };

  // ── TTS Preview ──
  const previewTTS = () => {
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance('Omni-Agent is ready to assist you with any task on any page.');
    utt.rate = ttsRate;
    utt.pitch = ttsPitch;
    const voice = availableVoices.find(v => v.name === ttsVoice);
    if (voice) utt.voice = voice;
    speechSynthesis.speak(utt);
  };

  const tabStyle = (tab: Tab) => ({
    padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600,
    background: activeTab === tab ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)',
    color: activeTab === tab ? 'white' : '#94a3b8',
    transition: 'all 0.2s',
  } as React.CSSProperties);

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 20px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '700px', width: '100%' }}>
        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#e2e8f0', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Omni-Agent</h1>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>v3.0.0 — Your Ultimate AI Browser Co-pilot</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleExport} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} /> Export
            </button>
            <input type="file" ref={importRef} accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            <button onClick={() => importRef.current?.click()} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={14} /> Import
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button style={tabStyle('settings')} onClick={() => setActiveTab('settings')}><Settings size={15} /> API & Settings</button>
          <button style={tabStyle('prompts')} onClick={() => setActiveTab('prompts')}><BookOpen size={15} /> Prompts</button>
          <button style={tabStyle('tracking')} onClick={() => setActiveTab('tracking')}><Activity size={15} /> Trackers</button>
          <button style={tabStyle('webhooks')} onClick={() => setActiveTab('webhooks')}><Webhook size={15} /> Webhooks</button>
          <button style={tabStyle('voice')} onClick={() => setActiveTab('voice')}><Volume2 size={15} /> Voice & TTS</button>
        </div>

        <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', padding: '32px' }}>

          {/* ─── API & Settings ─── */}
          {activeTab === 'settings' && (
            <>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Key size={16} color="#818cf8" /> API Keys</h2>

              {[
                { label: 'Google Gemini', required: true, value: geminiKey, setter: setGeminiKey, placeholder: 'AIzaSy...', link: 'https://aistudio.google.com/app/apikey' },
                { label: 'OpenAI', required: false, value: openaiKey, setter: setOpenaiKey, placeholder: 'sk-...', link: 'https://platform.openai.com/api-keys' },
                { label: 'Anthropic (Claude)', required: false, value: anthropicKey, setter: setAnthropicKey, placeholder: 'sk-ant-...', link: 'https://console.anthropic.com/settings/keys' },
                { label: 'DeepSeek', required: false, value: deepseekKey, setter: setDeepseekKey, placeholder: 'sk-...', link: 'https://platform.deepseek.com/api_keys' },
                { label: 'Groq (Ultra-fast)', required: false, value: groqKey, setter: setGroqKey, placeholder: 'gsk_...', link: 'https://console.groq.com/keys' },
              ].map(({ label, required, value, setter, placeholder, link }) => (
                <div key={label} style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>
                    {label} {required && <span style={{ color: '#f87171' }}>*</span>}
                    <a href={link} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px', color: '#818cf8', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><ExternalLink size={10} /> Get key</a>
                  </label>
                  <input type="password" value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, fontFamily: 'monospace' }} />
                </div>
              ))}

              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Ollama URL (Local AI)</label>
                <input type="text" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" style={{ ...inputStyle, fontFamily: 'monospace' }} />
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '0 0 24px', paddingTop: '16px' }}>
                <p style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <ShieldCheck size={14} color="#22c55e" /> All keys stored locally in your browser. Never sent to third parties.
                </p>
              </div>

              {/* Default Model */}
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={16} color="#818cf8" /> Default Model</h2>
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', marginBottom: '24px' }}>
                {['google', 'openai', 'anthropic', 'deepseek', 'groq', 'ollama'].map(provider => {
                  const pModels = MODELS.filter(m => m.provider === provider);
                  if (!pModels.length) return null;
                  return (
                    <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                      {pModels.map(m => <option key={m.id} value={m.id} style={{ background: '#1a1f35' }}>{m.icon} {m.name} — {m.description}</option>)}
                    </optgroup>
                  );
                })}
              </select>

              {/* Selection Toolbar */}
              <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>Text Selection Toolbar</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Show quick AI actions when selecting text on any page</div>
                </div>
                <button onClick={() => setShowSelectionToolbar(!showSelectionToolbar)} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: showSelectionToolbar ? '#6366f1' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: '3px', left: showSelectionToolbar ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </button>
              </div>

              {/* Agent Memory */}
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Brain size={16} color="#818cf8" /> Agent Memory</h2>
              <textarea value={brain} onChange={e => setBrain(e.target.value)} rows={5} placeholder="Facts and directives the AI will always remember..."
                style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical', marginBottom: '8px', lineHeight: 1.6, fontSize: '12px' }} />
              <button onClick={clearBrain} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0', marginBottom: '24px' }}>
                <Trash2 size={12} /> Clear all memory
              </button>

              <button onClick={saveAllSettings} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: saved ? '#22c55e' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 700, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {saved ? <><CheckCircle size={18} /> Saved!</> : 'Save All Settings'}
              </button>
            </>
          )}

          {/* ─── Prompts ─── */}
          {activeTab === 'prompts' && (
            <>
              {editingPrompt ? (
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px' }}>{editingPrompt.id ? 'Edit Prompt' : 'New Prompt'}</h2>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Title</label>
                    <input type="text" value={editingPrompt.title} onChange={e => setEditingPrompt({ ...editingPrompt, title: e.target.value })} placeholder="e.g. Code Reviewer" style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={labelStyle}>Prompt Content</label>
                    <textarea value={editingPrompt.content} onChange={e => setEditingPrompt({ ...editingPrompt, content: e.target.value })} rows={6} placeholder="You are an expert..." style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handleSavePrompt} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#6366f1', color: 'white', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Save size={16} /> Save Prompt</button>
                    <button onClick={() => setEditingPrompt(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'transparent', color: '#e2e8f0', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><X size={16} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}><BookOpen size={16} color="#818cf8" /> Saved Prompts ({prompts.length})</h2>
                    <button onClick={() => setEditingPrompt({ id: '', title: '', content: '' })} style={{ background: '#6366f1', border: 'none', borderRadius: '8px', color: 'white', padding: '6px 14px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><Plus size={14} /> New Prompt</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {prompts.map(p => (
                      <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ margin: '0 0 4px', fontSize: '14px', color: '#e2e8f0', fontWeight: 600 }}>{p.title}</h3>
                          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.content}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => setEditingPrompt(p)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', padding: '6px', color: '#e2e8f0', cursor: 'pointer' }}><Edit2 size={13} /></button>
                          <button onClick={() => handleDeletePrompt(p.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '6px', color: '#f87171', cursor: 'pointer' }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                    {prompts.length === 0 && <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No saved prompts yet.</p>}
                  </div>
                </>
              )}
            </>
          )}

          {/* ─── Trackers ─── */}
          {activeTab === 'tracking' && (
            <>
              {editingJob ? (
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px' }}>{editingJob.id ? 'Edit Tracker' : 'New Tracker'}</h2>
                  {[
                    { label: 'Job Name', value: editingJob.name, setter: (v: string) => setEditingJob({ ...editingJob, name: v }), placeholder: 'e.g. Amazon Price Tracker', type: 'text' },
                    { label: 'Target URL', value: editingJob.url, setter: (v: string) => setEditingJob({ ...editingJob, url: v }), placeholder: 'https://...', type: 'url' },
                    { label: 'CSS Selector', value: editingJob.selector, setter: (v: string) => setEditingJob({ ...editingJob, selector: v }), placeholder: '.price, #price-tag', type: 'text' },
                  ].map(({ label, value, setter, placeholder, type }) => (
                    <div key={label} style={{ marginBottom: '14px' }}>
                      <label style={labelStyle}>{label}</label>
                      <input type={type} value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, fontFamily: label === 'CSS Selector' ? 'monospace' : 'inherit' }} />
                    </div>
                  ))}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={labelStyle}>Check Interval (minutes, min: 1)</label>
                    <input type="number" min={1} max={1440} value={editingJob.intervalMin} onChange={e => setEditingJob({ ...editingJob, intervalMin: Math.max(1, Number(e.target.value)) })} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handleSaveJob} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#eab308', color: '#422006', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Save size={16} /> Save Tracker</button>
                    <button onClick={() => setEditingJob(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'transparent', color: '#e2e8f0', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><X size={16} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}><Activity size={16} color="#eab308" /> Web Trackers ({jobs.length})</h2>
                    <button onClick={() => setEditingJob({ id: '', name: '', url: '', selector: '', intervalMin: 15 })} style={{ background: '#eab308', border: 'none', borderRadius: '8px', color: '#422006', padding: '6px 14px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><Plus size={14} /> New Tracker</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {jobs.map(j => (
                      <div key={j.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ margin: '0 0 3px', fontSize: '14px', color: '#e2e8f0', fontWeight: 600 }}>{j.name} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>Every {j.intervalMin}m</span></h3>
                            <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.url}</p>
                            <code style={{ display: 'inline-block', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', color: '#cbd5e1' }}>{j.selector}</code>
                            {j.lastValue !== undefined && (
                              <div style={{ marginTop: '6px', fontSize: '11px', color: '#22c55e' }}>Current: <strong>{j.lastValue}</strong></div>
                            )}
                            {j.priceHistory && j.priceHistory.length > 1 && (
                              <div style={{ marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>
                                {j.priceHistory.length} readings · First: {j.priceHistory[0]?.value}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => setEditingJob(j)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', padding: '6px', color: '#e2e8f0', cursor: 'pointer' }}><Edit2 size={13} /></button>
                            <button onClick={() => handleDeleteJob(j.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '6px', color: '#f87171', cursor: 'pointer' }}><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {jobs.length === 0 && <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No trackers configured. Monitor prices, stock levels, and more.</p>}
                  </div>
                </>
              )}
            </>
          )}

          {/* ─── Webhooks ─── */}
          {activeTab === 'webhooks' && (
            <>
              {editingWebhook ? (
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px' }}>{editingWebhook.id ? 'Edit Webhook' : 'New Webhook'}</h2>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Name</label>
                    <input type="text" value={editingWebhook.name} onChange={e => setEditingWebhook({ ...editingWebhook, name: e.target.value })} placeholder="e.g. Zapier Price Alert" style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Webhook URL</label>
                    <input type="url" value={editingWebhook.url} onChange={e => setEditingWebhook({ ...editingWebhook, url: e.target.value })} placeholder="https://hooks.zapier.com/..." style={{ ...inputStyle, fontFamily: 'monospace' }} />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={labelStyle}>Trigger Events</label>
                    {(['tracker_change', 'summarize', 'research', 'automation'] as const).map(trigger => (
                      <label key={trigger} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editingWebhook.triggers?.includes(trigger)} onChange={e => {
                          const triggers = editingWebhook.triggers || [];
                          setEditingWebhook({ ...editingWebhook, triggers: e.target.checked ? [...triggers, trigger] : triggers.filter(t => t !== trigger) });
                        }} style={{ accentColor: '#6366f1' }} />
                        <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{{ tracker_change: 'Tracker Value Changed', summarize: 'Page Summarized', research: 'Research Completed', automation: 'Automation Run' }[trigger]}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handleSaveWebhook} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#6366f1', color: 'white', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Save size={16} /> Save</button>
                    <button onClick={() => setEditingWebhook(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'transparent', color: '#e2e8f0', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><X size={16} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 4px' }}><Webhook size={16} color="#818cf8" /> Webhooks ({webhooks.length})</h2>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Connect to Zapier, Make.com, n8n, or any HTTP endpoint</p>
                    </div>
                    <button onClick={() => setEditingWebhook({ id: '', name: '', url: '', triggers: [] })} style={{ background: '#6366f1', border: 'none', borderRadius: '8px', color: 'white', padding: '6px 14px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><Plus size={14} /> New Webhook</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {webhooks.map(w => (
                      <div key={w.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '3px' }}>{w.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>{w.url}</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {(w.triggers || []).map(t => <span key={t} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', color: '#818cf8' }}>{t}</span>)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => handleTestWebhook(w.url)} title="Test webhook" style={{ background: 'rgba(34,197,94,0.1)', border: 'none', borderRadius: '6px', padding: '6px 10px', color: '#22c55e', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>Test</button>
                            <button onClick={() => setEditingWebhook(w)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', padding: '6px', color: '#e2e8f0', cursor: 'pointer' }}><Edit2 size={13} /></button>
                            <button onClick={() => handleDeleteWebhook(w.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '6px', color: '#f87171', cursor: 'pointer' }}><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {webhooks.length === 0 && <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No webhooks configured. Connect Omni-Agent to Zapier, Make.com, or n8n.</p>}
                  </div>
                </>
              )}
            </>
          )}

          {/* ─── Voice & TTS ─── */}
          {activeTab === 'voice' && (
            <>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Volume2 size={16} color="#818cf8" /> Text-to-Speech Settings</h2>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Voice ({availableVoices.length} available)</label>
                <select value={ttsVoice} onChange={e => setTtsVoice(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}>
                  <option value="">System Default</option>
                  {availableVoices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Speed: {ttsRate.toFixed(1)}x</label>
                <input type="range" min={0.5} max={2} step={0.1} value={ttsRate} onChange={e => setTtsRate(Number(e.target.value))} style={{ width: '100%', accentColor: '#6366f1' }} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Pitch: {ttsPitch.toFixed(1)}</label>
                <input type="range" min={0.5} max={2} step={0.1} value={ttsPitch} onChange={e => setTtsPitch(Number(e.target.value))} style={{ width: '100%', accentColor: '#6366f1' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={previewTTS} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', background: 'rgba(99,102,241,0.2)', color: '#818cf8', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Volume2 size={16} /> Preview Voice
                </button>
                <button onClick={async () => { await saveSettings({ ttsVoice, ttsRate, ttsPitch }); setSaved(true); setTimeout(() => setSaved(false), 2000); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: saved ? '#22c55e' : '#6366f1', color: 'white', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {saved ? <><CheckCircle size={16} /> Saved!</> : <><Save size={16} /> Save</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) createRoot(container).render(<Options />);
