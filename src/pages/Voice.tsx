import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Sparkles, Send } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { sendChatMessage, textToSpeech, playAudioBlob } from "@/utils/apiUtils";
import { AI_SYSTEM_MESSAGES, API_CONFIG } from "@/config/constants";

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

const Voice = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isContinuousListening, setIsContinuousListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [showTestMode, setShowTestMode] = useState(false);
  
  // Auto-send timer
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const SILENCE_TIMEOUT = 2000; // 2 seconds
  const [autoSendStatus, setAutoSendStatus] = useState<'idle' | 'waiting' | 'sending'>('idle');

  // Development helpers
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const isSecure = window.isSecureContext || location.protocol === 'https:';

  // Detailed logging of environment detection
  useEffect(() => {
    console.log('🔍 Environment detection:', {
      hostname: location.hostname,
      protocol: location.protocol,
      port: location.port,
      href: location.href,
      isLocalhost,
      isSecure,
      secureContext: window.isSecureContext,
      userAgent: navigator.userAgent.substring(0, 50) + '...'
    });

    if (isLocalhost && !isSecure) {
      console.log('🔧 Auto-enabling test mode for localhost development');
      setShowTestMode(true);
    } else {
      console.log('ℹ️ Environment check:', {
        isLocalhost,
        isSecure,
        reason: !isLocalhost ? 'not localhost' : 'already secure or HTTPS'
      });
    }
  }, [isLocalhost, isSecure]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос голосом, и я постараюсь помочь вам с профессиональной консультацией.',
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const beepIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio feedback functions
  const playBeep = useCallback(() => {
    if (!('AudioContext' in window) && !('webkitAudioContext' in window)) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.warn('Could not play beep:', error);
    }
  }, []);

  const startBeepInterval = useCallback(() => {
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current);
        }
    beepIntervalRef.current = setInterval(playBeep, 3000); // Every 3 seconds
  }, [playBeep]);

  const stopBeepInterval = useCallback(() => {
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
  }, []);

  // Initialize Web Speech API
  useEffect(() => {
    console.log('🔧 Initializing Web Speech API...');
    console.log('📊 Browser capabilities:', {
      speechRecognition: !!window.SpeechRecognition,
      webkitSpeechRecognition: !!(window as any).webkitSpeechRecognition,
      mediaDevices: !!navigator.mediaDevices,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    });

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error('❌ Web Speech API not supported in this browser');
      return;
    }

    console.log('✅ Web Speech API supported, creating recognition instance...');

    try {
      const recognition = new SpeechRecognition();
      console.log('🎯 Recognition instance created:', {
        continuous: recognition.continuous,
        interimResults: recognition.interimResults,
        lang: recognition.lang,
        maxAlternatives: recognition.maxAlternatives,
        serviceURI: recognition.serviceURI,
        grammars: recognition.grammars
      });

      recognition.continuous = false; // Use single-shot mode for better reliability
      recognition.interimResults = true;
      recognition.lang = 'ru-RU';
      recognition.maxAlternatives = 1;

      console.log('⚙️ Recognition configured:', {
        continuous: recognition.continuous,
        interimResults: recognition.interimResults,
        lang: recognition.lang,
        maxAlternatives: recognition.maxAlternatives
      });

      recognition.onstart = () => {
        console.log('🎤 Speech recognition started successfully');
        setIsRecording(true);
        // isContinuousListening is already set by toggleVoiceMode
      };

      recognition.onresult = (event) => {
        console.log('📝 Speech recognition result received');

        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript) {
          setInterimTranscript(interimTranscript);
        }

        if (finalTranscript && finalTranscript.trim()) {
          console.log('✅ Final transcript:', finalTranscript.trim());

          // Update transcript and immediately schedule auto-send
          setTranscript(prev => {
            const newTranscript = prev ? `${prev} ${finalTranscript.trim()}` : finalTranscript.trim();
          setInterimTranscript('');

            // Clear existing auto-send timer
            if (autoSendTimerRef.current) {
              clearTimeout(autoSendTimerRef.current);
              console.log('🕐 Cleared previous auto-send timer');
            }

            // Set status to waiting
            setAutoSendStatus('waiting');

            // Start new auto-send timer for 2 seconds of silence
            autoSendTimerRef.current = setTimeout(() => {
              if (newTranscript.trim()) {
                console.log('⏰ Auto-sending after 2 seconds of silence:', newTranscript.trim());
                setAutoSendStatus('sending');
                handleSendMessage(newTranscript.trim());
              }
            }, SILENCE_TIMEOUT);
            console.log('⏱️ Started auto-send timer (2 seconds)');

            return newTranscript;
          });

          // If continuous listening is enabled, restart recognition after a delay
          if (isContinuousListening) {
            console.log('🔄 Continuous mode: restarting recognition in 1 second...');
            setTimeout(() => {
              if (isContinuousListening && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (error) {
                  console.error('❌ Failed to restart recognition:', error);
                  setIsContinuousListening(false);
                }
              }
            }, 1000); // 1 second delay to prevent conflicts
          }
        }
      };

      recognition.onerror = async (event) => {
        console.error('❌ Speech recognition error:', event.error, event);
        console.error('❌ Error type:', event.type);
        console.error('❌ Error message:', event.message || 'No message');

        // Detailed debug information
        const debugInfo = {
          isLocalhost,
          isSecure,
          hostname: location.hostname,
          protocol: location.protocol,
          port: location.port,
          href: location.href,
          secureContext: window.isSecureContext,
          webkitSpeechRecognition: typeof (window as any).webkitSpeechRecognition,
          speechRecognition: typeof window.SpeechRecognition,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          errorDetails: {
            error: event.error,
            message: event.message,
            type: event.type
          }
        };

        console.log('🔍 Full error event object:', JSON.stringify(debugInfo, null, 2));

        // Network connectivity test
        console.log('🌐 Testing network connectivity...');
        try {
          const testUrls = [
            'https://www.google.com/favicon.ico',
            'https://www.gstatic.com/speech-api/models/manifest.json',
            'https://clients5.google.com/v1/speech:recognize'
          ];
          
          for (const url of testUrls) {
            try {
              const startTime = performance.now();
              await fetch(url, { method: 'HEAD', mode: 'no-cors' });
              const endTime = performance.now();
              console.log(`✅ Network test passed for ${url} (${Math.round(endTime - startTime)}ms)`);
            } catch (fetchError) {
              console.error(`❌ Network test failed for ${url}:`, fetchError);
            }
          }
        } catch (networkError) {
          console.error('❌ Network connectivity test error:', networkError);
        }

        // Check browser permissions
        console.log('🔐 Checking browser permissions...');
        if (navigator.permissions) {
          try {
            const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            console.log('🎤 Microphone permission status:', micPermission.state);
            
            // Try to get more detailed permission info
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
              const devices = await navigator.mediaDevices.enumerateDevices();
              const audioInputs = devices.filter(device => device.kind === 'audioinput');
              console.log('🎙️ Available audio input devices:', audioInputs.length);
              audioInputs.forEach((device, idx) => {
                console.log(`  ${idx + 1}. ${device.label || `Device ${idx + 1}`} (${device.deviceId.substring(0, 20)}...)`);
              });
            }
          } catch (permError) {
            console.error('❌ Permission check error:', permError);
          }
        }

        // Provide more specific error handling
        switch (event.error) {
          case 'network':
            console.error('🔗 Network error - check internet connection');
            console.log('💡 Possible causes:');
            console.log('   - No internet connection');
            console.log('   - Firewall blocking Google Speech API');
            console.log('   - VPN interfering with speech services');
            console.log('   - Regional restrictions');
            break;
          case 'not-allowed':
            console.error('🚫 Microphone access denied - check permissions');
            console.log('💡 To fix:');
            console.log('   - Click the 🔒 icon in address bar');
            console.log('   - Allow microphone access');
            console.log('   - Refresh the page');
            break;
          case 'no-speech':
            console.error('🤫 No speech detected');
            // This is not critical, just restart if continuous
            if (isContinuousListening) {
              setTimeout(() => startListening(), 1000);
              return;
            }
            break;
          case 'aborted':
            console.error('🛑 Recognition was aborted');
            console.log('🔍 Detailed debug info:', debugInfo);
            console.table(debugInfo.errorDetails);

            // Detect Safari
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
                            /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);

            if (isSafari) {
              console.log('🧭 Browser detected: Safari');
              console.log('💡 Safari has known limitations with Web Speech API:');
              console.log('   - May require user interaction before starting recognition');
              console.log('   - May have stricter security policies');
              console.log('   - May block speech models even with network access');
              console.log('   - Often works better in Chrome or Edge');
              console.log('');
              console.log('🔧 Safari-specific fixes:');
              console.log('   1. Try Chrome or Edge instead of Safari');
              console.log('   2. Make sure you clicked somewhere on the page first');
              console.log('   3. Try Safari in private browsing mode');
              console.log('   4. Check Safari settings → Privacy → Microphone');
              console.log('   5. Update Safari to the latest version');
            } else {
              console.log('💡 "Failed to access assets" usually means:');
              console.log('   1. Browser cannot download Google Speech models');
              console.log('   2. Network/Firewall is blocking https://www.gstatic.com');
              console.log('   3. VPN or proxy interfering');
              console.log('   4. Regional restrictions (some countries)');
              console.log('   5. Browser settings blocking third-party requests');
              console.log('');
              console.log('🔧 Recommended fixes:');
              console.log('   1. Try disabling VPN/proxy');
              console.log('   2. Check firewall settings');
              console.log('   3. Try Chrome in Incognito mode (no extensions)');
              console.log('   4. Check if you can access https://www.google.com');
              console.log('   5. Try different network (mobile hotspot)');
            }

            console.log('');
            console.log('💻 Enabling test mode for manual text input...');
            console.log('💡 Test mode works in all browsers and doesn\'t require speech recognition!');

            setShowTestMode(true);
            break;
          case 'audio-capture':
            console.error('🎙️ Audio capture failed - check microphone');
            console.log('💡 Possible causes:');
            console.log('   - Microphone is being used by another app');
            console.log('   - Microphone hardware issue');
            console.log('   - Microphone drivers need update');
            break;
          case 'service-not-allowed':
            console.error('🚫 Speech recognition service not allowed');
            console.log('💡 This might be due to:');
            console.log('   - Browser policy restrictions');
            console.log('   - Corporate/school network blocking');
            break;
          default:
            console.error('❓ Unknown error:', event.error);
        }

        setIsRecording(false);
        setIsContinuousListening(false);
      };

      recognition.onend = () => {
        console.log('🛑 Speech recognition ended');
        setIsRecording(false);
        // Don't automatically restart here - it's handled in onresult for continuous mode
        // Only disable continuous listening if it was a manual stop
      };

      recognitionRef.current = recognition;

    } catch (error) {
      console.error('❌ Failed to initialize speech recognition:', error);
    }
    
    // Cleanup function
    return () => {
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current);
        console.log('🧹 Cleaned up auto-send timer on unmount');
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Manage beep interval based on app state - beep only during AI/TTS processing, not during playback
  useEffect(() => {
    // Start beep when loading (AI thinking) or when TTS is being generated, but NOT during TTS playback
    if ((isLoading || isGeneratingTTS) && !isPlayingTTS) {
      startBeepInterval();
    } else {
      stopBeepInterval();
    }

    // Cleanup on unmount
    return () => {
      stopBeepInterval();
    };
  }, [isLoading, isGeneratingTTS, isPlayingTTS, startBeepInterval, stopBeepInterval]);

  // TTS function for AI responses using OpenAI with parallel generation
  const speakAIResponse = async (text: string) => {
    try {
      console.log('🎵 Preparing parallel OpenAI TTS for AI response...');
      setIsGeneratingTTS(true);

      // Split text into sentences
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      console.log('📝 Split into', sentences.length, 'sentences for parallel TTS');

      // Process and generate TTS for each sentence in parallel
      const ttsPromises = sentences.map(async (sentence, index) => {
        const cleanSentence = sentence.trim();
        if (cleanSentence.length === 0) return null;

        console.log(`🎵 Generating TTS for sentence ${index + 1}/${sentences.length}: "${cleanSentence.substring(0, 50)}..."`);

        // Process text for better speech synthesis
        const processedSentence = processTextForSpeech(cleanSentence);

        try {
          const audioBlob = await textToSpeech(processedSentence);
          return { audio: audioBlob, text: processedSentence, index };
    } catch (error) {
          console.error(`❌ Failed to generate TTS for sentence ${index + 1}:`, error);
          return null;
        }
      });

      // Wait for all TTS generations to complete
      console.log('⏳ Waiting for all parallel TTS generations...');
      const results = await Promise.allSettled(ttsPromises);

      // Play sentences sequentially
      console.log('▶️ Starting sequential playback...');
      console.log('🎬 VIDEO SHOULD APPEAR NOW - setIsPlayingTTS(true)');
      setIsPlayingTTS(true);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.audio) {
          const { audio, index } = result.value;
          console.log(`🎵 Playing sentence ${index + 1}, size: ${audio.size} bytes`);
          console.log(`🔊 AUDIO SHOULD PLAY NOW for sentence ${index + 1}`);
          await playAudioBlob(audio);
          console.log(`✅ Finished playing sentence ${index + 1}`);

          // Small pause between sentences
          if (index < results.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }

      setIsPlayingTTS(false);
      console.log('🎬 VIDEO SHOULD DISAPPEAR NOW - setIsPlayingTTS(false)');

      console.log('✅ Parallel TTS completed for all sentences');
    } catch (error) {
      console.error('❌ Error in parallel OpenAI TTS:', error);
    } finally {
      setIsGeneratingTTS(false);
      setIsPlayingTTS(false);
    }
  };

  // Process text for better speech synthesis
  const processTextForSpeech = (text: string): string => {
    // Convert numbers to words for better pronunciation
    text = text.replace(/\b\d+\b/g, (match) => {
      const num = parseInt(match);
      return numberToWords(num);
    });

    // Convert dates to natural speech
    text = text.replace(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g, (match, day, month, year) => {
      const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                     'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
      return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year} года`;
    });

    // Convert mathematical expressions
    text = text.replace(/(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)/g, '$1 плюс $2 равно $3');
    text = text.replace(/(\d+)\s*\*\s*(\d+)\s*=\s*(\d+)/g, '$1 умножить на $2 равно $3');
    text = text.replace(/(\d+)\s*\/\s*(\d+)\s*=\s*(\d+)/g, '$1 разделить на $2 равно $3');

    return text;
  };

  // Convert number to words (simplified Russian)
  const numberToWords = (num: number): string => {
    const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
                   'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

    if (num === 0) return 'ноль';
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ` ${  units[num % 10]}` : '');
    if (num < 1000) return hundreds[Math.floor(num / 100)] + (num % 100 ? ` ${  numberToWords(num % 100)}` : '');

    return num.toString(); // Fallback for larger numbers
  };

  // Voice control functions
  const startListening = useCallback(async () => {
    console.log('🎯 startListening called, current state:', {
      isRecording,
      recognitionExists: !!recognitionRef.current,
      continuousListening: isContinuousListening
    });

    if (recognitionRef.current && !isRecording) {
      try {
        console.log('▶️ Starting speech recognition process...');

        // Check microphone permissions first
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            console.log('🎙️ Requesting microphone permission...');
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            });
            console.log('✅ Microphone permission granted, testing audio context...');

            // Test audio context
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            console.log('🎵 Audio context class available:', !!AudioContextClass);

            const audioContext = new AudioContextClass();
            console.log('🎵 Audio context created:', {
              state: audioContext.state,
              sampleRate: audioContext.sampleRate,
              baseLatency: audioContext.baseLatency
            });

            if (audioContext.state === 'suspended') {
              console.log('🔄 Audio context suspended, attempting to resume...');
              await audioContext.resume();
              console.log('✅ Audio context resumed, new state:', audioContext.state);
            }

            // Test stream properties
            const audioTracks = stream.getAudioTracks();
            console.log('🎙️ Audio tracks:', audioTracks.length);
            if (audioTracks.length > 0) {
              const track = audioTracks[0];
              console.log('🎙️ Audio track settings:', {
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                contentHint: track.contentHint
              });
            }

            stream.getTracks().forEach(track => track.stop());
            await audioContext.close();
            console.log('✅ Audio context test successful');
          } catch (permError) {
            console.error('🚫 Microphone permission denied:', permError);
            console.error('🚫 Error name:', permError.name);
            console.error('🚫 Error message:', permError.message);
            alert('Для голосового распознавания нужен доступ к микрофону. Разрешите доступ в настройках браузера.');
            return;
          }
        } else {
          console.error('❌ getUserMedia not supported');
          alert('Ваш браузер не поддерживает доступ к микрофону');
          return;
        }

        // Check if we're in a secure context
        const currentIsLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const currentIsSecure = window.isSecureContext || location.protocol === 'https:';

        console.log('🔒 Security context check:', {
          hostname: location.hostname,
          protocol: location.protocol,
          isSecure: currentIsSecure,
          secureContext: window.isSecureContext,
          isLocalhost: currentIsLocalhost
        });

        if (!currentIsSecure) {
          console.log('⚠️ Not in secure context - Web Speech API may not work');
          console.log(`📍 Current protocol: ${location.protocol}`);
          console.log(`🔒 Secure context: ${window.isSecureContext}`);

          if (isLocalhost) {
            console.log('💡 For localhost development, you can:');
            console.log('   1. Use HTTPS: npm run dev -- --https');
            console.log('   2. Configure Chrome: chrome://flags/#unsafely-treat-insecure-origin-as-secure + http://localhost:3001');
            console.log('   3. Use Firefox with media.webspeech.recognition.force_allow_insecure = true');

            // For localhost, we'll try anyway but warn the user
            console.log('🔄 Trying to use speech recognition despite insecure context...');
          } else {
            alert('Web Speech API требует HTTPS соединения для работы с микрофоном.');
            return;
          }
        }

        console.log('⏳ Delaying recognition start by 100ms...');
        setTimeout(() => {
          console.log('🚀 Attempting to start recognition, final check:', {
            recognitionExists: !!recognitionRef.current,
            isRecording,
            continuousListening: isContinuousListening
          });

          if (recognitionRef.current && !isRecording) {
            try {
        recognitionRef.current.start();
              console.log('🎤 Recognition.start() called successfully');
            } catch (startError) {
              console.error('❌ Failed to start recognition:', startError);
              console.error('❌ Start error details:', {
                name: startError.name,
                message: startError.message,
                stack: startError.stack
              });
            }
          } else {
            console.log('⚠️ Recognition not started - conditions not met');
          }
        }, 100);

      } catch (error) {
        console.error('❌ Error starting speech recognition:', error);
      }
    }
  }, [isRecording]);

  const stopListening = useCallback(() => {
      console.log('🛑 Stopping speech recognition');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    setIsContinuousListening(false);
    setInterimTranscript('');
  }, []);

  // Handle audio recording completion (legacy MediaRecorder - keeping for compatibility)
  const handleAudioRecorded = async (audioBlob: Blob) => {
    // Since we now use Web Speech API, this function is mainly for legacy compatibility
    // The actual transcription happens in the Web Speech API result handler
    console.log('🎤 Legacy audio processing called, but using Web Speech API instead');
    setIsProcessingAudio(false);
  };

  // Функция для сжатия аудио (упрощенная версия)
  const compressAudio = async (audioBlob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        // Simple passthrough for now - in a real implementation you'd compress
        resolve(audioBlob);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Функция для отправки аудио на сервер для распознавания
  const transcribeAudioOnServer = async (audioBlob: Blob): Promise<string> => {
    // Since we're using Web Speech API, this is just a placeholder
    return '';
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      console.log('🎤 Starting audio recording...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      const selectedMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        console.log('🎤 Recording stopped, processing audio...', {
          size: audioBlob.size,
          type: audioBlob.type
        });
        handleAudioRecorded(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Собираем данные каждую секунду для лучшего контроля размера
      setIsRecording(true);

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      alert('Не удалось начать запись. Проверьте разрешения на микрофон.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('🛑 Stopping audio recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Функция отправки сообщения
  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;

    console.log('🎯 handleSendMessage called with:', messageText);
    
    // Clear auto-send timer when sending manually or automatically
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
      console.log('🕐 Cleared auto-send timer on send');
    }
    
    // Note: TTS playback interruption will be handled by the audio system
    // when new audio starts playing
    
    setIsLoading(true);

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setTranscript('');
    setInterimTranscript('');
    setAutoSendStatus('idle');

    try {
      console.log('🚀 Calling AI API...');
      
      // Prepare conversation history with context
      const conversationHistory = [
        {
              role: 'system',
              content: AI_SYSTEM_MESSAGES.voice
        },
        // Add all previous messages for context
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        // Add current user message
        {
              role: 'user',
              content: messageText
            }
      ];
      
      console.log('📝 Sending conversation with history:', conversationHistory.length, 'messages');
      
      // Generate session ID for conversation memory
      const sessionId = `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Call AI API with full conversation history
      const apiUrl = `${API_CONFIG.BASE_URL}/chat`;
      console.log('🔗 Making API request to:', apiUrl);
      console.log('📊 API_CONFIG.BASE_URL:', API_CONFIG.BASE_URL);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
        },
        body: JSON.stringify({
          messages: conversationHistory,
          model: 'gpt-5.1',
          reasoning: 'medium',
          temperature: 0.7,
          max_tokens: 2000
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ API error:', response.status, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      console.log('📥 API response received, parsing...');
      const data = await response.json();
      console.log('📄 Raw API response received successfully');
      console.log('💬 AI response extracted:', `${data.choices?.[0]?.message?.content?.substring(0, 100)  }...`);

      const aiResponse = data.choices?.[0]?.message?.content || 'Извините, произошла ошибка при обработке вашего запроса.';
      console.log('💬 AI response extracted:', `${aiResponse.substring(0, 100)  }...`);

      // Add AI response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        role: 'assistant',
        timestamp: new Date()
      };

      console.log('✅ Adding AI message to chat...');
      setMessages(prev => {
        console.log('📊 Total messages after adding AI response:', prev.length + 1);
        return [...prev, assistantMessage];
      });

      // Speak the AI response using OpenAI TTS
      console.log('🔊 Starting OpenAI TTS for AI response...');
      console.log('🎵 TTS text length:', aiResponse.length, 'characters');
      console.log('🎬 About to call speakAIResponse, isPlayingTTS should change to true');
      console.log('▶️ CALLING speakAIResponse NOW...');
      await speakAIResponse(aiResponse);
      console.log('✅ TTS function completed - AUDIO SHOULD BE PLAYING');

    } catch (error) {
      console.error('❌ Error in handleSendMessage:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Извините, произошла ошибка при обработке вашего запроса. Попробуйте еще раз.',
        role: 'assistant',
        timestamp: new Date()
      };

      console.log('🚨 Adding error message to chat...');
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      console.log('🏁 handleSendMessage finished');
      setIsLoading(false);
    }
  };

  // Функция для переключения голосового режима
  const toggleVoiceMode = async () => {
    console.log('🎛️ toggleVoiceMode called, isContinuousListening:', isContinuousListening, 'isLoading:', isLoading);

    if (isContinuousListening) {
      console.log('🛑 Stopping continuous listening via toggle');
      stopListening();
    } else if (!isLoading) {
      console.log('▶️ Starting continuous listening via toggle');
      setTranscript(''); // Очищаем предыдущую транскрипцию
      setInterimTranscript('');
      startListening();
    } else {
      console.log('❌ Cannot start voice recognition: isLoading=', isLoading);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <Header />
      
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          {/* Header Section */}
          <div className="mb-12 text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Mic className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Голосовое общение
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Говорите естественно - система автоматически распознает вашу речь и отвечает голосом.
            </p>
          </div>

          {/* Main Interface */}
          <div className="max-w-4xl mx-auto">
            <Card className="border-border/50">
                <CardContent className="p-12">
                <div className="text-center space-y-8">
                    {/* Voice Visualizer */}
                    <div className="relative">
                      <video
                        className="h-64 w-64 rounded-full object-cover cursor-pointer mx-auto shadow-2xl"
                        autoPlay
                        loop
                        muted
                        playsInline
                        onClick={toggleVoiceMode}
                      >
                        <source src="/Untitled Video-2.mp4" type="video/mp4" />
                        Ваш браузер не поддерживает видео.
                      </video>
                      {/* Overlay for TTS state indication */}
                      {isPlayingTTS && (
                        <div className="absolute inset-0 rounded-full bg-green-500/20 border-4 border-green-500 animate-pulse" />
                      )}
                    </div>

                    <div className="text-center space-y-2">
                      <h2 className="text-2xl font-bold text-foreground">
                      {isLoading ? "" : ""}
                      </h2>
                      <p className="text-muted-foreground">
                      {isLoading ? "" : ""}
                      </p>
                    </div>


                  {/* Test input for development */}
                  {(showTestMode || (isLocalhost && !isSecure)) && (
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 mb-4">
                      <div className="text-sm text-yellow-800 mb-2 font-medium">
                        🧪 Режим разработки {showTestMode ? '(включен из-за ошибки)' : '(без HTTPS)'}
                      </div>
                      <div className="text-xs text-yellow-700 mb-3">
                        {showTestMode
                          ? 'Произошла ошибка с микрофоном. Используйте тестовый ввод для проверки AI ответов.'
                          : 'Speech API не работает без HTTPS. Используйте тестовый ввод для проверки функциональности.'
                        }
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Введите тестовый текст..."
                          className="flex-1 px-3 py-2 border rounded text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              setTranscript(e.currentTarget.value.trim());
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            const testTexts = [
                              'Здравствуйте, помогите составить договор',
                              'Что такое трудовой договор?',
                              'Как зарегистрировать ООО?',
                              'Какие документы нужны для развода?'
                            ];
                            const randomText = testTexts[Math.floor(Math.random() * testTexts.length)];
                            setTranscript(randomText);
                            console.log('🧪 Test input:', randomText);
                          }}
                          className="px-3 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                        >
                          🎲 Случайный
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Transcript display */}
                  {(transcript || interimTranscript) && (
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <div className="text-sm text-muted-foreground mb-2">Распознанный текст:</div>
                      <div className="space-y-2">
                        {transcript && (
                          <textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            className="w-full p-2 rounded border bg-background text-foreground resize-none"
                            rows={3}
                            placeholder="Распознанный текст..."
                          />
                        )}
                        {interimTranscript && (
                          <div className="text-muted-foreground italic text-sm">
                            {interimTranscript}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        {transcript && !isLoading && (
                          <Button
                            size="sm"
                            onClick={() => handleSendMessage(transcript)}
                            disabled={isLoading}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Отправить
                          </Button>
                        )}
                        {transcript && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTranscript('');
                              setInterimTranscript('');
                              setAutoSendStatus('idle');
                              if (autoSendTimerRef.current) {
                                clearTimeout(autoSendTimerRef.current);
                                autoSendTimerRef.current = null;
                              }
                            }}
                          >
                            Очистить
                          </Button>
                        )}
                        {isRecording && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              stopListening();
                              setTranscript('');
                              setInterimTranscript('');
                              setAutoSendStatus('idle');
                              if (autoSendTimerRef.current) {
                                clearTimeout(autoSendTimerRef.current);
                                autoSendTimerRef.current = null;
                              }
                            }}
                          >
                            Сбросить
                          </Button>
                        )}
                      </div>

                      {/* Status indicator */}
                      <div className="mt-3 text-xs text-muted-foreground">
                        {isRecording ? (
                          <span className="text-red-500">🔴 Запись активна</span>
                        ) : isContinuousListening ? (
                          <span className="text-yellow-500">🟡 Готов к записи</span>
                        ) : autoSendStatus === 'waiting' ? (
                          <span className="text-blue-500">⏱️ Автоотправка через 2 сек</span>
                        ) : autoSendStatus === 'sending' ? (
                          <span className="text-green-500">📤 Отправка...</span>
                        ) : (
                          <span className="text-gray-500">⚪ Неактивен</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-4 justify-center">
                      <Button
                        size="lg"
                        variant={isLoading ? "secondary" : isRecording ? "destructive" : "default"}
                        onClick={toggleVoiceMode}
                        disabled={isLoading}
                        className="shadow-elegant"
                      >
                        {isLoading ? (
                          <Sparkles className="h-5 w-5 mr-2 animate-spin" />
                        ) : isRecording ? (
                          <MicOff className="h-5 w-5 mr-2" />
                        ) : (
                          <Mic className="h-5 w-5 mr-2" />
                        )}
                        {isLoading ? "Обработка..." :
                       isContinuousListening ? "Остановить прослушивание" :
                       transcript ? "Продолжить запись" : "Начать запись"}
                      </Button>
                  </div>
                  </div>
                </CardContent>
              </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Voice;