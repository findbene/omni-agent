/**
 * IndexedDB wrapper for Omni-Agent chat persistence and knowledge base.
 * Keeps full conversation history and saved AI knowledge items.
 */

const DB_NAME = 'omni-agent-db';
const DB_VERSION = 1;

export interface Conversation {
  id: string;
  domain: string;
  pageTitle: string;
  pageUrl: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  action?: string;
}

export interface KnowledgeItem {
  id: string;
  content: string;
  summary: string; // First 150 chars
  url: string;
  pageTitle: string;
  tags: string[];
  savedAt: number;
  type: 'note' | 'clip' | 'research';
  pinned: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // Conversations store
      if (!db.objectStoreNames.contains('conversations')) {
        const store = db.createObjectStore('conversations', { keyPath: 'id' });
        store.createIndex('domain', 'domain', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      // Messages store
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        store.createIndex('conversationId', 'conversationId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      // Knowledge base store
      if (!db.objectStoreNames.contains('knowledge')) {
        const store = db.createObjectStore('knowledge', { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function txPut(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function txDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function txGetAllByIndex<T>(db: IDBDatabase, store: string, index: string, value: IDBValidKey): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const idx = tx.objectStore(store).index(index);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function txGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ── Conversations ──

export async function getOrCreateConversation(domain: string, pageTitle: string, pageUrl: string): Promise<Conversation> {
  const db = await openDB();
  const all = await txGetAllByIndex<Conversation>(db, 'conversations', 'domain', domain);
  // Return most recent conversation for this domain if it exists and is < 24h old
  const recent = all.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (recent && Date.now() - recent.updatedAt < 24 * 60 * 60 * 1000) {
    db.close();
    return recent;
  }
  // Create new conversation
  const conv: Conversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    domain,
    pageTitle,
    pageUrl,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
  };
  await txPut(db, 'conversations', conv);
  await pruneOldConversations(db);
  db.close();
  return conv;
}

export async function createNewConversation(domain: string, pageTitle: string, pageUrl: string): Promise<Conversation> {
  const db = await openDB();
  const conv: Conversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    domain,
    pageTitle,
    pageUrl,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
  };
  await txPut(db, 'conversations', conv);
  db.close();
  return conv;
}

export async function getConversationMessages(conversationId: string): Promise<StoredMessage[]> {
  const db = await openDB();
  const msgs = await txGetAllByIndex<StoredMessage>(db, 'messages', 'conversationId', conversationId);
  db.close();
  return msgs.sort((a, b) => a.timestamp - b.timestamp);
}

export async function appendMessage(conversationId: string, role: 'user' | 'ai', content: string, action?: string): Promise<StoredMessage> {
  const db = await openDB();
  const msg: StoredMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    conversationId,
    role,
    content,
    timestamp: Date.now(),
    action,
  };
  await txPut(db, 'messages', msg);
  // Update conversation metadata
  const conv = await txGet<Conversation>(db, 'conversations', conversationId);
  if (conv) {
    conv.updatedAt = Date.now();
    conv.messageCount = (conv.messageCount || 0) + 1;
    await txPut(db, 'conversations', conv);
  }
  db.close();
  return msg;
}

export async function getAllConversations(): Promise<Conversation[]> {
  const db = await openDB();
  const all = await txGetAll<Conversation>(db, 'conversations');
  db.close();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const db = await openDB();
  await txDelete(db, 'conversations', conversationId);
  // Delete all messages in that conversation
  const msgs = await txGetAllByIndex<StoredMessage>(db, 'messages', 'conversationId', conversationId);
  const tx = db.transaction('messages', 'readwrite');
  for (const msg of msgs) {
    tx.objectStore('messages').delete(msg.id);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function pruneOldConversations(db: IDBDatabase): Promise<void> {
  const all = await txGetAll<Conversation>(db, 'conversations');
  if (all.length <= 50) return;
  const sorted = all.sort((a, b) => b.updatedAt - a.updatedAt);
  const toDelete = sorted.slice(50);
  const tx = db.transaction(['conversations', 'messages'], 'readwrite');
  for (const conv of toDelete) {
    tx.objectStore('conversations').delete(conv.id);
  }
  // Prune their messages too
  for (const conv of toDelete) {
    const msgs = await txGetAllByIndex<StoredMessage>(db, 'messages', 'conversationId', conv.id);
    for (const msg of msgs) {
      tx.objectStore('messages').delete(msg.id);
    }
  }
}

// ── Knowledge Base ──

export async function saveKnowledgeItem(item: Omit<KnowledgeItem, 'id' | 'savedAt'>): Promise<KnowledgeItem> {
  const db = await openDB();
  const full: KnowledgeItem = {
    ...item,
    id: `kb_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    savedAt: Date.now(),
  };
  await txPut(db, 'knowledge', full);
  db.close();
  return full;
}

export async function getAllKnowledgeItems(): Promise<KnowledgeItem[]> {
  const db = await openDB();
  const all = await txGetAll<KnowledgeItem>(db, 'knowledge');
  db.close();
  return all.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.savedAt - a.savedAt;
  });
}

export async function updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): Promise<void> {
  const db = await openDB();
  const item = await txGet<KnowledgeItem>(db, 'knowledge', id);
  if (item) {
    await txPut(db, 'knowledge', { ...item, ...updates });
  }
  db.close();
}

export async function deleteKnowledgeItem(id: string): Promise<void> {
  const db = await openDB();
  await txDelete(db, 'knowledge', id);
  db.close();
}

export async function searchKnowledgeItems(query: string): Promise<KnowledgeItem[]> {
  const all = await getAllKnowledgeItems();
  const q = query.toLowerCase();
  return all.filter(item =>
    item.content.toLowerCase().includes(q) ||
    item.summary.toLowerCase().includes(q) ||
    item.tags.some(t => t.toLowerCase().includes(q)) ||
    item.pageTitle.toLowerCase().includes(q)
  );
}

export async function exportKnowledgeBase(): Promise<string> {
  const items = await getAllKnowledgeItems();
  const lines: string[] = ['# Omni-Agent Knowledge Base Export\n'];
  const byTag = new Map<string, KnowledgeItem[]>();

  for (const item of items) {
    const tags = item.tags.length ? item.tags : ['Uncategorized'];
    for (const tag of tags) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(item);
    }
  }

  for (const [tag, tagItems] of byTag) {
    lines.push(`## ${tag}\n`);
    for (const item of tagItems) {
      lines.push(`### ${item.pageTitle}`);
      lines.push(`_Saved: ${new Date(item.savedAt).toLocaleDateString()} · [${item.url}](${item.url})_\n`);
      lines.push(item.content);
      lines.push('\n---\n');
    }
  }

  return lines.join('\n');
}
