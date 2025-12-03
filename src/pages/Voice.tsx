import Navigation from "@/components/Navigation";

import { useParams, useNavigate } from "react-router-dom";

import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

import { useAuth } from "@/contexts/AuthContext";

import { useToast } from "@/hooks/use-toast";

import AssistantOrb from "@/components/AssistantOrb";

import LogsPanel from "@/components/LogsPanel";

import { API_CONFIG } from "@/config/constants";



// API URL from environment
const API_URL = API_CONFIG.BASE_URL;

// Константы для VAD (Voice Activity Detection)
const VAD_THRESHOLD = 30; // Порог громкости для обнаружения голоса

// Модель LLM для голосового чата
const VOICE_CHAT_LLM_MODEL = 'gpt-5.1'; // GPT-5.1 для высококачественного голосового общения

// Функция определения Safari
const isSafari = () => {
  const ua = navigator.userAgent.toLowerCase();
  const result = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
  console.log('🌐 Определение браузера:', {
    userAgent: ua,
    isSafari: result,
    hasChrome: ua.includes('chrome'),
    hasSafari: ua.includes('safari')
  });
  return result;
};

// Web Speech API types
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

const Voice = () => {

  const { courseId } = useParams();

  const navigate = useNavigate();

  const { token: authToken } = useAuth();
  const token = authToken || localStorage.getItem('galina-token') || 'demo-token'; // Fallback для демо-режима

  const { toast } = useToast();

  // Debug logging for token
  useEffect(() => {
    console.log('🔑 Voice component token check:', {
      token: token ? `${token.substring(0, 20)}...` : 'null',
      tokenLength: token?.length || 0,
      authToken: authToken ? `${authToken.substring(0, 20)}...` : 'null',
      localStorageToken: localStorage.getItem('galina-token') ? 'exists' : 'null',
      localStorageUser: localStorage.getItem('galina-user') ? 'exists' : 'null'
    });
  }, [token, authToken]);



  const [isRecording, setIsRecording] = useState(false);

  const [isTranscribing, setIsTranscribing] = useState(false);

  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);

  const [isMicEnabled, setIsMicEnabled] = useState(true);

  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  const [userProfile, setUserProfile] = useState<any>(null);

  const [useFallbackTranscription, setUseFallbackTranscription] = useState(false);

  const [transcriptDisplay, setTranscriptDisplay] = useState<string>("");

  // Logs state
  const [conversationLogs, setConversationLogs] = useState<Array<{
    id: string;
    timestamp: Date;
    type: 'speech' | 'recognition' | 'llm' | 'tts' | 'error' | 'info';
    message: string;
    details?: any;
  }>>([]);

  const [showLogs, setShowLogs] = useState(false);

  // Logs management functions
  const addLog = useCallback((type: 'speech' | 'recognition' | 'llm' | 'tts' | 'error' | 'info', message: string, details?: any) => {
    const logEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      type,
      message,
      details
    };

    setConversationLogs(prev => [...prev.slice(-49), logEntry]); // Keep last 50 entries
  }, []);

  const clearLogs = useCallback(() => {
    setConversationLogs([]);
  }, []);



  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const lastTranscriptRef = useRef<string>('');



  // Механизм отслеживания генерации для отмены при прерывании

  const generationIdRef = useRef<number>(0);



  // Аудио контекст и анализатор для мониторинга громкости

  const audioContextRef = useRef<AudioContext | null>(null);

  const audioAnalyserRef = useRef<AnalyserNode | null>(null);

  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const volumeMonitorRef = useRef<number | null>(null);



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





  // Инициализация аудио контекста для анализа

  const initializeAudioContext = useCallback(async (): Promise<AudioContext> => {

    if (audioContextRef.current) {

      return audioContextRef.current;

    }



    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

    audioContextRef.current = new AudioContextClass();



    // Resume context if suspended (required by some browsers)

    if (audioContextRef.current.state === 'suspended') {

      await audioContextRef.current.resume();

    }



    return audioContextRef.current;

  }, []);



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

  }, []);



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

      addLog('recognition', 'Отправка аудио на транскрибацию через OpenAI Whisper');

      setIsTranscribing(true);



      const formData = new FormData();

      formData.append('audio', audioBlob, 'recording.webm');



      const response = await fetch(`${API_URL}/transcribe`, {

        method: 'POST',

        headers: {

          ...(token !== 'demo-token' && { 'Authorization': `Bearer ${token}` })

        },

        body: formData

      });



      if (!response.ok) {

        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

        throw new Error(errorData.error || 'Transcription failed');

      }



      const data = await response.json();

      console.log('✅ Транскрибация завершена:', data.text);

      addLog('recognition', `Транскрибация завершена: "${data.text?.substring(0, 50)}${data.text?.length > 50 ? '...' : ''}"`);

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

      addLog('info', 'Запуск резервной записи речи (MediaRecorder API)');



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

        addLog('info', `Запись остановлена, получено ${audioChunksRef.current.length} аудио фрагментов`);



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

        if (text) {

          addLog('recognition', `Распознано: "${text}"`, { length: text.length });

        }

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



    // Для Safari: прерываем TTS при начале речи
    recognition.onspeechstart = () => {

      if (isSafari() && isPlayingAudioRef.current) {

        console.log('🎤 Safari: Speech started - прерываем TTS');

        stopAssistantSpeech();

      }

    };



    // Добавляем дополнительную проверку на начало речи для фильтрации эха

    recognition.onaudiostart = () => {

      // Для Safari: резко прерываем TTS при начале речи пользователя
      if (isSafari() && isPlayingAudioRef.current) {

        console.log('🎤 Safari: обнаружено начало речи пользователя, прерываем TTS');

        stopAssistantSpeech();

      }

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

        setTranscriptDisplay(interimTranscript);

        console.log('👤 Interim распознанный текст:', interimTranscript);

        // Для Safari: прерываем TTS при первых признаках речи пользователя
        if (isSafari() && isPlayingAudioRef.current && interimTranscript.length > 0) {

          console.log('🎤 Safari: обнаружен interim текст, прерываем TTS');

          stopAssistantSpeech();

        }

      }



      // Обрабатываем финальные результаты

      if (result.isFinal) {

        const transcript = result[0].transcript.trim();

        setTranscriptDisplay(transcript);

        console.log('👤 Финальный распознанный текст:', transcript);

        addLog('recognition', `Распознано через Web Speech API: "${transcript}"`, { length: transcript.length });

        // Для Safari: дополнительная проверка прерывания TTS при финальном результате
        if (isSafari() && isPlayingAudioRef.current) {

          console.log('🎤 Safari: финальный результат, проверяем TTS');

          // Небольшая задержка перед отправкой запроса
          setTimeout(() => {

            if (isPlayingAudioRef.current) {

              console.log('🎤 Safari: TTS все еще играет перед отправкой запроса, прерываем');

              stopAssistantSpeech();

            }

          }, 100);

        }



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

            } catch (e: any) {

              if (e.name !== 'InvalidStateError') {

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

  }, [isRecording, isMicEnabled, isSoundEnabled]);



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

      addLog('info', 'Остановка записи речи');

      setIsRecording(false);

      setIsTranscribing(false);



      // Check if using fallback (OpenAI Whisper) mode

      if (useFallbackTranscription || !isWebSpeechAvailable()) {

        // Stop fallback recording and transcribe

        const transcript = await stopFallbackRecording();



        if (transcript && transcript.trim()) {

          console.log('🎯 Fallback транскрипция:', transcript);

          setTranscriptDisplay(transcript);



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

          } catch (error) {

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

      addLog('info', 'Запуск записи речи');

      setTranscriptDisplay("");



      // Check if Web Speech API is available

      if (!isWebSpeechAvailable()) {

        console.log('🔄 Используется fallback режим (OpenAI Whisper)');

        setUseFallbackTranscription(true);



        const started = await startFallbackRecording();

        if (started) {

          setIsRecording(true);

          console.log('🎤 Fallback запись начата');

          addLog('info', 'Резервная запись речи успешно запущена');

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

        addLog('info', 'Запись речи успешно запущена');

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

  }, [isRecording, isMicEnabled, toast]);



  // Toggle microphone

  const handleToggleMic = useCallback(() => {

    if (isMicEnabled) {

      // Disable mic

      console.log('🎤 Отключение микрофона...');

      setIsMicEnabled(false);

      if (isRecording) {

        // Stop recording if it's active

        setIsRecording(false);

        setIsTranscribing(false);



        // Stop Web Speech API if active

        if (speechRecognitionRef.current) {

          try {

            speechRecognitionRef.current.stop();

          } catch (error) {

            console.log('Speech recognition already stopped');

          }

        }



        // Stop fallback recording if active

        if (mediaRecorderRef.current) {

          try {

            mediaRecorderRef.current.stop();

          } catch (error) {

            console.log('MediaRecorder already stopped');

          }

        }

        if (mediaStreamRef.current) {

          mediaStreamRef.current.getTracks().forEach(track => track.stop());

          mediaStreamRef.current = null;

        }

      }

      toast({

        title: "Микрофон отключен",

        description: "Распознавание речи приостановлено"

      });

    } else {

      // Enable mic

      console.log('🎤 Включение микрофона...');

      setIsMicEnabled(true);

      toast({

        title: "Микрофон включен",

        description: "Распознавание речи активно"

      });

    }

  }, [isMicEnabled, isRecording, toast]);



  // Toggle sound

  const handleToggleSound = useCallback(() => {

    if (isSoundEnabled) {

      // Disable sound

      console.log('🔊 Отключение звука...');

      setIsSoundEnabled(false);

      toast({

        title: "Звук отключен",

        description: "Ответы не будут озвучиваться"

      });

    } else {

      // Enable sound

      console.log('🔊 Включение звука...');

      setIsSoundEnabled(true);

      toast({

        title: "Звук включен",

        description: "Ответы будут озвучиваться"

      });

    }

  }, [isSoundEnabled, toast]);



  // Get user profile from API

  const getUserProfile = useCallback(async () => {

    try {

      // Используем демо-профиль для демо-режима
      const profileEndpoint = token === 'demo-token' ? '/user/profile/demo' : '/user/profile';

      const response = await fetch(`${API_URL}${profileEndpoint}`, {

        headers: {

          ...(token !== 'demo-token' && { 'Authorization': `Bearer ${token}` })

        }

      });



      if (response.ok) {

        const profile = await response.json();

        setUserProfile(profile);

        console.log('📋 Профиль пользователя загружен:', profile);

        return profile;

      }

    } catch (error) {

      console.error('❌ Ошибка загрузки профиля:', error);

    }

    return null;

  }, [token]);



  // Get course name from courseId

  const getCourseName = useCallback(() => {

    return "Юридическая консультация";

  }, []);



  // Send transcribed text to LLM with Julia's system prompt

  const sendToLLM = useCallback(async (userMessage: string, retryCount: number = 0): Promise<string> => {

    const MAX_RETRIES = 3; // Увеличили количество попыток

    const originalMessage = userMessage;



    console.log('🚀 sendToLLM вызвана с сообщением:', `"${userMessage}"`, retryCount > 0 ? `(попытка ${retryCount + 1}/${MAX_RETRIES + 1})` : '');

    console.log('📏 Длина сообщения:', userMessage.length);

    console.log('🤖 Используется модель:', VOICE_CHAT_LLM_MODEL);

    addLog('llm', `Отправка запроса к LLM${retryCount > 0 ? ` (попытка ${retryCount + 1})` : ''}: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`, {

      model: VOICE_CHAT_LLM_MODEL,

      length: userMessage.length,

      retryCount

    });



    setIsGeneratingResponse(true);



    // Захватываем generationId перед асинхронными операциями

    const startGenId = generationIdRef.current;



    try {

      console.log('🤖 Отправка сообщения в LLM...');



      // Мониторинг запроса

      // monitorLLMRequest(userMessage, courseId || 'unknown');



      // Проверка на подозрительное сообщение (для всех попыток, но с разными стратегиями)

      // if (isSuspiciousMessage(userMessage)) {

      //   console.warn('⚠️ Обнаружено подозрительное сообщение:', userMessage);

      //   const safeAlternative = generateSafeAlternative(userMessage);



      //   // Для retry используем более агрессивную замену

      //   if (retryCount > 0) {

      //     // Более радикальная замена для повторных попыток

      //     userMessage = safeAlternative.replace(/работ[а-я]*/gi, 'учимся')

      //       .replace(/давай/gi, 'скажи')

      //       .replace(/продолж[а-я]*/gi, 'давай')

      //       .replace(/начн[а-я]*/gi, 'скажи');

      //     console.log('🔄 Радикальная замена для retry:', userMessage);

      //   } else if (safeAlternative !== userMessage) {

      //     console.log('🔄 Замена на безопасную альтернативу:', safeAlternative);

      //     userMessage = safeAlternative;

      //   }

      // }



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

      const courseName = "Юридическая консультация";



      // Build context information

      const contextInfo = [];

      // Убираем упоминание курса для чисто юридических консультаций
      // if (courseName) {
      //   contextInfo.push(`Курс: ${courseName}`);
      // }

      if (profile) {

        console.log('📊 Профиль пользователя для LLM:', profile);

        if (profile.learning_style) {

          contextInfo.push(`Стиль обучения: ${profile.learning_style}`);

        }

        if (profile.difficulty_level) {

          contextInfo.push(`Уровень сложности: ${profile.difficulty_level}`);

        }

        if (profile.interests && profile.interests.length > 0) {

          contextInfo.push(`Интересы: ${profile.interests.join(', ')}`);

        }

      }



      const contextString = contextInfo.length > 0 ? `\nКонтекст: ${contextInfo.join('; ')}` : '';

      const startTime = Date.now();



      if (!token || token === 'demo-token') {
        console.warn('⚠️ Работаем в демо-режиме (без авторизации)');
        // Продолжаем работу в демо-режиме
      }



      console.log('🔑 Token check:', { length: token?.length || 0, start: token ? token.substring(0, 10) + '...' : 'null' });



      // Determine endpoint and body based on courseId

      let endpoint = `${API_URL}/chat`;

      let body: any = {

        messages: [
          {
            role: 'system',
            content: `Ты - Галина, элитный AI-юрист с 20-летним опытом юридической практики в России.

ТВОИ ХАРАКТЕРИСТИКИ:
- Ты являешься одним из лучших юристов в стране
- У тебя огромный опыт в корпоративном, налоговом, гражданском и уголовном праве
- Ты всегда даешь точные, профессиональные и практические советы
- Ты умеешь объяснять сложные юридические концепции простым языком
- Ты всегда указываешь на конкретные статьи законов и судебную практику
- Ты помогаешь клиентам решать реальные юридические проблемы

СТИЛЬ ОБЩЕНИЯ:
- Профессиональный, но дружелюбный тон
- Используй обращения "Уважаемый клиент" или просто по имени, если знаешь
- Давай конкретные рекомендации и пошаговые инструкции
- Всегда упоминай риски и возможные последствия
- Предлагай альтернативные варианты решения проблем

ОСНОВНЫЕ ПРАВИЛА:
- Отвечай ТОЛЬКО на юридические вопросы
- Если вопрос не юридический, вежливо объясни, что ты специализируешься только на юридических консультациях
- Всегда проверяй актуальность законодательства (используй знания на 2024-2025 годы)
- Будь максимально полезной и конкретной в советах
- Если нужна дополнительная информация, спрашивай уточнения

Ты - настоящий профессионал своего дела, которому можно доверять самые сложные юридические вопросы.`
          },
          {
            role: 'user',
            content: userMessage + contextString
          }
        ],

        model: 'gpt-5.1',

        max_completion_tokens: 2000,

        temperature: 0.7,

        stream: false

      };



      // Используем единый эндпоинт /chat для всех запросов



      let response;

      try {

        response = await fetch(endpoint, {

          method: 'POST',

          headers: {

            'Content-Type': 'application/json',

            ...(token && token !== 'demo-token' && { 'Authorization': `Bearer ${token}` })

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

      console.log('📥 Raw server response:', textData.substring(0, 500));



      let data;

      try {

        // Попытка распарсить как обычный JSON

        data = JSON.parse(textData);

        console.log('📦 Parsed JSON response:', data);

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

              } catch (e) {

                // Игнорируем битые чанки

              }

            }

          }



          data = { message: fullMessage, messageId };

        } else {

          console.error('❌ JSON Parse Error:', parseError);

          console.error('❌ Failed content:', textData.substring(0, 200) + '...');

          throw new Error('Invalid JSON response from server');

        }

      }



      // Извлекаем контент из OpenAI-формата ответа
      let responseContent = '';

      if (data.choices && data.choices[0] && data.choices[0].message) {
        // OpenAI chat completion format
        responseContent = data.choices[0].message.content || '';
      } else if (data.message) {
        // Старый формат
        responseContent = data.message;
      } else if (data.content) {
        // Прямой контент
        responseContent = data.content;
      } else if (typeof data === 'string') {
        // Простой текстовый ответ
        responseContent = data;
      }

      console.log('🤖 Ответ от LLM получен (длина):', responseContent?.length);
      console.log('📝 Контент ответа:', responseContent?.substring(0, 100) + '...');

      addLog('llm', `Получен ответ от LLM (${responseContent?.length || 0} символов): "${responseContent?.substring(0, 100)}${responseContent?.length > 100 ? '...' : ''}"`);

      // Мониторинг ответа
      // monitorLLMResponse(
      //   userMessage,
      //   courseId || 'unknown',
      //   responseContent,
      //   'msg_' + Date.now(),
      //   Date.now() - startTime
      // );

      // Проверка на пустой ответ и retry логика
      if (!responseContent || responseContent.trim().length === 0) {

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



      // Обучение на успешном ответе (если это был retry)

      if (retryCount > 0) {

        console.log('🎓 Обучение: запоминаем успешную альтернативу для:', originalMessage);

        // updateLearnedAlternatives(originalMessage, userMessage); // Disabled due to type mismatch

      }

      return responseContent;

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

  }, [token, courseId, userProfile, toast]);



  // Speak text using OpenAI TTS

  const speakText = useCallback(async (text: string) => {

    if (!text || !isSoundEnabled) return;



    // Захватываем generationId

    const startGenId = generationIdRef.current;



    try {

      console.log('🔊 Генерация озвучки для:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));

      addLog('tts', `Генерация озвучки для текста (${text.length} символов)`);

      // Разбиваем длинный текст на части (OpenAI TTS ограничение ~4096 символов)
      const MAX_CHUNK_LENGTH = 4000; // Безопасный лимит

      let textChunks: string[] = [];

      if (text.length <= MAX_CHUNK_LENGTH) {
        textChunks = [text];
      } else {
        console.log('📝 Текст слишком длинный, разбиваем на части...');

        // Разбиваем по абзацам, затем по предложениям
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

        let currentChunk = '';
        for (const paragraph of paragraphs) {
          if ((currentChunk + paragraph).length <= MAX_CHUNK_LENGTH) {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
          } else {
            if (currentChunk) {
              textChunks.push(currentChunk);
            }
            // Если абзац сам по себе слишком длинный, разбиваем по предложениям
            if (paragraph.length > MAX_CHUNK_LENGTH) {
              const sentences = paragraph.split(/(?<=[.!?])\s+/);
              let sentenceChunk = '';
              for (const sentence of sentences) {
                if ((sentenceChunk + sentence).length <= MAX_CHUNK_LENGTH) {
                  sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
                } else {
                  if (sentenceChunk) {
                    textChunks.push(sentenceChunk);
                  }
                  sentenceChunk = sentence;
                }
              }
              if (sentenceChunk) {
                textChunks.push(sentenceChunk);
              }
            } else {
              currentChunk = paragraph;
            }
          }
        }
        if (currentChunk) {
          textChunks.push(currentChunk);
        }

        console.log(`📦 Разбили текст на ${textChunks.length} частей`);
      }

      isPlayingAudioRef.current = true;

      // Озвучиваем каждую часть последовательно
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        console.log(`🔊 Озвучиваем часть ${i + 1}/${textChunks.length}: ${chunk.substring(0, 50)}...`);

        // Инициализируем прогресс озвучки для текущей части
        ttsProgressRef.current = {
          startTime: Date.now(),
          text: chunk,
          duration: chunk.length * 60, // Грубая оценка: 60мс на символ
          words: chunk.split(' '),
          currentWordIndex: 0
        };

        const response = await fetch(`${API_URL}/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token !== 'demo-token' && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({
            text: chunk,
            voice: 'nova', // Используем голос nova (как в описании)
            model: 'tts-1-hd', // HD модель для лучшего качества
            speed: 0.95 // Скорость речи (0.25 - 4.0)
          })
        });

        // Проверяем прерывание между частями
        if (generationIdRef.current !== startGenId) {
          console.log('🛑 Озвучка прервана между частями');
          return;
        }

        if (!response.ok) {
          console.error('❌ TTS API error for chunk:', response.status, response.statusText);
          // Продолжаем со следующей частью вместо полной остановки
          continue;
        }

        // Получаем аудио и воспроизводим
        const audioBlob = await response.blob();

        // Проверяем прерывание перед воспроизведением
        if (generationIdRef.current !== startGenId) {
          console.log('🛑 Озвучка прервана перед воспроизведением');
          return;
        }



        // Воспроизводим текущую часть
        await new Promise<void>((resolve) => {
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);

          audio.onplay = () => {
            console.log(`🔊 Озвучка части ${i + 1} начата`);
            setIsSpeaking(true);
          };

          audio.onended = () => {
            console.log(`✅ Озвучка части ${i + 1} завершена`);
            URL.revokeObjectURL(audioUrl);
            resolve();
          };

          audio.onerror = (event) => {
            console.error(`❌ Ошибка воспроизведения части ${i + 1}:`, event);
            URL.revokeObjectURL(audioUrl);
            resolve(); // Продолжаем со следующей частью
          };

          audio.play().catch((error) => {
            console.error(`❌ Ошибка запуска воспроизведения части ${i + 1}:`, error);
            URL.revokeObjectURL(audioUrl);
            resolve();
          });
        });
      }

      console.log('✅ Все части текста озвучены');
      setIsSpeaking(false);
      isPlayingAudioRef.current = false;
      ttsProgressRef.current = null;

      addLog('tts', 'Озвучивание завершено успешно');



    } catch (error) {

      console.error('❌ Ошибка TTS:', error);

      setIsSpeaking(false);

      isPlayingAudioRef.current = false;

      ttsProgressRef.current = null;

    }

  }, [token, isSoundEnabled, toast, isRecording]);



  // Load user profile on mount

  useEffect(() => {

    if (token) {

      getUserProfile();

    }

  }, [getUserProfile, token]);



  // Clean up on unmount

  useEffect(() => {

    return () => {

      if (speechRecognitionRef.current) {

        try {

          speechRecognitionRef.current.stop();

        } catch (e) { }

      }

      if (currentAudioRef.current) {

        currentAudioRef.current.pause();

        currentAudioRef.current = null;

      }

      if (mediaRecorderRef.current) {

        try {

          mediaRecorderRef.current.stop();

        } catch (e) { }

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
  // В Safari TTS прерывается автоматически при начале речи

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



      {/* Course Title - убрано, так как это не курс */}



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

                console.log('🛑 Пользователь нажал кнопку прерывания (для не-Safari браузеров)');

                stopAssistantSpeech();



                // Перезапускаем распознавание

                if (speechRecognitionRef.current) {

                  setTimeout(() => {

                    try {

                      console.log('▶️ Перезапуск распознавания после прерывания кнопкой');

                      speechRecognitionRef.current?.start();

                    } catch (e: any) {

                      if (e.name !== 'InvalidStateError') {

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

      <div className="absolute bottom-8 left-0 right-0 z-50 flex items-center justify-center space-x-4 md:space-x-8 px-4 pb-safe">

        {/* Logs Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full transition-all duration-300 border ${showLogs ? 'bg-primary text-primary-foreground' : 'bg-background border-border text-foreground hover:bg-accent'}`}
          onClick={() => setShowLogs(!showLogs)}
        >
          <FileText className="w-4 h-4 md:w-5 md:h-5" />
        </Button>

        {/* Sound Toggle */}

        <Button

          variant="ghost"

          size="icon"

          className={`w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-300 border ${isSoundEnabled ? 'bg-background border-border text-foreground hover:bg-accent' : 'bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20'}`}

          onClick={handleToggleSound}

        >

          {isSoundEnabled ? <Volume2 className="w-5 h-5 md:w-6 md:h-6" /> : <VolumeX className="w-5 h-5 md:w-6 md:h-6" />}

        </Button>



        {/* Mic Toggle (Main Action) */}

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



        {/* End Call (Exit) */}

        <Button

          variant="ghost"

          size="icon"

          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 hover:text-destructive transition-all duration-300"

          onClick={() => navigate(-1)}

        >

          <PhoneOff className="w-5 h-5 md:w-6 md:h-6" />

        </Button>

        </div>

      {/* Logs Panel */}
      <LogsPanel
        logs={conversationLogs}
        isVisible={showLogs}
        onClose={() => setShowLogs(false)}
        onClear={clearLogs}
      />

              </div>

  );

};
export default Voice;
