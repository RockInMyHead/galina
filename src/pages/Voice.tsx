import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Sparkles, Send } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { sendChatMessage, textToSpeech, playAudioBlob, speechToText } from "@/utils/apiUtils";
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

  // Environment detection
  const isSecure = window.isSecureContext || location.protocol === 'https:';

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Messages state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Привет! Я Галина, ваш AI-юрист. Я готова помочь вам с юридическими вопросами. Задайте мне вопрос голосом или текстом.',
      role: 'assistant',
      timestamp: new Date()
    }
  ]);

  // Loading states for TTS
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);

  // Detailed logging of environment detection
  useEffect(() => {
    console.log('🔍 Environment detection:', {
      hostname: location.hostname,
      protocol: location.protocol,
      port: location.port,
      href: location.href,
      isSecure,
      secureContext: window.isSecureContext,
      userAgent: navigator.userAgent.substring(0, 50) + '...'
    });

    console.log('ℹ️ Environment check:', {
      isSecure,
      reason: isSecure ? 'secure context' : 'insecure context - may have voice issues'
    });
  }, [isSecure]);

  // Initialize audio recording capabilities
  useEffect(() => {
    console.log('🔧 Checking audio recording capabilities...');
    console.log('📊 Browser capabilities:', {
      mediaDevices: !!navigator.mediaDevices,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      mediaRecorder: !!window.MediaRecorder
    });

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('❌ getUserMedia not supported - cannot record audio');
      return;
    }

    if (!window.MediaRecorder) {
      console.error('❌ MediaRecorder not supported - cannot record audio');
      return;
    }

    console.log('✅ Audio recording supported - ready to use Whisper API');

    // Cleanup function
    return () => {
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current);
        console.log('🧹 Cleaned up auto-send timer on unmount');
      }
    };
  }, []);

  // Beep functionality for user feedback
  const playBeep = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);

      // Close context after beep
      setTimeout(() => audioContext.close(), 200);
    } catch (error) {
      console.warn('Could not play beep:', error);
    }
  }, []);

  const beepIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startBeepInterval = useCallback(() => {
    if (beepIntervalRef.current) return; // Already beeping

    console.log('🔊 Starting beep interval for AI processing feedback');
    playBeep(); // Play first beep immediately
    beepIntervalRef.current = setInterval(playBeep, 3000); // Every 3 seconds
  }, [playBeep]);

  const stopBeepInterval = useCallback(() => {
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
      console.log('🔇 Stopped beep interval');
    }
  }, []);

  // Manage beep interval based on app state
  useEffect(() => {
    // Start beep when loading (AI thinking) or when TTS is being generated, but NOT during TTS playback
    if ((isProcessingAudio || isGeneratingTTS) && !isPlayingTTS) {
      startBeepInterval();
    } else {
      stopBeepInterval();
    }

    // Cleanup on unmount
    return () => {
      stopBeepInterval();
    };
  }, [isProcessingAudio, isGeneratingTTS, isPlayingTTS, startBeepInterval, stopBeepInterval]);

  // Handle sending messages to AI
  const handleSendMessage = useCallback(async (messageText?: string) => {
    const textToSend = messageText || transcript;
    if (!textToSend.trim()) return;

    console.log('🚀 handleSendMessage called with:', textToSend);

    // Clear auto-send timer if running
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      console.log('🕐 Cleared auto-send timer on send');
    }

    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      content: textToSend,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setTranscript('');
    setInterimTranscript('');
    setAutoSendStatus('idle');

    try {
      // Send to AI
      const response = await sendChatMessage([{
        role: 'user',
        content: textToSend
      }]);

      if (response.success && response.data.content) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response.data.content,
          role: 'assistant',
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);

        // Auto-generate TTS for AI response
        speakAIResponse(response.data.content);
      } else {
        console.error('❌ AI response error:', response.error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: 'Извините, произошла ошибка при обработке вашего запроса. Попробуйте еще раз.',
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('❌ Error in handleSendMessage:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Произошла ошибка при отправке сообщения. Проверьте подключение к интернету.',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [transcript]);

  // TTS function for AI responses using OpenAI with parallel generation
  const speakAIResponse = useCallback(async (responseText: string) => {
    if (!responseText || !isSecure) return;

    console.log('🎵 Preparing parallel OpenAI TTS for AI response...');
    setIsGeneratingTTS(true);

    try {
      // Split response into sentences for parallel processing
      const sentences = responseText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      console.log('📝 Split into', sentences.length, 'sentences for parallel TTS');

      // Process and generate TTS for each sentence in parallel
      const ttsPromises = sentences.map(async (sentence, index) => {
        const cleanSentence = sentence.trim();
        if (!cleanSentence) return null;

        console.log(`🎵 Generating TTS for sentence ${index + 1}/${sentences.length}: "${cleanSentence.substring(0, 50)}..."`);

        try {
          const audioBlob = await textToSpeech(cleanSentence);
          return { audio: audioBlob, text: cleanSentence, index };
        } catch (error) {
          console.error(`❌ Failed to generate TTS for sentence ${index + 1}:`, error);
          return null;
        }
      });

      // Wait for all TTS generations to complete
      const results = await Promise.allSettled(ttsPromises);
      console.log('⏳ Waiting for all parallel TTS generations...');

      // Check if any TTS generation failed
      const failedGenerations = results.filter(result => result.status === 'rejected').length;
      if (failedGenerations > 0) {
        console.warn(`⚠️ ${failedGenerations} TTS generations failed`);
      }

      console.log('▶️ Starting sequential playback...');
      console.log('🎬 VIDEO SHOULD APPEAR NOW - setIsPlayingTTS(true)');
      setIsPlayingTTS(true);

      let ttsFailed = false;
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.audio) {
          const { audio, index } = result.value;
          console.log(`🎵 Playing sentence ${index + 1}, size: ${audio.size} bytes`);
          console.log(`🔊 AUDIO SHOULD PLAY NOW for sentence ${index + 1}`);
          const playbackSuccess = await playAudioBlob(audio);
          console.log(`✅ Finished playing sentence ${index + 1}, success: ${playbackSuccess}`);

          if (!playbackSuccess) {
            ttsFailed = true;
          }

          // Small pause between sentences
          if (index < results.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }

      // Show notification if TTS failed
      if (ttsFailed) {
        console.log('⚠️ TTS playback failed, showing notification to user');
        // You could add a toast notification here if desired
      }

      setIsPlayingTTS(false);
      console.log('🎬 VIDEO SHOULD DISAPPEAR NOW - setIsPlayingTTS(false)');

      console.log('✅ Parallel TTS completed for all sentences');
      console.log('✅ TTS function completed - AUDIO SHOULD BE PLAYING');

    } catch (error) {
      console.error('❌ TTS function error:', error);
      setIsPlayingTTS(false);
    } finally {
      setIsGeneratingTTS(false);
    }
  }, [isSecure]);

  // Voice interaction handler
  const handleVoiceInteraction = async () => {
    console.log('handleVoiceInteraction called:', {
      isVoiceMode: isContinuousListening,
      message: transcript.trim(),
      isListening: isRecording,
      isSupported: true
    });

    if (isContinuousListening && transcript.trim()) {
      console.log('Sending voice message');
      await handleSendMessage();
      setIsContinuousListening(false);
    } else if (!isRecording) {
      console.log('Starting voice listening');
      await startListening();
    } else {
      console.log('Already listening or no action needed');
    }
  };

  // Start listening function using Whisper API
  const startListening = useCallback(async () => {
    console.log('🎯 startListening called with Whisper API, current state:', {
      isRecording,
      continuousListening: isContinuousListening
    });

    if (isRecording) {
      console.log('⚠️ Already recording, ignoring start request');
      return;
    }

    try {
      console.log('▶️ Starting audio recording process...');

      // Check microphone permissions
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ getUserMedia not supported');
        alert('Ваш браузер не поддерживает доступ к микрофону');
        return;
      }

      console.log('🎙️ Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Good for Whisper
        }
      });

      console.log('✅ Microphone permission granted');

      // Check if we're in a secure context
      if (!isSecure) {
        console.log('⚠️ Not in secure context - audio recording may not work');
        alert('Для голосового распознавания требуется HTTPS соединение.');
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // Better for Whisper
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎵 Audio recording stopped, processing...');
        setIsProcessingAudio(true);

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('📦 Audio blob created, size:', audioBlob.size, 'bytes');

          if (audioBlob.size < 1000) {
            console.warn('⚠️ Audio blob too small, likely empty recording');
            setTranscript('Не удалось записать аудио. Попробуйте еще раз.');
            setIsProcessingAudio(false);
            return;
          }

          // Send to Whisper API
          const transcription = await speechToText(audioBlob);
          console.log('✅ Transcription received:', transcription);

          setTranscript(transcription);

          // Auto-send if continuous listening is enabled
          if (isContinuousListening && transcription.trim()) {
            console.log('🚀 Auto-sending transcription...');
            await handleSendMessage(transcription);
          }

        } catch (error) {
          console.error('❌ Transcription error:', error);
          setTranscript('Ошибка распознавания речи. Попробуйте еще раз.');
        } finally {
          setIsProcessingAudio(false);
        }

        // Clean up
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        setTranscript('Ошибка записи аудио. Попробуйте еще раз.');
        setIsRecording(false);
        setIsProcessingAudio(false);
        stream.getTracks().forEach(track => track.stop());
      };

      console.log('🎬 Starting audio recording...');
      setIsRecording(true);
      mediaRecorder.start();

      // Auto-stop after 30 seconds if still recording
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('⏰ Auto-stopping recording after 30 seconds');
          stopListening();
        }
      }, 30000);

    } catch (error) {
      console.error('❌ Error starting audio recording:', error);
      if (error.name === 'NotAllowedError') {
        alert('Для голосового распознавания нужен доступ к микрофону. Разрешите доступ в настройках браузера.');
      } else {
        alert('Ошибка доступа к микрофону: ' + error.message);
      }
    }
  }, [isRecording, isContinuousListening, isSecure]);

  // Stop listening function
  const stopListening = useCallback(() => {
    console.log('🛑 Stopping audio recording');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsContinuousListening(false);
    setInterimTranscript('');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Голосовой AI-Юрист Галина
            </h1>
            <p className="text-xl text-gray-600">
              Задайте вопрос голосом - получите профессиональную юридическую консультацию
            </p>
          </div>

          {/* Chat Messages */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Voice Controls */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="text-center">
                <Button
                  onClick={handleVoiceInteraction}
                  disabled={isProcessingAudio}
                  size="lg"
                  className={`mb-4 ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="mr-2 h-5 w-5" />
                      Остановить запись
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-5 w-5" />
                      Начать запись
                    </>
                  )}
                </Button>

                {isProcessingAudio && (
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center">
                      <Sparkles className="mr-2 h-5 w-5 animate-spin text-blue-500" />
                      <span className="text-blue-600 font-medium">
                        Распознавание речи с помощью Whisper...
                      </span>
                    </div>
                  </div>
                )}

                {transcript && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-4">
                    <p className="text-blue-800 font-medium mb-2">Распознанный текст:</p>
                    <p className="text-blue-700">{transcript}</p>
                  </div>
                )}

                {interimTranscript && (
                  <div className="bg-yellow-50 rounded-lg p-4 mb-4">
                    <p className="text-yellow-800 font-medium mb-2">Промежуточный результат:</p>
                    <p className="text-yellow-700 italic">{interimTranscript}</p>
                  </div>
                )}

                {/* Status indicators */}
                <div className="flex justify-center space-x-4 text-sm text-gray-600">
                  <span className={isSecure ? 'text-green-600' : 'text-red-600'}>
                    🔒 {isSecure ? 'Безопасный контекст' : 'Небезопасный контекст'}
                  </span>
                  <span className={isRecording ? 'text-red-600' : 'text-green-600'}>
                    🎙️ {isRecording ? 'Запись активна' : 'Готов к записи'}
                  </span>
                  <span className={isProcessingAudio ? 'text-blue-600' : 'text-gray-400'}>
                    🤖 {isProcessingAudio ? 'Обработка аудио' : 'Ожидание'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Text Input Fallback */}
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Или введите вопрос текстом:
                </p>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && transcript.trim()) {
                        handleSendMessage();
                      }
                    }}
                    placeholder="Введите ваш вопрос..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={!transcript.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Voice;
