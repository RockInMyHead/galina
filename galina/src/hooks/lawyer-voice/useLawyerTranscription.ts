import { useState, useRef, useEffect, useCallback } from 'react';
import { API_CONFIG } from '@/config/constants';

const API_URL = API_CONFIG.BASE_URL;

interface UseLawyerTranscriptionProps {
  token?: string | null;
  onTranscriptionComplete: (text: string, source: 'browser' | 'openai' | 'manual') => void;
  onSpeechStart?: () => void;
  onInterruption?: () => void;
  isTTSActiveRef: React.MutableRefObject<boolean>;
  onError?: (error: string) => void;
  addDebugLog?: (message: string) => void;
}

export const useLawyerTranscription = ({
  token,
  onTranscriptionComplete,
  onSpeechStart,
  onInterruption,
  isTTSActiveRef,
  onError,
  addDebugLog = console.log
}: UseLawyerTranscriptionProps) => {
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [forceOpenAI, setForceOpenAI] = useState(false);
  const [transcriptionMode, setTranscriptionMode] = useState<'browser' | 'openai'>('browser');
  const [microphoneAccessGranted, setMicrophoneAccessGranted] = useState(false);
  const [microphonePermissionStatus, setMicrophonePermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const mobileTranscriptionTimerRef = useRef<number | null>(null);

  // Refs
  const recognitionRef = useRef<any>(null);
  const recognitionActiveRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const volumeMonitorRef = useRef<number | null>(null);
  const speechTimeoutRef = useRef<number | null>(null);
  const browserRetryCountRef = useRef(0);
  const lastProcessedTextRef = useRef<string>('');

  // Constants
  const SAFARI_VOICE_DETECTION_THRESHOLD = 60;
  const SAFARI_SPEECH_CONFIRMATION_FRAMES = 3;
  const SAFARI_SPEECH_DEBOUNCE = 1000;

  // Safari Interruption State
  const [safariSpeechDetectionCount, setSafariSpeechDetectionCount] = useState(0);
  const [lastSafariSpeechTime, setLastSafariSpeechTime] = useState(0);

  // Filter out hallucinated text patterns
  const filterHallucinatedText = (text: string): string | null => {
    if (!text) return null;

    const lowerText = text.toLowerCase();

    // Common hallucinated patterns
    const hallucinationPatterns = [
      /продолжение следует/i,
      /с вами был/i,
      /до свидания/i,
      /до новых встреч/i,
      /спасибо за внимание/i,
      /конец/i,
      /закончили/i,
      /я галина/i,
      /здравствуйте, я галина/i,
    ];

    for (const pattern of hallucinationPatterns) {
      if (pattern.test(lowerText)) {
        return null;
      }
    }

    if (text.length > 150) return null;
    if (text.split(/[.!?]/).length > 3) return null;
    if (text.length < 2) return null;

    const meaninglessPatterns = [
      /^[а-я]{1}$/i,
      /^[эээ|ммм|ааа|ууу|ооо]+$/i,
      /^[а-я]{1,2}$/i,
    ];

    for (const pattern of meaninglessPatterns) {
      if (pattern.test(text)) return null;
    }

    return text;
  };

  // Browser Detection Helpers
  const isSafari = useCallback(() => {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }, []);

  const hasEchoProblems = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /chrome|chromium|edg\/|opera|brave/.test(userAgent);
  }, []);

  const isIOSDevice = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  const isAndroidDevice = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android/.test(userAgent);
  }, []);

  const isMobileDevice = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  }, []);

  // Check microphone permissions
  const checkMicrophonePermissions = useCallback(async () => {
    if (!navigator.permissions || !navigator.permissions.query) {
      console.log("[Permissions] Permissions API not available");
      return;
    }

    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log("[Permissions] Microphone permission status:", result.state);
      setMicrophonePermissionStatus(result.state);

      result.addEventListener('change', () => {
        console.log("[Permissions] Microphone permission changed to:", result.state);
        setMicrophonePermissionStatus(result.state);
      });
    } catch (error) {
      console.log("[Permissions] Could not query microphone permissions:", error);
    }
  }, []);

  // OpenAI Transcription
  const transcribeWithOpenAI = async (audioBlob: Blob): Promise<string | null> => {
    try {
      addDebugLog(`[OpenAI] Starting transcription: ${audioBlob.size} bytes`);
      setTranscriptionStatus("Отправляю аудио в OpenAI...");

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(`${API_URL}/transcribe`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const data = await response.json();
      const text = data.text?.trim();

      if (text) {
        addDebugLog(`[OpenAI] ✅ Success: "${text.substring(0, 50)}..."`);
        return text;
      }
      addDebugLog(`[OpenAI] ⚠️ Empty result`);
      return null;
    } catch (error: any) {
      addDebugLog(`[OpenAI] ❌ Failed: ${error.message}`);
      return null;
    } finally {
      setTranscriptionStatus("");
    }
  };

  // Check audio volume
  const checkAudioVolume = async (audioBlob: Blob): Promise<number> => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      let sum = 0;
      let count = 0;

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < channelData.length; i++) {
          sum += Math.abs(channelData[i]);
          count++;
        }
      }

      const averageVolume = sum / count;
      const volumePercent = averageVolume * 100;

      audioContext.close();
      return volumePercent;
    } catch (error) {
      addDebugLog(`[VolumeCheck] Error: ${error}`);
      return 0;
    }
  };

  // Media Recording
  const startMediaRecording = (stream: MediaStream) => {
    if (mediaRecorderRef.current) return;

    try {
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'];
      const supportedTypes = mimeTypes.filter(type => MediaRecorder.isTypeSupported(type));
      const selectedMimeType = supportedTypes[0];

      if (!selectedMimeType) {
        addDebugLog(`[MediaRec] ❌ No supported format`);
        return;
      }

      addDebugLog(`[MediaRec] Using format: ${selectedMimeType}`);

      const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstart = () => addDebugLog(`[MediaRec] ✅ Recording started`);
      recorder.onstop = () => addDebugLog(`[MediaRec] 🛑 Recording stopped`);
      recorder.onerror = (event) => addDebugLog(`[MediaRec] ❌ Error: ${event}`);

      recorder.start(1000);
    } catch (error: any) {
      addDebugLog(`[MediaRec] ❌ Start failed: ${error.message}`);
    }
  };

  const stopMediaRecording = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: mediaRecorderRef.current?.mimeType || 'audio/webm'
        });
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  };

  // Mobile transcription timer
  const startMobileTranscriptionTimer = useCallback(() => {
    if (mobileTranscriptionTimerRef.current) return;

    if (isTTSActiveRef.current) {
      addDebugLog(`[Mobile] TTS active - not starting timer`);
      return;
    }

    addDebugLog(`[Mobile] Starting transcription timer (3s intervals)`);

    mobileTranscriptionTimerRef.current = window.setInterval(async () => {
      if (isTTSActiveRef.current) {
        addDebugLog(`[Timer] ⏸️ TTS active - skipping`);
        return;
      }

      if (!mediaRecorderRef.current) return;

      const ios = isIOSDevice();
      const android = isAndroidDevice();

      if (!ios && !android) return;

      try {
        const blob = await stopMediaRecording();

        if (audioStreamRef.current) {
          startMediaRecording(audioStreamRef.current);
        }

        if (blob && blob.size > 5000) {
          if (isTTSActiveRef.current) return;

          const volumeLevel = await checkAudioVolume(blob);
          addDebugLog(`[Mobile] Audio volume: ${volumeLevel.toFixed(2)}%`);

          if (volumeLevel < 2.0) {
            addDebugLog(`[Mobile] ⚠️ Too quiet, skipping`);
            return;
          }

          addDebugLog(`[Mobile] ✅ Sending ${blob.size} bytes to OpenAI...`);

          const text = await transcribeWithOpenAI(blob);

          if (text && text.trim()) {
            const filteredText = filterHallucinatedText(text.trim());
            if (filteredText) {
              addDebugLog(`[Mobile] ✅ Transcribed: "${filteredText}"`);
              onTranscriptionComplete(filteredText, 'openai');
            }
          }
        }
      } catch (error) {
        addDebugLog(`[Mobile] Error: ${error}`);
        if (audioStreamRef.current && !mediaRecorderRef.current) {
          startMediaRecording(audioStreamRef.current);
        }
      }
    }, 3000);
  }, [isIOSDevice, isAndroidDevice, isTTSActiveRef, onTranscriptionComplete, token]);

  const stopMobileTranscriptionTimer = useCallback(() => {
    if (mobileTranscriptionTimerRef.current) {
      addDebugLog(`[Mobile] Stopping transcription timer`);
      clearInterval(mobileTranscriptionTimerRef.current);
      mobileTranscriptionTimerRef.current = null;
    }
  }, []);

  // Volume Monitoring
  const startVolumeMonitoring = async (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!recognitionActiveRef.current || !audioAnalyserRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        if (!hasEchoProblems()) {
          const isAssistantActive = isTTSActiveRef.current;
          const threshold = isAssistantActive ? SAFARI_VOICE_DETECTION_THRESHOLD + 15 : SAFARI_VOICE_DETECTION_THRESHOLD;
          const currentTime = Date.now();

          if (average > threshold) {
            setSafariSpeechDetectionCount(prev => {
              const newCount = prev + 1;
              if (newCount >= SAFARI_SPEECH_CONFIRMATION_FRAMES) {
                if (currentTime - lastSafariSpeechTime > SAFARI_SPEECH_DEBOUNCE) {
                  addDebugLog(`[Volume] 🎤 Voice interruption (vol: ${average.toFixed(1)})`);
                  setLastSafariSpeechTime(currentTime);
                  onInterruption?.();
                  return 0;
                }
              }
              return newCount;
            });
          } else {
            setSafariSpeechDetectionCount(0);
          }
        }
        volumeMonitorRef.current = requestAnimationFrame(checkVolume);
      };
      volumeMonitorRef.current = requestAnimationFrame(checkVolume);
    } catch (error) {
      console.warn("[Transcription] Volume monitoring failed:", error);
    }
  };

  const stopVolumeMonitoring = () => {
    if (volumeMonitorRef.current) {
      cancelAnimationFrame(volumeMonitorRef.current);
      volumeMonitorRef.current = null;
    }
    if (audioAnalyserRef.current) {
      audioAnalyserRef.current.disconnect();
      audioAnalyserRef.current = null;
    }
  };

  // Speech Recognition Setup
  const initializeRecognition = useCallback(async () => {
    console.log("[Transcription] 🚀 Starting recognition initialization...");

    await checkMicrophonePermissions();
    lastProcessedTextRef.current = '';

    const ios = isIOSDevice();
    const mobile = isMobileDevice();
    setIsIOS(ios);

    const speechRecognitionSupport = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
    const mediaDevicesSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    addDebugLog(`[API] SpeechRec: ${speechRecognitionSupport ? '✅' : '❌'} | MediaDev: ${mediaDevicesSupport ? '✅' : '❌'}`);
    addDebugLog(`[Device] iOS: ${ios} | Mobile: ${mobile}`);

    const android = isAndroidDevice();
    const shouldForceOpenAI = ios || android || !speechRecognitionSupport;

    addDebugLog(`[Strategy] ${shouldForceOpenAI ? 'OpenAI Mode' : 'Browser Mode'}`);

    setForceOpenAI(shouldForceOpenAI);

    if (shouldForceOpenAI) {
      setTranscriptionMode('openai');
    }

    // Get Microphone Stream
    try {
      const constraints = mobile ? {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 44100 },
          channelCount: { ideal: 1 }
        }
      } : { audio: true };

      addDebugLog(`[Mic] Requesting access...`);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      addDebugLog(`[Mic] ✅ Access granted`);

      audioStreamRef.current = stream;
      setMicrophoneAccessGranted(true);

      startMediaRecording(stream);
      startVolumeMonitoring(stream);

      if (ios || android) {
        addDebugLog(`[Init] Starting mobile transcription timer`);
        startMobileTranscriptionTimer();
      }

      if (shouldForceOpenAI) return;

      // Setup Browser Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "ru-RU";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        if (hasEchoProblems() && isTTSActiveRef.current) {
          console.log("[Transcription] Ignoring input during TTS");
          return;
        }

        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalTranscript += result[0].transcript;
          else interimTranscript += result[0].transcript;
        }

        if (finalTranscript.trim()) {
          const trimmedText = finalTranscript.trim();

          if (lastProcessedTextRef.current === trimmedText) {
            console.log(`[Transcription] Skipping duplicate: "${trimmedText}"`);
            return;
          }

          console.log(`[Transcription] Processing: "${trimmedText}"`);
          lastProcessedTextRef.current = trimmedText;

          if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
          browserRetryCountRef.current = 0;
          onTranscriptionComplete(trimmedText, 'browser');
        } else if (interimTranscript.trim()) {
          if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
          speechTimeoutRef.current = window.setTimeout(() => {
            if (hasEchoProblems() && isTTSActiveRef.current) return;

            const trimmedInterim = interimTranscript.trim();
            const lastProcessed = lastProcessedTextRef.current;

            if (lastProcessed && lastProcessed.includes(trimmedInterim)) return;

            console.log(`[Transcription] Processing interim: "${trimmedInterim}"`);
            onTranscriptionComplete(trimmedInterim, 'browser');
          }, 1500);
        }
      };

      recognition.onspeechstart = () => {
        addDebugLog(`[Speech] 🎤 Speech started`);
        lastProcessedTextRef.current = '';
        onSpeechStart?.();

        if (!hasEchoProblems() && isTTSActiveRef.current) {
          const currentTime = Date.now();
          if (currentTime - lastSafariSpeechTime > SAFARI_SPEECH_DEBOUNCE) {
            addDebugLog(`[Speech] 🎤 Safari voice interruption`);
            setLastSafariSpeechTime(currentTime);
            onInterruption?.();
          }
        }
      };

      recognition.onerror = async (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.error("[Transcription] Error:", event.error);

        const retryable = ['network', 'audio-capture', 'not-allowed'];
        if (retryable.includes(event.error) && browserRetryCountRef.current < 3) {
          browserRetryCountRef.current++;
          setTimeout(() => {
            if (recognitionActiveRef.current) {
              try { recognition.start(); } catch (e) { }
            }
          }, 1000 * browserRetryCountRef.current);
          return;
        }

        if (browserRetryCountRef.current >= 3) {
          addDebugLog(`[Fallback] Switching to OpenAI`);
          setTranscriptionMode('openai');

          const blob = await stopMediaRecording();
          if (blob && blob.size > 1000) {
            const text = await transcribeWithOpenAI(blob);
            if (text) {
              onTranscriptionComplete(text, 'openai');
            } else {
              onError?.("Не удалось распознать речь");
            }
          }
          setTranscriptionMode('browser');
          browserRetryCountRef.current = 0;
        }
      };

      recognition.onend = () => {
        if (recognitionActiveRef.current && !isTTSActiveRef.current) {
          try { recognition.start(); } catch (e) { }
        }
      };

      recognitionRef.current = recognition;
      recognitionActiveRef.current = true;
      recognition.start();

    } catch (error: any) {
      addDebugLog(`[Mic] ❌ Failed: ${error.name} - ${error.message}`);

      let errorMessage = "Ошибка доступа к микрофону";
      if (error.name === 'NotAllowedError') {
        errorMessage = "Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "Микрофон не найден.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Микрофон занят другим приложением.";
      }

      onError?.(errorMessage);
      setMicrophoneAccessGranted(false);
    }
  }, [token, onTranscriptionComplete, onSpeechStart, onInterruption, onError, isTTSActiveRef]);

  // Cleanup
  const cleanup = useCallback(() => {
    lastProcessedTextRef.current = '';
    recognitionActiveRef.current = false;
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (e) { }
    stopVolumeMonitoring();
    stopMobileTranscriptionTimer();
    stopMediaRecording();
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
  }, [stopMobileTranscriptionTimer]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    initializeRecognition,
    cleanup,
    transcriptionStatus,
    microphoneAccessGranted,
    microphonePermissionStatus,
    isIOS,
    forceOpenAI,
    transcriptionMode,
    stopRecognition: () => {
      recognitionActiveRef.current = false;
      recognitionRef.current?.stop();
    },
    startRecognition: () => {
      recognitionActiveRef.current = true;
      try { recognitionRef.current?.start(); } catch (e) { }
    }
  };
};


