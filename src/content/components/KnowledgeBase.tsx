/**
 * Knowledge Base panel — shows saved AI responses, clips, and research reports.
 * Allows searching, tagging, pinning, and exporting.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Star, Search, Tag, Trash2, Download, Pin, PinOff, BookOpen, FileText, Globe } from 'lucide-react';
import { KnowledgeItem, getAllKnowledgeItems, deleteKnowledgeItem, updateKnowledgeItem, exportKnowledgeBase, searchKnowledgeItems } from '../../lib/db';
import { downloadAsMarkdown } from '../../lib/export';

interface KnowledgePanelProps {
  onClose: () => void;
}

const TYPE_ICONS = {
  note: Star,
  clip: FileText,
  research: Globe,
};

export default function KnowledgePanel({ onClose }: KnowledgePanelProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const results = searchQuery
        ? await searchKnowledgeItems(searchQuery)
        : await getAllKnowledgeItems();
      setItems(results);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleDelete = async (id: string) => {
    await deleteKnowledgeItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleTogglePin = async (item: KnowledgeItem) => {
    await updateKnowledgeItem(item.id, { pinned: !item.pinned });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, pinned: !i.pinned } : i));
  };

  const handleAddTag = async (item: KnowledgeItem) => {
    if (!newTag.trim()) return;
    const tags = [...new Set([...item.tags, newTag.trim()])];
    await updateKnowledgeItem(item.id, { tags });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, tags } : i));
    setNewTag('');
    setEditingTags(null);
  };

  const handleRemoveTag = async (item: KnowledgeItem, tag: string) => {
    const tags = item.tags.filter(t => t !== tag);
    await updateKnowledgeItem(item.id, { tags });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, tags } : i));
  };

  const handleExport = async () => {
    const md = await exportKnowledgeBase();
    downloadAsMarkdown(md, 'omni-knowledge-base.md');
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(10,14,26,0.98)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', fontWeight: 700, fontSize: '14px' }}>
          <BookOpen size={18} /> Knowledge Base
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleExport} title="Export as Markdown" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Download size={13} /> Export
          </button>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search knowledge base..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 8px 8px 32px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: '#e2e8f0',
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '24px', fontSize: '13px' }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '24px', fontSize: '13px' }}>
            {searchQuery ? 'No results found.' : 'No saved items yet. Click ★ on any AI message to save it.'}
          </div>
        ) : (
          items.map(item => {
            const TypeIcon = TYPE_ICONS[item.type] || Star;
            return (
              <div key={item.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${item.pinned ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '10px',
                padding: '12px',
              }}>
                {/* Item header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <TypeIcon size={12} style={{ color: '#818cf8', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.pageTitle || item.url}
                      </span>
                      {item.pinned && <Pin size={10} style={{ color: '#fbbf24', flexShrink: 0 }} />}
                    </div>
                    <div style={{ fontSize: '10px', color: '#475569' }}>
                      {new Date(item.savedAt).toLocaleDateString()} · {item.url.replace(/^https?:\/\//, '').split('/')[0]}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                    <button onClick={() => handleTogglePin(item)} title={item.pinned ? 'Unpin' : 'Pin'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.pinned ? '#fbbf24' : '#475569', padding: '3px', display: 'flex' }}>
                      {item.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                    <button onClick={() => setEditingTags(editingTags === item.id ? null : item.id)} title="Edit tags" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '3px', display: 'flex' }}>
                      <Tag size={13} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '3px', display: 'flex' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Content preview */}
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {item.summary}
                </div>

                {/* Tags */}
                {(item.tags.length > 0 || editingTags === item.id) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {item.tags.map(tag => (
                      <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', padding: '2px 7px', fontSize: '10px', color: '#818cf8', fontWeight: 600 }}>
                        {tag}
                        {editingTags === item.id && (
                          <button onClick={() => handleRemoveTag(item, tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', padding: 0, fontSize: '12px', lineHeight: 1 }}>×</button>
                        )}
                      </span>
                    ))}
                    {editingTags === item.id && (
                      <input
                        type="text"
                        placeholder="Add tag..."
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTag(item); }}
                        autoFocus
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', color: '#e2e8f0', outline: 'none', width: '80px' }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
