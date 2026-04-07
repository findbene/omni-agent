/**
 * Omni-Agent Background Service Worker
 * Central nervous system — handles AI streaming, memory, research fetching,
 * screenshot capture, context menus, keyboard shortcuts, and web tracking.
 */
import { GoogleGenAI, Type } from '@google/genai';
import { getModel, getApiKeyForProvider } from './lib/providers';

// ─── Memory Tool Declaration ───
const MEMORY_TOOL = {
  name: 'update_core_memory',
  description: 'Call this tool INSTEAD of replying when the user asks you to remember a fact, or gives you a persistent instruction for future conversations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      fact_or_directive: {
        type: Type.STRING,
        description: 'The fact or directive to permanently remember.'
      }
    },
    required: ['fact_or_directive']
  }
};

// ─── System Instruction Builder ───
function buildSystemInstruction(brain: string, isYouTube: boolean): string {
  let instruction = 'You are Omni-Agent, a world-class AI assistant embedded inside a Chrome browser extension. You analyze web pages, generate insights, and help the user be productive. Respond in clean, well-structured Markdown. Use headings, bullet points, and code blocks when appropriate.';
  if (isYouTube) {
    instruction += '\nThe user is currently on a YouTube video page. If transcript or video context is provided, use it to answer questions about the video content.';
  }
  if (brain) {
    instruction += `\n\nThe user has given you these permanent guidelines/facts to always abide by:\n${brain}`;
  }
  return instruction;
}

// ─── Message History Builders ───
function buildContentsForGemini(history: { role: string; content: string }[], pageContent: string, userPrompt: string) {
  const contextPrompt = pageContent ? `Context from the current webpage:\n\n${pageContent}\n\n---\nUser: ${userPrompt}` : userPrompt;
  if (!history || history.length === 0) return contextPrompt;
  const contents = history.map(msg => ({ role: msg.role === 'ai' ? 'model' : 'user', parts: [{ text: msg.content }] }));
  if (contents.length > 0) contents[contents.length - 1].parts[0].text = contextPrompt;
  return contents;
}

function buildMessagesForOpenAI(history: { role: string; content: string }[], pageContent: string, userPrompt: string, system: string, imageBase64?: string, imageMime?: string) {
  const messages: { role: string; content: unknown }[] = [{ role: 'system', content: system }];
  const contextPrompt = pageContent ? `Context from the current webpage:\n\n${pageContent}\n\n---\nUser: ${userPrompt}` : userPrompt;

  let userContent: unknown = contextPrompt;
  if (imageBase64) {
    userContent = [
      { type: 'text', text: contextPrompt },
      { type: 'image_url', image_url: { url: `data:${imageMime || 'image/png'};base64,${imageBase64}` } },
    ];
  }

  if (!history || history.length === 0) {
    messages.push({ role: 'user', content: userContent });
    return messages;
  }
  const histMsg: { role: string; content: unknown }[] = history.map(msg => ({ role: msg.role === 'ai' ? 'assistant' : 'user', content: msg.content }));
  if (histMsg.length > 0) histMsg[histMsg.length - 1].content = userContent;
  return messages.concat(histMsg);
}

function buildMessagesForAnthropic(history: { role: string; content: string }[], pageContent: string, userPrompt: string, imageBase64?: string, imageMime?: string) {
  const contextPrompt = pageContent ? `Context from the current webpage:\n\n${pageContent}\n\n---\nUser: ${userPrompt}` : userPrompt;

  let userContent: unknown = contextPrompt;
  if (imageBase64) {
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: imageMime || 'image/png', data: imageBase64 } },
      { type: 'text', text: contextPrompt },
    ];
  }

  if (!history || history.length === 0) {
    return [{ role: 'user', content: userContent }];
  }
  const histMsg: { role: string; content: unknown }[] = history.map(msg => ({ role: msg.role === 'ai' ? 'assistant' : 'user', content: msg.content }));
  if (histMsg.length > 0) histMsg[histMsg.length - 1].content = userContent;
  return histMsg;
}

// ─── Streaming Engines ───

async function streamOpenAI(port: chrome.runtime.Port, model: string, apiKey: string, messages: unknown[], baseUrl = 'https://api.openai.com/v1') {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 4096 })
  });
  if (!res.ok) throw new Error(`API Error (${model}): ${await res.text()}`);
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No response stream');
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const content = JSON.parse(line.substring(6)).choices?.[0]?.delta?.content;
          if (content) port.postMessage({ type: 'chunk', text: content });
        } catch { /* ignore parse error */ }
      }
    }
  }
}

async function streamAnthropic(port: chrome.runtime.Port, model: string, apiKey: string, system: string, messages: unknown[]) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model, system, messages, max_tokens: 8096, stream: true })
  });
  if (!res.ok) throw new Error(`Anthropic Error: ${await res.text()}`);
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No response stream');
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.type === 'content_block_delta' && data.delta?.text) {
            port.postMessage({ type: 'chunk', text: data.delta.text });
          }
        } catch { /* ignore */ }
      }
    }
  }
}

async function streamGemini(port: chrome.runtime.Port, model: string, apiKey: string, systemInstruction: string, contents: unknown, data: Record<string, unknown>, requestAction: string, imageBase64?: string, imageMime?: string) {
  const ai = new GoogleGenAI({ apiKey });
  const tools = requestAction === 'CUSTOM_PROMPT' ? [{ functionDeclarations: [MEMORY_TOOL] }] : undefined;

  let finalContents = contents;
  // Attach image to the last user turn if provided
  if (imageBase64 && Array.isArray(contents)) {
    const copy = [...(contents as unknown[])];
    const last = copy[copy.length - 1] as { role: string; parts: unknown[] };
    if (last && last.role === 'user') {
      last.parts = [...last.parts, { inlineData: { data: imageBase64, mimeType: imageMime || 'image/png' } }];
    }
    finalContents = copy;
  } else if (imageBase64 && typeof contents === 'string') {
    finalContents = [{ role: 'user', parts: [{ text: contents }, { inlineData: { data: imageBase64, mimeType: imageMime || 'image/png' } }] }];
  }

  const response = await ai.models.generateContentStream({
    model,
    contents: finalContents as Parameters<typeof ai.models.generateContentStream>[0]['contents'],
    config: { systemInstruction, ...(tools ? { tools } : {}) }
  });

  for await (const chunk of response) {
    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
      const call = chunk.functionCalls[0];
      if (call.name === 'update_core_memory' && call.args) {
        const args = call.args as Record<string, unknown>;
        const newFact = String(args.fact_or_directive || '');
        const currentBrain = data.omniAgentBrain ? `${data.omniAgentBrain}\n- ${newFact}` : `- ${newFact}`;
        await chrome.storage.local.set({ omniAgentBrain: currentBrain });
        port.postMessage({ type: 'chunk', text: `🧠 **Memory Updated!** I will permanently remember: "${newFact}"` });
        port.postMessage({ type: 'memory_updated', brain: currentBrain });
      }
    } else if (chunk.text) {
      port.postMessage({ type: 'chunk', text: chunk.text });
    }
  }
}

// ─── Prompt Builder for Actions ───
function buildActionPrompt(action: string, userPrompt: string, extra?: Record<string, string>): string {
  switch (action) {
    case 'SUMMARIZE_PAGE':
      return 'Summarize this web page precisely. Extract key takeaways as bullet points, include the most important facts and any key statistics or quotes. Format with a brief intro sentence, then bullet points.';
    case 'EXTRACT_DATA':
      return 'Analyze this webpage. Extract all tabular data, lists, prices, dates, and structured information. Format as markdown tables where possible, or clean JSON. If no structured data exists, reply "No structured data found."';
    case 'DRAFT_REPLY':
      return 'Read this content (email, forum post, article, or message). Draft a polite, professional, and relevant reply. Match the formality level of the original.';
    case 'TRANSLATE':
      return `Translate the following content into ${extra?.targetLang || (navigator.language.split('-')[0] !== 'en' ? navigator.language : 'Spanish')}. Preserve all formatting and structure.`;
    case 'EXPLAIN_CODE':
      return 'Explain the code on this page. Cover: what it does, how it works, key patterns used, potential issues, and suggestions for improvement. Use clear headings and code examples.';
    case 'REWRITE':
      return `Rewrite the main content in a ${extra?.tone || 'professional'} tone. Preserve core meaning but improve clarity, flow, and style. Do not add new information.`;
    case 'FIX_GRAMMAR':
      return 'Fix all grammar, spelling, and punctuation errors in the following text. Return the corrected version, then briefly list the main changes made.';
    case 'BULLET_POINTS':
      return 'Convert the following content into a concise, well-organized bullet point list. Group related points under sub-headings. Prioritize the most important information.';
    case 'GENERATE_QUIZ':
      return 'Create a 5-question multiple choice quiz based on the content below. For each question, provide 4 options (A-D) and mark the correct answer. Make questions that test understanding, not just memorization.';
    case 'FIND_PRICES':
      return 'Extract all prices, costs, fees, and monetary values from this page. Format as a table with columns: Item, Price, Currency, Notes. Include any discounts, ranges, or conditional pricing.';
    case 'AUTOMATE_PAGE':
      return `Based on the provided page context, generate a JSON array of DOM actions to fulfill this intent: "${userPrompt.replace('Automate:', '').trim() || 'Interact with the main content on this page'}".
Format strictly as a markdown JSON block. Schema: [{"action":"click"|"type"|"navigate"|"wait"|"extract"|"scroll"|"hover"|"select"|"keyboard", "selector":"#id", "value":"text", "url":"https://...", "ms":500, "y":0, "key":"Enter", "modifiers":["ctrl"], "continueOnError":false}].
Always add a 500ms wait after clicks. Use robust CSS selectors (prefer id, data-*, aria-* over positional selectors).`;
    default:
      return userPrompt;
  }
}

// ─── Port-Based Streaming Handler ───
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'omni-stream') return;

  port.onMessage.addListener(async (request) => {
    try {
      const data = await chrome.storage.local.get([
        'geminiApiKey', 'openaiApiKey', 'anthropicApiKey',
        'deepseekApiKey', 'groqApiKey', 'ollamaUrl',
        'omniAgentBrain', 'selectedModel'
      ]);
      const modelId = request.model || data.selectedModel || 'gemini-2.5-flash';
      const modelDef = getModel(modelId);

      if (!modelDef) throw new Error('Unknown model selected. Please choose a different model in settings.');

      const systemInstruction = buildSystemInstruction(
        String(data.omniAgentBrain || ''),
        Boolean(request.isYouTube)
      );

      const userPrompt = request.action && request.action !== 'CUSTOM_PROMPT'
        ? buildActionPrompt(request.action, request.prompt || '', request)
        : (request.prompt || '');

      const apiKey = getApiKeyForProvider(modelDef.provider, data as Record<string, string>);
      if (!apiKey && modelDef.provider !== 'ollama') {
        throw new Error(`${modelDef.provider} API Key missing. Please add it in Options → Settings.`);
      }

      const imageBase64: string | undefined = request.imageBase64;
      const imageMime: string | undefined = request.imageMime;

      if (modelDef.provider === 'google') {
        const contents = buildContentsForGemini(request.history, request.content, userPrompt);
        await streamGemini(port, modelId, apiKey, systemInstruction, contents, data as Record<string, unknown>, request.action, imageBase64, imageMime);
      } else if (modelDef.provider === 'openai' || modelDef.provider === 'deepseek' || modelDef.provider === 'groq' || modelDef.provider === 'ollama') {
        const baseUrl = modelDef.baseUrl || (modelDef.provider === 'ollama' ? (String(data.ollamaUrl || 'http://localhost:11434') + '/v1') : undefined);
        const actualModelId = modelId.startsWith('ollama/') ? modelId.replace('ollama/', '') : modelId;
        const msgs = buildMessagesForOpenAI(request.history, request.content, userPrompt, systemInstruction, imageBase64, imageMime);
        await streamOpenAI(port, actualModelId, apiKey, msgs, baseUrl);
      } else if (modelDef.provider === 'anthropic') {
        const msgs = buildMessagesForAnthropic(request.history, request.content, userPrompt, imageBase64, imageMime);
        await streamAnthropic(port, modelId, apiKey, systemInstruction, msgs);
      }

      port.postMessage({ type: 'done' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      port.postMessage({ type: 'error', error: msg });
    }
  });
});

// ─── Message Handler (non-streaming) ───
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // ── Audio Transcription ──
  if (request.type === 'TRANSCRIBE_AUDIO') {
    (async () => {
      try {
        const data = await chrome.storage.local.get(['geminiApiKey']);
        if (!data.geminiApiKey) throw new Error('Gemini API Key required for audio transcription. Add it in Options.');
        const ai = new GoogleGenAI({ apiKey: data.geminiApiKey });
        const geminiRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{
            role: 'user',
            parts: [
              { text: 'Listen to the following audio recording and return a highly accurate textual transcription. Output only the transcribed text, no commentary.' },
              { inlineData: { data: request.base64, mimeType: request.mimeType || 'audio/webm' } }
            ]
          }]
        });
        sendResponse({ text: geminiRes.text });
      } catch (e: unknown) {
        sendResponse({ error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return true; // Keep channel open for async
  }

  // ── Video Transcription ──
  if (request.type === 'TRANSCRIBE_VIDEO') {
    (async () => {
      try {
        const data = await chrome.storage.local.get(['geminiApiKey', 'openaiApiKey']);
        const { base64, mimeType, durationSec } = request;
        const prompt = `You are a professional transcription service. The following audio is ${durationSec} seconds of video content. Produce a clean, accurate transcript. Include speaker labels (Speaker 1, Speaker 2, etc.) if multiple distinct speakers are detected. Format naturally with paragraphs. Output only the transcript text — no preamble, no commentary.`;

        // Try Gemini first (supports audio inline natively)
        if (data.geminiApiKey) {
          const ai = new GoogleGenAI({ apiKey: data.geminiApiKey });
          const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { data: base64, mimeType: mimeType || 'audio/webm' } },
              ]
            }]
          });
          sendResponse({ transcript: res.text, source: 'gemini' });
          return;
        }

        // Fall back to OpenAI Whisper
        if (data.openaiApiKey) {
          // Reconstruct blob from base64 and send as multipart form
          const byteString = atob(base64);
          const byteArray = new Uint8Array(byteString.length);
          for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
          const audioBlob = new Blob([byteArray], { type: mimeType || 'audio/webm' });

          const form = new FormData();
          form.append('file', audioBlob, 'audio.webm');
          form.append('model', 'whisper-1');
          form.append('response_format', 'text');

          const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${data.openaiApiKey}` },
            body: form,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as { error?: { message?: string } }).error?.message || `Whisper API error ${res.status}`);
          }
          const transcript = await res.text();
          sendResponse({ transcript, source: 'whisper' });
          return;
        }

        throw new Error('No API key configured. Add a Gemini or OpenAI key in Options to use video transcription.');
      } catch (e: unknown) {
        sendResponse({ error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return true;
  }

  // ── Screenshot Capture ──
  if (request.type === 'CAPTURE_SCREENSHOT') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab found');
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png', quality: 90 });
        sendResponse({ dataUrl });
      } catch (e: unknown) {
        sendResponse({ error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return true;
  }

  // ── Research Fetch (CORS proxy via background) ──
  if (request.type === 'RESEARCH_FETCH') {
    (async () => {
      try {
        const res = await fetch(request.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        sendResponse({ html });
      } catch (e: unknown) {
        sendResponse({ error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return true;
  }

  // ── Context Menu Action → Content Script ──
  if (request.type === 'CONTEXT_MENU_ACTION') {
    // Forward to the active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SIDEBAR_ACTION',
          action: request.action,
          selectedText: request.selectedText,
          openSidebar: true,
        });
      }
    });
    return false;
  }

  // ── Webhook Dispatch ──
  if (request.type === 'FIRE_WEBHOOK') {
    (async () => {
      try {
        await fetch(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.payload),
          signal: AbortSignal.timeout(10000),
        });
        sendResponse({ ok: true });
      } catch (e: unknown) {
        sendResponse({ error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return true;
  }
});

// ─── Extension Lifecycle ───
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Omni-Agent v3.0.0 installed.');
  chrome.alarms.create('omni-tracker', { periodInMinutes: 1 });
  setupContextMenus();
});

// Recreate context menus on startup (they don't persist across restarts)
chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

// ─── Context Menus ───
function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'omni-parent',
      title: 'Omni-Agent',
      contexts: ['all'],
    });
    chrome.contextMenus.create({
      id: 'omni-explain',
      parentId: 'omni-parent',
      title: 'Explain selection',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'omni-translate',
      parentId: 'omni-parent',
      title: 'Translate selection',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'omni-rewrite',
      parentId: 'omni-parent',
      title: 'Rewrite selection',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'omni-grammar',
      parentId: 'omni-parent',
      title: 'Fix grammar',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'omni-summarize-page',
      parentId: 'omni-parent',
      title: 'Summarize this page',
      contexts: ['page', 'frame'],
    });
    chrome.contextMenus.create({
      id: 'omni-research',
      parentId: 'omni-parent',
      title: 'Research this topic',
      contexts: ['selection', 'page'],
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const actionMap: Record<string, string> = {
    'omni-explain': 'EXPLAIN_SELECTION',
    'omni-translate': 'TRANSLATE_SELECTION',
    'omni-rewrite': 'REWRITE_SELECTION',
    'omni-grammar': 'FIX_GRAMMAR',
    'omni-summarize-page': 'SUMMARIZE_PAGE',
    'omni-research': 'DEEP_RESEARCH',
  };
  const action = actionMap[info.menuItemId as string];
  if (action) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SIDEBAR_ACTION',
      action,
      selectedText: info.selectionText || '',
      openSidebar: true,
    });
  }
});

// ─── Website Monitoring Loop ───
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'omni-tracker') return;

  const data = await chrome.storage.local.get(['trackerJobs', 'webhooks']);
  if (!data.trackerJobs || data.trackerJobs.length === 0) return;

  let jobsUpdated = false;
  const now = Date.now();
  const newJobs = [...data.trackerJobs];

  for (let i = 0; i < newJobs.length; i++) {
    const job = newJobs[i];
    if (!job.lastCheck || (now - job.lastCheck >= job.intervalMin * 60 * 1000)) {
      try {
        const res = await fetch(job.url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const html = await res.text();

          const hasOffscreen = await chrome.offscreen.hasDocument();
          if (!hasOffscreen) {
            await chrome.offscreen.createDocument({
              url: 'src/offscreen/offscreen.html',
              reasons: [chrome.offscreen.Reason.DOM_PARSER],
              justification: 'Parsing DOM for Web Tracker'
            });
          }

          const response = await chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'parseDOM',
            html,
            selector: job.selector
          });

          if (response && response.result !== undefined && response.result !== null) {
            const val = String(response.result).trim();
            if (job.lastValue !== undefined && job.lastValue !== val) {
              // Show notification
              chrome.notifications.create(`tracker_${job.id}_${now}`, {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                title: `Tracker Update: ${job.name}`,
                message: `Changed from "${job.lastValue}" to "${val}"`,
              });
              // Track price history
              if (!job.priceHistory) job.priceHistory = [];
              job.priceHistory.push({ value: val, timestamp: now });
              if (job.priceHistory.length > 30) job.priceHistory = job.priceHistory.slice(-30);

              // Fire webhooks
              if (data.webhooks) {
                for (const webhook of data.webhooks) {
                  if (webhook.triggers?.includes('tracker_change') && webhook.url) {
                    fetch(webhook.url, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ trigger: 'tracker_change', job: job.name, oldValue: job.lastValue, newValue: val, url: job.url, timestamp: now }),
                    }).catch(() => { /* webhook failures are non-critical */ });
                  }
                }
              }
            }
            job.lastValue = val;
          }
        }
      } catch (e) {
        console.error(`Tracker error for "${job.name}":`, e instanceof Error ? e.message : e);
      }
      job.lastCheck = now;
      jobsUpdated = true;
    }
  }

  if (jobsUpdated) {
    await chrome.storage.local.set({ trackerJobs: newJobs });
  }
});
