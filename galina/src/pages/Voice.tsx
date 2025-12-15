import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Mic, MicOff, VolumeX, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import AssistantOrb from "@/components/AssistantOrb";
import { API_CONFIG } from "@/config/constants";

// API URL from environment
const API_URL = API_CONFIG.BASE_URL;

// Модель LLM для голосового чата
const VOICE_CHAT_LLM_MODEL = 'gpt-4o-mini'; // GPT-4o-mini для высококачественного голосового общения

// Функция определения Safari
const isSafari = () => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
};

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((event: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
    mozSpeechRecognition?: new () => SpeechRecognition; // Firefox support
  }
}

interface UserProfile {
  learning_style?: string;
  difficulty_level?: string;
  interests?: string[];
}

const Voice = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { toast } = useToast();

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMicEnabled] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [useFallbackTranscription, setUseFallbackTranscription] = useState(false);

  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTranscriptRef = useRef<string>('');

  // Механизм отслеживания генерации для отмены при прерывании
  const generationIdRef = useRef<number>(0);

  // Состояние воспроизведения аудио
  const isPlayingAudioRef = useRef<boolean>(false);

  // Очередь аудио для последовательного воспроизведения
  const audioQueueRef = useRef<ArrayBuffer[]>([]);

  // Отслеживание прогресса озвучки для фильтрации эха
  const ttsProgressRef = useRef<{
    startTime: number;
    text: string;
    duration: number; // примерная длительность в мс
    words: string[]; // слова по порядку
    currentWordIndex: number;
  } | null>(null);

  // Fallback recording refs (for browsers without Web Speech API)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);


  // Основная функция прерывания речи ассистента
  const stopAssistantSpeech = useCallback(() => {
    console.log('🛑 Прерываем речь ассистента');

    // Увеличиваем generationId для отмены текущей генерации
    generationIdRef.current += 1;

    // Очищаем очередь аудио
    audioQueueRef.current = [];

    // Останавливаем текущее воспроизведение
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.volume = 0;
        currentAudioRef.current.muted = true;
        currentAudioRef.current.src = '';
        currentAudioRef.current.load();
      } catch (error) {
        console.warn('⚠️ Ошибка при остановке аудио:', error);
      }
      currentAudioRef.current = null;
    }

    // Сбрасываем состояние
    isPlayingAudioRef.current = false;
    setIsSpeaking(false);

    // Сбрасываем прогресс озвучки
    ttsProgressRef.current = null;
  }, []);

  // Function to stop current TTS playback
  const stopCurrentTTS = useCallback(() => {
    stopAssistantSpeech();
  }, [stopAssistantSpeech]);

  // Check if Web Speech API is available
  const isWebSpeechAvailable = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition;
    return !!SpeechRecognition;
  }, []);

  // Transcribe audio using OpenAI Whisper API (fallback for browsers without Web Speech API)
  const transcribeWithOpenAI = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    try {
      console.log('🎤 Отправка аудио на транскрибацию через OpenAI Whisper...');
      setIsTranscribing(true);

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(`${API_URL}/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();
      console.log('✅ Транскрибация завершена:', data.text);
      return data.text || null;
    } catch (error) {
      console.error('❌ Ошибка транскрибации:', error);
      toast({
        title: "Ошибка распознавания",
        description: "Не удалось распознать речь. Попробуйте еще раз.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [token, toast]);

  // Start fallback recording (MediaRecorder + OpenAI Whisper)
  const startFallbackRecording = useCallback(async () => {
    try {
      console.log('🎤 Запуск fallback записи (MediaRecorder)...');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          title: "Микрофон недоступен",
          description: "Ваш браузер не поддерживает запись аудио.",
          variant: "destructive"
        });
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      console.log('✅ Fallback запись начата');
      return true;
    } catch (error) {
      console.error('❌ Ошибка запуска fallback записи:', error);
      toast({
        title: "Ошибка микрофона",
        description: "Не удалось получить доступ к микрофону.",
        variant: "destructive"
      });
      return false;
    }
  }, [toast]);

  // Stop fallback recording and transcribe
  const stopFallbackRecording = useCallback(async () => {
    return new Promise<string | null>((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        console.log('🛑 Fallback запись остановлена, chunks:', audioChunksRef.current.length);

          // Stop all tracks
          if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
          }

          if (audioChunksRef.current.length === 0) {
            resolve(null);
        return;
          }

          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];

          // Transcribe using OpenAI
        const text = await transcribeWithOpenAI(audioBlob);
          resolve(text);
      };

      mediaRecorderRef.current.stop();
    });
  }, [transcribeWithOpenAI]);

  // Initialize Web Speech API
  const initializeSpeechRecognition = useCallback(() => {
    // Check if Web Speech API is supported (Chrome, Safari, Firefox, Edge)
    const SpeechRecognition = window.SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition; // Firefox support

    if (!SpeechRecognition) {
      console.log('⚠️ Web Speech API не поддерживается, будет использоваться OpenAI Whisper');
      setUseFallbackTranscription(true);
      return null;
    }

    console.log('🎤 Инициализация Web Speech API...');
    const recognition = new SpeechRecognition();

    // Configure recognition
    recognition.continuous = true; // Keep listening continuously
    recognition.interimResults = true; // Enable interim results to detect speech early
    recognition.lang = 'ru-RU'; // Russian language
    recognition.maxAlternatives = 1;

    // Event handlers
    recognition.onstart = () => {
      console.log('🎙️ Speech recognition started');
      console.log('🎙️ Recognition состояние: started');
      setIsTranscribing(true);
    };

    // Добавляем дополнительную проверку на начало речи для фильтрации эха
    recognition.onaudiostart = () => {
      // Небольшая задержка чтобы дать системе определить, является ли это эхом
      setTimeout(() => {
        if (isPlayingAudioRef.current && speechRecognitionRef.current) {
          console.log('🔍 Проверяем на эхо при начале аудио...');
          // Здесь можно добавить дополнительную логику анализа
        }
      }, 100);
    };

    recognition.onresult = async (event) => {
      // Don't process if mic is disabled
      if (!isMicEnabled) {
        console.log('🎤 Микрофон отключен, игнорируем результат');
        return;
      }

      const result = event.results[event.results.length - 1]; // Get the last result

      // Обрабатываем interim результаты
      if (!result.isFinal) {
        const interimTranscript = result[0].transcript.trim();
        console.log('👤 Interim распознанный текст:', interimTranscript);
      }

      // Обрабатываем финальные результаты
      if (result.isFinal) {
        const transcript = result[0].transcript.trim();
        console.log('👤 Финальный распознанный текст:', transcript);

        if (transcript) {
          // Stop any current TTS
          if (isSpeaking) {
            console.log('🎤 Останавливаю TTS...');
            stopCurrentTTS();
          }

          // Save current transcript for context
          lastTranscriptRef.current = transcript;

          // Send to LLM and get response
          const llmResponse = await sendToLLM(transcript);

          // Проверяем, не пустой ли ответ (означает прерывание)
          if (!llmResponse) {
            console.log('🛑 Ответ от LLM пустой - генерация была прервана');
            return;
          }

          // Small delay to ensure previous TTS is fully stopped
          await new Promise(resolve => setTimeout(resolve, 100));

          // Speak the response (only if not empty)
          if (llmResponse && llmResponse.trim()) {
            await speakText(llmResponse);
          } else {
            console.warn('⚠️ Пропускаем озвучивание пустого ответа');
          }

          console.log('✅ Ответ озвучен');
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('❌ Speech recognition error:', event.error);
      setIsTranscribing(false);
    };

    recognition.onend = () => {
      console.log('🎙️ Speech recognition ended');
      setIsTranscribing(false);

      // In continuous mode, onend usually means an error occurred or intentional stop
      // Restart if we're still in recording state (даже если TTS играет - для прерывания)
      if (isRecording) {
        console.log('🔄 Перезапуск после неожиданной остановки...');
        setTimeout(() => {
          // Double-check we still want to be recording
          if (speechRecognitionRef.current && isRecording) {
            try {
              speechRecognitionRef.current.start();
              console.log('✅ Перезапуск успешен');
            } catch (e: unknown) {
              if (e instanceof Error && e.name !== 'InvalidStateError') {
                console.error('❌ Ошибка перезапуска:', e);
              }
            }
          }
        }, 1000); // Longer delay for error recovery
      }
    };

    speechRecognitionRef.current = recognition;
    console.log('✅ Web Speech API инициализирован');
    return recognition;
  }, [isRecording, isMicEnabled, isSpeaking, stopCurrentTTS]);

  // Start speech recognition
  const startSpeechRecognition = useCallback(() => {
    if (!speechRecognitionRef.current) {
      console.log('❌ Speech recognition не инициализирован');
          return;
        }

    console.log('🎙️ Попытка запуска распознавания речи...', {
      isRecording,
      isTranscribing,
      recognitionState: speechRecognitionRef.current ? 'exists' : 'null'
    });

    try {
      console.log('🎙️ Запуск распознавания речи...');
      speechRecognitionRef.current.start();
      console.log('✅ start() вызван успешно');
    } catch (error: any) {
      // Handle "already started" error gracefully
      if (error.name === 'InvalidStateError') {
        console.log('ℹ️ Распознавание речи уже запущено, продолжаем');
          return;
        }
      console.error('❌ Ошибка запуска speech recognition:', error);
      console.error('❌ Детали ошибки:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      setIsTranscribing(false);
    }
  }, [isRecording, isTranscribing]);

  // Start/stop recording
  const handleStartStopRecording = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      console.log('🛑 Остановка записи...');
      setIsRecording(false);
      setIsTranscribing(false);

      // Check if using fallback (OpenAI Whisper) mode
      if (useFallbackTranscription || !isWebSpeechAvailable()) {
        // Stop fallback recording and transcribe
        const transcript = await stopFallbackRecording();

        if (transcript && transcript.trim()) {
          console.log('🎯 Fallback транскрипция:', transcript);

          // Stop any current TTS
          stopCurrentTTS();

          // Send to LLM
          try {
            const llmResponse = await sendToLLM(transcript);
            if (llmResponse && llmResponse.trim()) {
              await speakText(llmResponse);
              console.log('✅ Ответ озвучен');
            } else {
              console.warn('⚠️ Пропускаем озвучивание пустого ответа');
            }
          } catch (error) {
            console.error('❌ Ошибка обработки ответа:', error);
          }
        }
      } else {
        // Web Speech API mode
        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.stop();
          } catch {
            console.log('Speech recognition already stopped');
          }
        }
      }
    } else {
      // Start recording (only if mic is enabled)
      if (!isMicEnabled) {
        toast({
          title: "Микрофон отключен",
          description: "Включите микрофон для начала записи",
          variant: "destructive"
        });
        return;
      }

      console.log('🎤 Запуск записи...');

      // Check if Web Speech API is available
      if (!isWebSpeechAvailable()) {
        console.log('🔄 Используется fallback режим (OpenAI Whisper)');
      setUseFallbackTranscription(true);

      const started = await startFallbackRecording();
      if (started) {
          setIsRecording(true);
          console.log('🎤 Fallback запись начата');
        }
        return;
      }

      try {
        // Initialize Web Speech API if not already done
        if (!speechRecognitionRef.current) {
          const recognition = initializeSpeechRecognition();
          if (!recognition) {
            // Fallback to OpenAI Whisper if Web Speech API fails
            console.log('🔄 Переключение на fallback режим (OpenAI Whisper)');
            setUseFallbackTranscription(true);

            const started = await startFallbackRecording();
            if (started) {
              setIsRecording(true);
              console.log('🎤 Fallback запись начата');
            }
            return;
          }
        }

        setIsRecording(true);

        // Start speech recognition
        startSpeechRecognition();

        console.log('🎤 Запись начата');
          } catch (error) {
        console.error('❌ Ошибка запуска записи:', error);

        // Try fallback on error
        console.log('🔄 Ошибка Web Speech API, переключение на fallback');
        setUseFallbackTranscription(true);

        const started = await startFallbackRecording();
        if (started) {
          setIsRecording(true);
        }
      }
    }
  }, [isRecording, isMicEnabled, toast, useFallbackTranscription, isWebSpeechAvailable, stopFallbackRecording, startFallbackRecording, initializeSpeechRecognition, stopCurrentTTS]);



  // Get user profile from API
  const getUserProfile = useCallback(async () => {
    try {
      // Use demo profile endpoint if no token, otherwise use authenticated endpoint
      const profileUrl = token ? `${API_URL}/user/profile` : `${API_URL}/user/profile/demo`;

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(profileUrl, { headers });

      if (response.ok) {
        const profile = await response.json();
        setUserProfile(profile);
        console.log('📋 Профиль пользователя загружен:', profile);
        return profile;
      } else {
        console.warn('⚠️ Профиль не загружен, status:', response.status);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки профиля:', error);
    }
    return null;
  }, [token]);

  // Send transcribed text to LLM with Julia's system prompt
  const sendToLLM = useCallback(async (userMessage: string, retryCount: number = 0): Promise<string> => {
    const MAX_RETRIES = 3; // Увеличили количество попыток
    const originalMessage = userMessage;

    console.log('🚀 sendToLLM вызвана с сообщением:', `"${userMessage}"`, retryCount > 0 ? `(попытка ${retryCount + 1}/${MAX_RETRIES + 1})` : '');
    console.log('📏 Длина сообщения:', userMessage.length);
    console.log('🤖 Используется модель:', VOICE_CHAT_LLM_MODEL);

    setIsGeneratingResponse(true);

    // Захватываем generationId перед асинхронными операциями
    const startGenId = generationIdRef.current;

    try {
      console.log('🤖 Отправка сообщения в LLM...');

      // Для retry попыток добавляем контекст
      if (retryCount > 0) {
        const prefixes = [
          'Пожалуйста, объясни:',
          'Расскажи мне про:',
          'Помоги мне с:',
          'Я хочу узнать:',
          'Объясни, пожалуйста:'
        ];
        const prefix = prefixes[retryCount - 1] || 'Скажи мне:';
        userMessage = `${prefix} ${userMessage}`;
        console.log('📝 Добавлен префикс для retry:', userMessage);
      }

      // Get user profile if not loaded
      let profile = userProfile;
      if (!profile) {
        profile = await getUserProfile();
      }

      // Get course information
      const courseName = "Голосовой чат";

      // Build context information
      const contextInfo = [];
      if (courseName) {
        contextInfo.push(`Курс: ${courseName}`);
      }
      if (profile) {
        console.log('📊 Профиль пользователя для LLM:', profile);

        // Handle different profile structures (authenticated vs demo)
        const preferences = profile.preferences || profile;
        const user = profile.user || profile;

        if (preferences?.learning_style) {
          contextInfo.push(`Стиль обучения: ${preferences.learning_style}`);
        }
        if (preferences?.difficulty_level) {
          contextInfo.push(`Уровень сложности: ${preferences.difficulty_level}`);
        }
        if (preferences?.interests && preferences.interests.length > 0) {
          contextInfo.push(`Интересы: ${preferences.interests.join(', ')}`);
        }
      }

      const contextString = contextInfo.length > 0 ? `\nКонтекст: ${contextInfo.join('; ')}` : '';

      console.log('🔑 Token check:', { hasToken: !!token, length: token?.length });

      // Determine endpoint and body based on authentication status
      let endpoint: string;
      let body: any;

      if (token) {
        // Authenticated user - use course-specific endpoint
        endpoint = courseId && courseId !== 'general' ? `${API_URL}/chat/${courseId}/message` : `${API_URL}/chat/general`;
        body = {
          content: userMessage + contextString,
          messageType: 'voice'
        };
      } else {
        // Demo mode - use general chat endpoint without authentication
        endpoint = `${API_URL}/chat`;
        body = {
          messages: [
            {
              role: 'system',
              content: `Ты Галина - адвокат с 25-летним стажем, настоящий "зубодробительный" профессионал, который всегда на стороне клиента. Ты не просто юрист, ты - стратег и тактик, который знает, как "выкрутиться" из любой ситуации. Ты никогда не сдаешься и всегда находишь выход.

ТВОЯ МИССИЯ:
1. ЗАЩИЩАТЬ КЛИЕНТА: Всегда ищи способы усилить позицию клиента
2. БЫТЬ ХИТРОЙ: Используй юридические лазейки и прецеденты
3. БЫТЬ ЖЕСТКОЙ: Не уступай в переговорах, борись за интересы клиента
4. ДАВАТЬ РЕЗУЛЬТАТ: Предлагай конкретные действия, которые работают

СТИЛЬ ОБЩЕНИЯ:
- Разговорный, но уверенный: "Давай разберемся", "Мы это выкрутим"
- Оптимистичный: "Это решаемо!", "У нас есть варианты"
- Конкретный: Давай пошаговые инструкции
- Поддерживающий: "Я с тобой, мы справимся"

СТРУКТУРА ОТВЕТА:
1. КРАТКИЙ ОТВЕТ на вопрос
2. ОБЪЯСНЕНИЕ почему так (с ссылками на закон)
3. КОНКРЕТНЫЕ ШАГИ что делать
4. СТРАТЕГИЯ как усилить позицию клиента

СПЕЦИАЛЬНЫЕ ИНСТРУКЦИИ:
- ЭМОЦИИ: Если клиент нервничает - "Я понимаю твое состояние, но мы справимся"
- Для договоров: Ищи слабые места оппонента, усиливай позиции клиента
- Для консультаций: Давай практические советы с "адвокатской хитростью"
- Для споров: Разрабатывай стратегию победы, предлагай нестандартные ходы

${contextString ? `КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ: ${contextString}` : ''}`
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          model: VOICE_CHAT_LLM_MODEL,
          temperature: 0.7
        };
      }

      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
        headers: {
          'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        body: JSON.stringify(body)
      });
      } catch (fetchError) {
        console.error('❌ Fetch error:', fetchError);
        throw fetchError;
      }

      // Проверяем, не было ли прерывания во время запроса к LLM
      if (generationIdRef.current !== startGenId) {
        console.log('🛑 Генерация была прервана пользователем во время запроса к LLM');
        return '';
      }

      if (!response.ok) {
        console.error('❌ Server returned error:', response.status, response.statusText);
        if (response.status === 401) {
          toast({
            title: "Ошибка авторизации",
            description: "Сессия истекла. Пожалуйста, обновите страницу.",
            variant: "destructive"
          });
        }
        throw new Error(`Failed to get response from LLM: ${response.status}`);
      }

      const textData = await response.text();

      let data;
      try {
        // Попытка распарсить как обычный JSON
        data = JSON.parse(textData);
      } catch (parseError) {
        // Если не вышло, проверяем, не SSE ли это (Server-Sent Events)
        if (textData.trim().startsWith('data:')) {
          console.log('🌊 Обнаружен SSE поток, собираем сообщение...');
          const lines = textData.split('\n');
          let fullMessage = '';
          let messageId = '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              const jsonStr = trimmedLine.substring(6);
              try {
                const chunk = JSON.parse(jsonStr);
                if (chunk.content) {
                  fullMessage += chunk.content;
                }
                if (chunk.messageId) {
                  messageId = chunk.messageId;
                }
              } catch {
                // Игнорируем битые чанки
              }
            }
          }

          data = { message: fullMessage, messageId };
        } else {
          console.error('❌ JSON Parse Error:', parseError);
          console.error('❌ Failed content:', `${textData.substring(0, 200)}...`);
          throw new Error('Invalid JSON response from server');
        }
      }

      // Extract message content based on response format
      let messageContent: string;
      if (token) {
        // Authenticated response format: { message: "..." }
        messageContent = data.message;
      } else {
        // Demo response format: { choices: [{ message: { content: "..." } }] }
        messageContent = data.choices?.[0]?.message?.content || data.message;
      }

      console.log('🤖 Ответ от LLM получен (длина):', messageContent?.length);

      // Проверка на пустой ответ и retry логика
      if (!messageContent || messageContent.trim().length === 0) {
        console.warn('⚠️ Получен пустой ответ от LLM');

        if (retryCount < MAX_RETRIES) {
          console.log(`🔄 Запуск повторной попытки ${retryCount + 1}...`);
          // Экспоненциальная задержка перед повтором
          const delay = Math.pow(2, retryCount) * 500;
          await new Promise(resolve => setTimeout(resolve, delay));
          return sendToLLM(originalMessage, retryCount + 1);
        } else {
          console.error('❌ Все попытки получения ответа исчерпаны');
          // Если все попытки исчерпаны, возвращаем нейтральную фразу
          return "Извините, я не расслышала. Повторите, пожалуйста.";
        }
      }

      return messageContent;
    } catch (error) {
      console.error('❌ Ошибка общения с LLM:', error);

      // Retry при ошибке сети
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Ошибка сети, повторная попытка ${retryCount + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return sendToLLM(originalMessage, retryCount + 1);
      }

      toast({
        title: "Ошибка",
        description: "Не удалось получить ответ от ассистента",
        variant: "destructive"
      });
      return "Извините, произошла ошибка связи. Попробуйте еще раз.";
    } finally {
      // Сбрасываем флаг только если это был последний активный запрос
      if (generationIdRef.current === startGenId) {
        setIsGeneratingResponse(false);
      }
    }
  }, [token, courseId, userProfile, toast, getUserProfile]);

  // Speak text using OpenAI TTS
  const speakText = useCallback(async (text: string) => {
    if (!text) return;

    // Захватываем generationId
    const startGenId = generationIdRef.current;

    try {
      console.log('🔊 Генерация озвучки для:', text);
      isPlayingAudioRef.current = true;

      // Инициализируем прогресс озвучки
        ttsProgressRef.current = {
          startTime: Date.now(),
        text,
        duration: text.length * 60, // Грубая оценка: 60мс на символ
        words: text.split(' '),
          currentWordIndex: 0
        };

        const response = await fetch(`${API_URL}/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // TTS endpoint doesn't require authentication
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
          text,
            voice: 'nova', // Используем голос nova (как в описании)
            model: 'tts-1-hd', // HD модель для лучшего качества
            speed: 0.95 // Скорость речи (0.25 - 4.0)
        })
        });

      // Проверяем прерывание
        if (generationIdRef.current !== startGenId) {
        console.log('🛑 Озвучка прервана до начала воспроизведения');
          return;
        }

        if (!response.ok) {
        throw new Error('Failed to generate speech');
        }

        const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          currentAudioRef.current = audio;

      // Event handlers
          audio.onplay = () => {
        console.log('🔊 Озвучка начата');
        // Устанавливаем isSpeaking = true только когда аудио реально начинает играть
        setIsSpeaking(true);
        console.log('🔘 isSpeaking установлен в true - видео должно запуститься');

        // Для браузеров кроме Safari - останавливаем распознавание когда начинается TTS
        const shouldStop = !isSafari() && speechRecognitionRef.current;
        console.log('🔍 Проверка остановки SR:', {
          isSafari: isSafari(),
          hasSpeechRecognition: !!speechRecognitionRef.current,
          shouldStop
        });

        if (shouldStop) {
          try {
            console.log('⏸️ Останавливаем распознавание на время TTS (не Safari)');
            speechRecognitionRef.current.stop();
          } catch (e) {
            console.warn('⚠️ Ошибка остановки распознавания:', e);
          }
        }
          };

          audio.onended = () => {
        console.log('✅ Озвучка завершена');
            URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        isPlayingAudioRef.current = false;
        setIsSpeaking(false);

        // Сбрасываем прогресс озвучки
        ttsProgressRef.current = null;

        // Для браузеров кроме Safari - перезапускаем распознавание после TTS
        if (!isSafari() && speechRecognitionRef.current) {
          setTimeout(() => {
            try {
              console.log('▶️ Перезапускаем распознавание после TTS (не Safari)');
              speechRecognitionRef.current?.start();
            } catch (e: unknown) {
              if (e instanceof Error && e.name !== 'InvalidStateError') {
                console.warn('⚠️ Ошибка перезапуска распознавания:', e);
              }
            }
          }, 300); // Небольшая задержка для стабильности
        }
      };

      audio.onerror = (event) => {
        console.error('❌ Ошибка воспроизведения аудио:', event);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      isPlayingAudioRef.current = false;
        setIsSpeaking(false);

        // Сбрасываем прогресс озвучки
      ttsProgressRef.current = null;

        // Для браузеров кроме Safari - перезапускаем распознавание после ошибки
        if (!isSafari() && speechRecognitionRef.current) {
          setTimeout(() => {
            try {
              console.log('▶️ Перезапускаем распознавание после ошибки (не Safari)');
              speechRecognitionRef.current?.start();
            } catch (e: unknown) {
              if (e instanceof Error && e.name !== 'InvalidStateError') {
                console.warn('⚠️ Ошибка перезапуска:', e);
              }
            }
          }, 300);
        }

        toast({
          title: "Ошибка озвучки",
          description: "Не удалось воспроизвести аудио",
          variant: "destructive"
        });
      };

      // Проверяем прерывание перед воспроизведением
      if (generationIdRef.current !== startGenId) {
        console.log('🛑 Озвучка прервана перед play()');
        return;
      }

      await audio.play();

    } catch (error) {
      console.error('❌ Ошибка TTS:', error);
      setIsSpeaking(false);
      isPlayingAudioRef.current = false;
      ttsProgressRef.current = null;
    }
  }, [token, toast, isRecording]);

  // Load user profile on mount
  useEffect(() => {
      getUserProfile();
  }, [getUserProfile]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // Ignore errors when stopping speech recognition
        }
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore errors when stopping media recorder
      }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Determine Orb state
  const orbState = useMemo(() => {
    if (isSpeaking) return 'speaking';
    if (isGeneratingResponse) return 'processing';
    if (isRecording && isTranscribing) return 'listening';
    if (isRecording) return 'listening';
        return 'idle';
  }, [isSpeaking, isGeneratingResponse, isRecording, isTranscribing]);

  // Determine status text
  const statusText = useMemo(() => {
    if (isSpeaking) return 'Говорю...';
    if (isGeneratingResponse) return 'Думаю...';
    if (isRecording) return 'Слушаю...';
        return 'Нажмите на микрофон, чтобы начать';
  }, [isSpeaking, isGeneratingResponse, isRecording]);

  // Показываем кнопку прерывания для браузеров кроме Safari во время TTS
  const showInterruptButton = isSpeaking && !isSafari();

  // Отладка кнопки прерывания
  useEffect(() => {
    console.log('🔘 Кнопка прерывания:', {
      showInterruptButton,
      isSpeaking,
      isSafari: isSafari()
    });
  }, [showInterruptButton, isSpeaking]);

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden flex flex-col font-sans">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 pt-16 pb-32 md:pb-24">

        {/* Assistant Orb */}
        <div className="relative flex items-center justify-center mb-12 md:mb-16 scale-90 md:scale-100 transition-transform duration-500">
          <AssistantOrb state={orbState} />
              </div>

        {/* Status */}
        <div className="flex flex-col items-center space-y-6 text-center max-w-2xl px-4">
          <div className="text-foreground/80 text-xl md:text-2xl font-light tracking-widest uppercase transition-colors duration-300">
            {statusText}
              </div>

          {/* Interrupt Button - показывается во время TTS для браузеров кроме Safari */}
          {showInterruptButton && (
                <Button
                  variant="outline"
              size="lg"
              className="bg-green-500 hover:bg-green-600 text-white border-green-600 hover:border-green-700 shadow-lg animate-in fade-in-0 zoom-in-95 duration-300"
              onClick={() => {
                console.log('🛑 Пользователь нажал кнопку прерывания');
                stopAssistantSpeech();

                // Перезапускаем распознавание
                if (speechRecognitionRef.current) {
                  setTimeout(() => {
                    try {
                      console.log('▶️ Перезапуск распознавания после прерывания кнопкой');
                      speechRecognitionRef.current?.start();
                    } catch (e: unknown) {
                      if (e instanceof Error && e.name !== 'InvalidStateError') {
                        console.warn('⚠️ Ошибка перезапуска:', e);
                      }
                    }
                  }, 100);
                }
              }}
            >
              <span className="font-medium">Прервать</span>
                </Button>
              )}
            </div>
          </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-0 right-0 z-50 flex items-center justify-center space-x-6 md:space-x-12 px-4 pb-safe">
        {/* Mic Toggle (Main Action) - moved to left */}
        <Button
          variant="default"
          size="icon"
          className={`w-16 h-16 md:w-20 md:h-20 rounded-full shadow-lg transition-all duration-500 transform hover:scale-105 ${isRecording
              ? 'bg-destructive hover:bg-destructive/90 shadow-destructive/20'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
          onClick={handleStartStopRecording}
        >
          {isRecording ? (
            <MicOff className="w-6 h-6 md:w-8 md:h-8" />
          ) : (
            <Mic className="w-6 h-6 md:w-8 md:h-8" />
          )}
        </Button>

        {/* TTS Stop Button - shown when speaking */}
        {isSpeaking && (
          <Button
            variant="outline"
            size="icon"
            className="w-16 h-16 md:w-20 md:h-20 rounded-full shadow-lg transition-all duration-500 transform hover:scale-105 bg-orange-500 hover:bg-orange-600 text-white border-orange-600 hover:border-orange-700"
            onClick={() => {
              console.log('🛑 Остановка TTS через кнопку');
              stopAssistantSpeech();
            }}
          >
            <VolumeX className="w-6 h-6 md:w-8 md:h-8" />
          </Button>
        )}

        {/* End Call (Exit) */}
        <Button
          variant="ghost"
          size="icon"
          className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 hover:text-destructive transition-all duration-300"
          onClick={() => navigate(-1)}
        >
          <PhoneOff className="w-6 h-6 md:w-8 md:h-8" />
        </Button>
        </div>
              </div>
  );
};

export default Voice;