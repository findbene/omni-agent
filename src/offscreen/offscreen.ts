let recorder: MediaRecorder | null = null;
let dataChunks: Blob[] = [];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'startRecording') {
    startRecording(message.streamId).then(() => sendResponse({ status: 'started' })).catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === 'stopRecording') {
    stopRecording().then((base64) => sendResponse({ status: 'stopped', base64 })).catch((e) => sendResponse({ error: e.message }));
    return true;
  }
});

async function startRecording(streamId: string) {
  if (recorder && recorder.state === 'recording') {
    throw new Error('Already recording.');
  }

  // Request the audio stream using the TabCapture Stream ID
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    } as any,
    video: false
  });

  // VERY IMPORTANT: Route the captured audio to the computer speakers so the user can still hear the video!
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(mediaStream);
  source.connect(audioContext.destination);

  recorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
  
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      dataChunks.push(event.data);
    }
  };

  recorder.onstop = () => {
    mediaStream.getTracks().forEach((track) => track.stop());
    audioContext.close();
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
