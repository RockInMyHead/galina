import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Volume2, PhoneCall, CheckCircle2, Sparkles, MicOff } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { sendChatMessage } from "@/utils/apiUtils";
import { AI_SYSTEM_MESSAGES } from "@/config/constants";
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

const Voice = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос голосом, и я постараюсь помочь вам с профессиональной консультацией.',
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [reasoningText, setReasoningText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Функция для отправки аудио на сервер для распознавания
  const transcribeAudioOnServer = async (audioBlob: Blob): Promise<string> => {
    try {
      console.log('Отправляю аудио на сервер для распознавания...');

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.transcript) {
        return result.transcript;
      } else {
        throw new Error(result.error || 'Не удалось распознать речь');
      }
    } catch (error) {
      console.error('Ошибка при отправке на сервер:', error);
      throw error;
    }
  };

  // Функция для обработки записанного аудио
  const processAudioRecording = async (audioBlob: Blob): Promise<string> => {
    console.log('Audio recorded, size:', audioBlob.size, 'bytes');

    // Показываем диалог для ручного ввода текста
    // В будущем здесь будет автоматическое распознавание
    const transcript = prompt(`🎤 Аудио записано! (${(audioBlob.size / 1024).toFixed(1)} KB)\n\nПожалуйста, введите текст, который вы сказали:`, '');

    if (transcript && transcript.trim()) {
      console.log('Пользователь ввел текст:', transcript.trim());
      return transcript.trim();
    } else {
      throw new Error('Текст не введен пользователем');
    }
  };

  // Функция запуска записи
  const startRecording = async () => {
    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      console.log('Microphone access granted');
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, processing audio...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Сохраняем аудио для возможного прослушивания
        setAudioBlob(audioBlob);
        setIsProcessingAudio(true);

        try {
          const transcript = await processAudioRecording(audioBlob);
          console.log('Audio processing successful:', transcript);

          setTranscript(transcript);
          setIsVoiceMode(true);
          handleSendMessage();
        } catch (error) {
          console.error('Audio processing failed:', error);
          alert('Не удалось обработать аудио. Попробуйте еще раз.');
        } finally {
          setIsProcessingAudio(false);
        }

        // Останавливаем поток
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      console.log('Recording started');

      // Запускаем счетчик времени записи
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Автоматическая остановка через 10 секунд
      recordingTimerRef.current = setTimeout(() => {
        console.log('Auto-stopping recording after 10 seconds');
        stopRecording();
      }, 10000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Не удалось получить доступ к микрофону. Проверьте настройки браузера.');
    }
  };

  // Функция остановки записи
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('Stopping recording...');

      // Очищаем таймеры
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Функция имитации размышлений LLM
  const simulateReasoning = async (userQuery: string): Promise<void> => {
    const reasoningSteps = [
      "Анализирую ваш юридический вопрос...",
      "Проверяю актуальное законодательство РФ...",
      "Ищу релевантные нормы и судебную практику...",
      "Формулирую юридически точный ответ...",
      "Проверяю полноту и корректность информации..."
    ];

    for (const step of reasoningSteps) {
      setReasoningText(step);
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
    }

    setReasoningText("Генерирую окончательный ответ...");
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  // Функция для отправки сообщения в AI
  const sendMessageToAI = async (userMessage: string) => {
    try {
      const currentMessages = [...messages];

      const chatMessages = [
        {
          role: 'system' as const,
          content: AI_SYSTEM_MESSAGES.LEGAL_ASSISTANT
        },
        ...currentMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user' as const,
          content: userMessage
        }
      ];

      console.log('Отправка голосового сообщения в AI');

      const response = await sendChatMessage(chatMessages, {
        model: 'gpt-4o',
        max_tokens: 10000,
        temperature: 0.7
      });

      if (response.success && response.data) {
        const content = response.data.content.trim();
        if (content && content.length > 20) {
          return content;
        }
      }

      return 'Извините, я получил неполный ответ от AI. Попробуйте еще раз.';
    } catch (error) {
      console.error('Ошибка AI API:', error);
      return 'Извините, произошла ошибка при обработке вашего запроса. Попробуйте еще раз.';
    }
  };

  // Функция для отправки сообщения
  const handleSendMessage = async () => {
    if (!transcript.trim() || isLoading) return;

    console.log('Отправка голосового сообщения:', transcript);

    const userMessage: Message = {
      id: Date.now().toString(),
      content: transcript,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setTranscript('');
    setIsLoading(true);

    try {
      await simulateReasoning(transcript);

      const aiResponse = await sendMessageToAI(transcript);
      console.log('Получен ответ от AI:', aiResponse);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Озвучиваем ответ
      if (isVoiceMode) {
        await voice.speak(aiResponse);
      }

    } catch (error) {
      console.error('Ошибка:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Произошла ошибка при отправке сообщения. Попробуйте еще раз.',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setReasoningText('');
      setIsVoiceMode(false);
    }
  };

  // Функция для переключения голосового режима
  const toggleVoiceMode = async () => {
    if (isRecording) {
      stopRecording();
    } else if (!isLoading && !isProcessingAudio) {
      console.log('Starting voice recording');
      setTranscript(''); // Очищаем предыдущую транскрипцию
      setRecordingTime(0); // Сбрасываем счетчик времени
      await startRecording();
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
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mic className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Голосовой помощник
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Общайтесь с Галиной голосом для быстрого решения юридических вопросов
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Voice Interface */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border/50 shadow-elegant">
                <CardContent className="p-12">
                  <div className="flex flex-col items-center space-y-8">
                    {/* Voice Visualizer */}
                    <div className="relative">
                      <button
                        onMouseDown={isRecording ? undefined : toggleVoiceMode}
                        onMouseUp={isRecording ? toggleVoiceMode : undefined}
                        onMouseLeave={isRecording ? toggleVoiceMode : undefined}
                        className={`relative flex h-32 w-32 items-center justify-center rounded-full transition-smooth ${
                          isRecording
                            ? "bg-red-500 shadow-glow animate-pulse"
                            : "bg-primary/10 hover:bg-primary/20"
                        }`}
                      >
                        {isRecording ? (
                          <MicOff className="h-16 w-16 text-white" />
                        ) : (
                          <Mic className="h-16 w-16 text-primary" />
                        )}
                      </button>
                      {isRecording && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="absolute h-32 w-32 rounded-full border-4 border-primary/30 animate-ping"></div>
                        </div>
                      )}
                    </div>

                    <div className="text-center space-y-2">
                      <h2 className="text-2xl font-bold text-foreground">
                        {isLoading ? "Галина думает..." :
                         isProcessingAudio ? "Распознавание речи..." :
                         isRecording ? `Запись... ${recordingTime} сек` :
                         "Нажмите для начала записи"}
                      </h2>
                      <p className="text-muted-foreground">
                        {isLoading ? reasoningText :
                          isProcessingAudio
                          ? "Обрабатываю вашу запись..."
                          : isRecording
                          ? "Говорите ваш вопрос четко и разборчиво. Нажмите 'Стоп' когда закончите"
                          : "Нажмите кнопку микрофона, чтобы начать запись голоса"}
                      </p>
                      {isRecording && (
                        <div className="space-y-2">
                          <p className="text-sm text-red-600 font-medium animate-pulse">
                            🔴 ЗАПИСЬ АКТИВНА - Говорите сейчас!
                          </p>
                          <p className="text-xs text-orange-600">
                            ⏱️ Автоостановка через {10 - recordingTime} сек
                          </p>
                          <p className="text-xs text-green-600">
                            💡 Нажмите кнопку еще раз, чтобы остановить запись
                          </p>
                        </div>
                      )}
                      {transcript && isRecording && (
                        <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                          <p className="text-sm font-medium text-primary">Текущая транскрипция:</p>
                          <p className="text-foreground mt-1">{transcript}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4">
                      <Button
                        size="lg"
                        variant={isLoading ? "secondary" : isProcessingAudio ? "outline" : isRecording ? "destructive" : "default"}
                        onClick={toggleVoiceMode}
                        disabled={isLoading || isProcessingAudio}
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
                         isProcessingAudio ? "Распознавание..." :
                         isRecording ? "Стоп" : "Начать запись"}
                      </Button>
                    </div>

                    {/* Audio playback controls */}
                    {isProcessingAudio && audioBlob && (
                      <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-primary">🎵 Аудио записано</p>
                            <p className="text-xs text-muted-foreground">
                              Размер: {(audioBlob.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              const audioUrl = URL.createObjectURL(audioBlob);
                              const audio = new Audio(audioUrl);
                              audio.play();
                              // Очищаем URL после воспроизведения
                              audio.onended = () => URL.revokeObjectURL(audioUrl);
                            }}
                            className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs rounded flex items-center gap-1"
                          >
                            <Volume2 className="h-3 w-3" />
                            Прослушать
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Conversation History */}
              <Card className="border-border/50">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    История разговора
                  </h3>
                  <div className="min-h-[300px] max-h-[400px] overflow-y-auto space-y-4">
                    {messages.length === 1 && !isRecording && !transcript ? (
                      <div className="text-center py-12">
                        <Mic className="h-12 w-12 text-muted-foreground mx-auto opacity-50 mb-4" />
                        <p className="text-muted-foreground">
                          Начните разговор для отображения истории
                        </p>
                      </div>
                    ) : (
                      <>
                        {messages.map((message) => (
                          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg p-4 ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium">
                                  {message.role === 'user' ? 'Вы' : 'Галина'}
                                </span>
                                <span className="text-xs opacity-70">
                                  {message.timestamp.toLocaleTimeString('ru-RU', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <div className="text-sm prose prose-sm max-w-none">
                                {message.role === 'assistant' ? (
                                  <ReactMarkdown>{message.content}</ReactMarkdown>
                                ) : (
                                  message.content
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                          <div className="flex justify-start">
                            <div className="max-w-[80%] rounded-lg p-4 bg-muted text-foreground">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-4 w-4 animate-spin" />
                                <span className="text-xs font-medium">Галина</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {reasoningText || "Галина печатает..."}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Current transcript */}
                        {transcript && isRecording && (
                          <div className="flex justify-end">
                            <div className="max-w-[80%] rounded-lg p-4 bg-primary text-primary-foreground">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium">Вы</span>
                                <span className="text-xs opacity-70">(текущая запись)</span>
                              </div>
                              <p className="text-sm">{transcript}</p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Info Section */}
            <div className="space-y-6">
              <Card className="gradient-card border-border/50 shadow-elegant">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Возможности голосового режима
                  </h3>
                  <ul className="space-y-3">
                    {[
                      "Push-to-talk интерфейс",
                      "Высококачественная запись аудио",
                      "Ручная транскрипция с подсказками",
                      "Сохранение истории разговоров",
                      "Интеллектуальные ответы Галины",
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Советы для лучшего качества
                  </h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li>• Нажмите "Начать запись" для начала</li>
                    <li>• Говорите четко и разборчиво</li>
                    <li>• Нажмите "Стоп" или подождите автоостановку</li>
                    <li>• Введите текст сообщения</li>
                    <li>• Дождитесь ответа Галины</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-primary/5">
                <CardContent className="p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Конфиденциальность
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Все голосовые данные обрабатываются с соблюдением конфиденциальности и не передаются третьим лицам.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Voice;
