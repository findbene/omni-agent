let recorder: MediaRecorder | null = null;
let dataChunks: Blob[] = [];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'startRecording') {
    startRecording().then(() => sendResponse({ status: 'started' })).catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === 'stopRecording') {
    stopRecording().then((base64) => sendResponse({ status: 'stopped', base64 })).catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === 'parseDOM') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(message.html, 'text/html');
      const el = doc.querySelector(message.selector);
      const result = el ? (el.textContent || '').trim() : null;
      sendResponse({ result });
    } catch (e: any) {
      sendResponse({ error: e.message });
    }
    return false; // Sync response
  }
});

async function startRecording() {
  if (recorder && recorder.state === 'recording') {
    throw new Error('Already recording.');
  }

  // Request user microphone using standard getUserMedia
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });

  recorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
  
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      dataChunks.push(event.data);
    }
  };

  recorder.onstop = () => {
    mediaStream.getTracks().forEach((track) => track.stop());
  };

  recorder.start();
}

async function stopRecording(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!recorder || recorder.state !== 'recording') {
      reject(new Error('Recorder is not active.'));
      return;
    }

    recorder.onstop = () => {
      const blob = new Blob(dataChunks, { type: 'audio/webm' });
      dataChunks = []; // clear buffer

      // Convert Blob to Base64 for the Gemini Payload
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // The dataUrl is "data:audio/webm;base64,....", we only want the actual base64 string
        const base64Part = dataUrl.split(',')[1] || dataUrl;
        resolve(base64Part);
      };
      reader.readAsDataURL(blob);
    };

    recorder.stop();
  });
}
