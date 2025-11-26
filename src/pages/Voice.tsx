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
  const isLocalhost = typeof window !== 'undefined' && window.location ?
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') : false;
  const isSecure = typeof window !== 'undefined' ?
    (window.isSecureContext || (window.location && window.location.protocol === 'https:')) : false;

  // Environment setup
  useEffect(() => {
    if (isLocalhost && !isSecure) {
      setShowTestMode(true);
    }
  }, [isLocalhost, isSecure]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне юридический вопрос голосом.',
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
    // Initialize Web Speech API
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

    try {
      const recognition = new SpeechRecognition();

      recognition.continuous = false; // Use single-shot mode for better reliability
      recognition.interimResults = true;
      recognition.lang = 'ru-RU';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
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
          console.log('🎤 Распознано:', finalTranscript.trim());

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
                handleSendMessage(newTranscript.trim(), true);
              }
            }, SILENCE_TIMEOUT);

            return newTranscript;
          });

        // If continuous listening is enabled, restart recognition after a delay
        if (isContinuousListening) {
          setTimeout(() => {
            if (isContinuousListening && recognitionRef.current && !isRecording) {
              try {
                recognitionRef.current.start();
              } catch (error) {
                console.error('❌ Failed to restart recognition:', error.message);
                setIsContinuousListening(false);
              }
            }
          }, 1000); // 1 second delay to prevent conflicts
        }
        }
      };

      recognition.onerror = async (event) => {
        console.error('❌ Speech recognition error:', event.error);

        // Handle specific errors
        switch (event.error) {
          case 'network':
            console.error('🔗 Network error - check internet connection');
            break;
          case 'not-allowed':
            console.error('🚫 Microphone access denied');
            break;
          case 'no-speech':
            // No speech detected - silently continue
            break;
          case 'aborted':
            // Check if Safari
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            if (isSafari) {
              // For Safari, try to restart recognition
              setTimeout(() => {
                if (!isRecording) {
                  try {
                    startListening();
                  } catch (restartError) {
                    console.error('❌ Safari restart failed:', restartError.message);
                    setShowTestMode(true);
                  }
                }
              }, 2000);
              return;
            }
            setShowTestMode(true);
            break;
          case 'audio-capture':
            console.error('🎙️ Audio capture failed');
            break;
          case 'service-not-allowed':
            console.error('🚫 Speech recognition service not allowed');
            break;
          default:
            console.error('❓ Speech recognition error:', event.error);
        }

        setIsRecording(false);

        // Don't disable continuous listening for recoverable errors
        const isRecoverableError = (event.error === 'aborted' && isSafari) ||
                                  (event.error === 'no-speech');

        if (!isRecoverableError) {
          setIsContinuousListening(false);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);

        // For continuous mode, restart recognition if enabled
        if (isContinuousListening) {
          setTimeout(() => {
            if (isContinuousListening && recognitionRef.current && !isRecording) {
              try {
                console.log('▶️ Restarting speech recognition...');
                recognitionRef.current.start();
              } catch (error) {
                console.error('❌ Failed to restart recognition in onend:', error);
        setIsContinuousListening(false);
              }
            } else {
              console.log('⚠️ Cannot restart: continuous=', isContinuousListening, 'recording=', isRecording);
            }
          }, 500);
        } else {
          console.log('ℹ️ Continuous listening disabled, recognition ended');
        }
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

  // TTS function for AI responses using OpenAI TTS
  const speakAIResponse = async (text: string) => {
    try {
      setIsGeneratingTTS(true);

      // Split text into sentences
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      setIsPlayingTTS(true);

      // Process and generate TTS for each sentence in parallel
      const ttsPromises = sentences.map(async (sentence, index) => {
        const cleanSentence = sentence.trim();
        if (cleanSentence.length === 0) return null;

        // Process text for better speech synthesis
        const processedSentence = processTextForSpeech(cleanSentence);

        try {
          const audioBlob = await textToSpeech(processedSentence);
          return { audio: audioBlob, text: processedSentence, index };
        } catch (error) {
          console.error(`❌ TTS failed for sentence ${index + 1}:`, error.message);
          return null;
        }
      });

      // Wait for all TTS generations to complete
      console.log('⏳ Waiting for all OpenAI TTS generations...');
      const results = await Promise.allSettled(ttsPromises);

      // Play sentences sequentially
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.audio) {
          const { audio } = result.value;
          await playAudioBlob(audio);

          // Small pause between sentences
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      setIsPlayingTTS(false);

    } catch (error) {
      console.error('❌ Error in OpenAI TTS:', error);
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
    if (recognitionRef.current && !isRecording) {
      try {
        // Check microphone permissions first
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });

          // Test audio context
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioContext = new AudioContextClass();

          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }

          // Clean up stream
          stream.getTracks().forEach(track => track.stop());
          await audioContext.close();
        } catch (permError) {
          console.error('🚫 Microphone permission denied:', permError.message);
          alert('Для голосового распознавания нужен доступ к микрофону. Разрешите доступ в настройках браузера.');
          return;
        }
      } else {
        console.error('❌ getUserMedia not supported');
        alert('Ваш браузер не поддерживает доступ к микрофону');
        return;
      }

      // Start recognition
      recognitionRef.current.start();
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

  const stopListening = useCallback((forcedStop = false) => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    if (forcedStop) {
      setIsContinuousListening(false);
    }
    }
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
  const handleSendMessage = async (messageText: string, isVoice: boolean = false) => {
    if (!messageText.trim()) return;

    // Clear auto-send timer when sending manually or automatically
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }

    setIsLoading(true);

    // Save the continuous listening state at the start
    const shouldResumeContinuous = isContinuousListening || isVoice;

    // If this is a voice message and continuous listening wasn't enabled, enable it now
    if (!isContinuousListening && isVoice) {
      setIsContinuousListening(true);
    }

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

      // Generate session ID for conversation memory
      const sessionId = `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Call AI API with full conversation history
      const apiUrl = `${API_CONFIG.BASE_URL}/chat`;

      let response;
      try {
          max_completion_tokens: 2000
        }, null, 2));

        // Add timeout to fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId,
          },
          body: JSON.stringify({
            messages: conversationHistory,
            model: 'gpt-5.1',
            temperature: 0.7,
            max_completion_tokens: 2000
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          console.error('❌ Request timed out');
        } else {
          console.error('❌ API request failed:', fetchError.message);
        }
        }
        throw new Error(`Network error: ${fetchError.message}`);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error(`JSON parsing error: ${jsonError.message}`);
      }

      const aiResponse = data.choices?.[0]?.message?.content || 'Извините, произошла ошибка при обработке вашего запроса.';

      // Add AI response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Speak the AI response using OpenAI TTS
      console.log('🔊 Starting TTS for AI response...');
      await speakAIResponse(aiResponse);

      // Resume continuous listening after AI response is complete
      if (shouldResumeContinuous) {

        // Resume continuous listening after AI response
        setTimeout(() => {
          if (!isRecording && shouldResumeContinuous) {
            try {
              startListening();
            } catch (error) {
              console.error('❌ Failed to resume listening:', error.message);
                  console.error('❌ RETRY: Failed to start listening:', error);
                }
              }
            }, 1000);
          }
        }, 2000); // Longer delay to ensure everything is cleaned up
      }
    } catch (error) {
      console.error('❌ Error in voice chat:', error.message);

      // Check network connectivity
      console.log('🌐 Checking network connectivity...');
      fetch('http://127.0.0.1:3003/test-proxy', { method: 'GET' })
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Извините, произошла ошибка при обработке вашего запроса.`,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      console.log('🏁 handleSendMessage finished');
      setIsLoading(false);
    }
  };

  // Функция для переключения голосового режима
  const toggleVoiceMode = async () => {
    // Prevent toggling while TTS is playing to avoid accidental interruption
    if (isPlayingTTS) {
      return;
    }

    if (isContinuousListening) {
      setIsContinuousListening(false);
      stopListening(true); // Force stop when user toggles
    } else if (!isLoading) {
      setTranscript(''); // Очищаем предыдущую транскрипцию
      setInterimTranscript('');
      setIsContinuousListening(true); // Включаем постоянное прослушивание при первом нажатии
      console.log('✅ Set isContinuousListening to true');
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