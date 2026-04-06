/**
 * Omni-Agent Background Service Worker
 * Central nervous system — handles AI streaming, memory, recording, and keyboard shortcuts.
 */
import { GoogleGenAI, Type } from '@google/genai';

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

// ─── Build Gemini Contents from History ───
function buildContents(history: { role: string; content: string }[], pageContent: string, userPrompt: string) {
  const contextPrompt = pageContent
    ? `Context from the current webpage:\n\n${pageContent}\n\n---\nUser: ${userPrompt}`
    : userPrompt;

  if (!history || history.length === 0) {
    return contextPrompt;
  }

  const contents = history.map(msg => ({
    role: msg.role === 'ai' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  // Replace last user message with the full contextual prompt
  if (contents.length > 0) {
    contents[contents.length - 1].parts[0].text = contextPrompt;
  }

  return contents;
}

// ─── Port-Based Streaming Handler ───
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'omni-stream') return;

  port.onMessage.addListener(async (request) => {
    try {
      const data = await chrome.storage.local.get(['geminiApiKey', 'omniAgentBrain', 'selectedModel']);

      if (!data.geminiApiKey) {
        port.postMessage({ type: 'error', error: 'API Key not found. Please set it in the Options page (right-click extension icon → Options).' });
        return;
      }

      const ai = new GoogleGenAI({ apiKey: data.geminiApiKey });
      const model = data.selectedModel || 'gemini-2.5-flash';
      const systemInstruction = buildSystemInstruction(data.omniAgentBrain || '', request.isYouTube || false);

      // Build the prompt based on action type
      let userPrompt = request.prompt || '';
      if (request.action === 'SUMMARIZE_PAGE') {
        userPrompt = 'Summarize the following web page content precisely. Extract key takeaways and ensure no critical information is lost.';
      } else if (request.action === 'EXTRACT_DATA') {
        userPrompt = 'Analyze the following webpage content. Identify any tabular data, lists, or structured information, and extract it cleanly as markdown tables or JSON. If no distinct structured data exists, reply "No distinct tabular or list data found."';
      } else if (request.action === 'DRAFT_REPLY') {
        userPrompt = 'Read the following content which appears to be an email, forum post, article, or message. Draft a polite, professional, and relevant reply focusing on its main topic.';
      } else if (request.action === 'TRANSLATE') {
        userPrompt = `Translate the following webpage content into ${request.targetLang || 'Spanish'}. Preserve formatting and structure.`;
      } else if (request.action === 'EXPLAIN_CODE') {
        userPrompt = 'Explain the code found on this page. Break down what it does, how it works, and highlight any important patterns or potential issues.';
      } else if (request.action === 'REWRITE') {
        userPrompt = `Rewrite the main content of this page in a ${request.tone || 'professional'} tone. Preserve the core meaning but improve clarity and style.`;
      }

      const contents = buildContents(request.history || [], request.content || '', userPrompt);

      // Determine if we need function calling (only for custom prompts)
      const tools = request.action === 'CUSTOM_PROMPT'
        ? [{ functionDeclarations: [MEMORY_TOOL] }]
        : undefined;

      const response = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
          ...(tools ? { tools } : {})
        }
      });

      for await (const chunk of response) {
        // Handle function calls (memory updates)
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          const call = chunk.functionCalls[0];
          if (call.name === 'update_core_memory' && call.args) {
            const args = call.args as Record<string, any>;
            const newFact = args.fact_or_directive;
            const currentBrain = data.omniAgentBrain ? `${data.omniAgentBrain}\n- ${newFact}` : `- ${newFact}`;
            await chrome.storage.local.set({ omniAgentBrain: currentBrain });
            port.postMessage({ type: 'chunk', text: `🧠 **Memory Updated!** I will permanently remember: "${newFact}"` });
          }
        } else if (chunk.text) {
          port.postMessage({ type: 'chunk', text: chunk.text });
        }
      }

      port.postMessage({ type: 'done' });
    } catch (err: any) {
      port.postMessage({ type: 'error', error: String(err) });
    }
  });
});

// ─── Audio Recording (Legacy sendMessage for compatibility) ───
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'TOGGLE_SIDEBAR') return; // handled by content script

  if (request.type === 'START_RECORDING') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const targetTabId = tabs[0]?.id;
      if (!targetTabId) { sendResponse({ error: 'No active tab found' }); return; }

      try {
        const streamId = await new Promise<string>((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId({ targetTabId }, (id) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(id);
          });
        });

        const hasOffscreen = await chrome.offscreen.hasDocument();
        if (!hasOffscreen) {
          await chrome.offscreen.createDocument({
            url: 'src/offscreen/offscreen.html',
            reasons: [chrome.offscreen.Reason.USER_MEDIA],
            justification: 'Recording tab audio for AI transcription'
          });
        }

        chrome.runtime.sendMessage({ target: 'offscreen', type: 'startRecording', streamId }, (res) => {
          sendResponse(res);
        });
      } catch (e: any) {
        sendResponse({ error: String(e) });
      }
    });
    return true;
  }

  if (request.type === 'STOP_RECORDING') {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'stopRecording' }, async (response) => {
      if (response?.base64) {
        try {
          const data = await chrome.storage.local.get(['geminiApiKey']);
          if (!data.geminiApiKey) throw new Error('API Key not set');

          const ai = new GoogleGenAI({ apiKey: data.geminiApiKey });
          const geminiRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
              role: 'user',
              parts: [
                { text: 'Listen to the following audio recording. If there is talking, provide a clean, well-structured transcript. If there is no talking, describe the sounds/music.' },
                { inlineData: { data: response.base64, mimeType: 'audio/webm' } }
              ]
            }]
          });
          sendResponse({ data: geminiRes.text });
          chrome.offscreen.closeDocument();
        } catch (e: any) {
          sendResponse({ error: String(e) });
          chrome.offscreen.closeDocument();
        }
      } else {
        sendResponse({ error: response?.error || 'Failed to finalize audio buffer' });
        chrome.offscreen.closeDocument();
      }
    });
    return true;
  }
});

// ─── Extension Icon Click → Toggle Sidebar ───
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
  }
});

// ─── Install Handler ───
chrome.runtime.onInstalled.addListener(() => {
  console.log('Omni-Agent v2.0.0 installed.');
});
