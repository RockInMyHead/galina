import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { VoiceStatus } from "@/components/chat/VoiceStatus";
import { useVoice } from "@/hooks/useVoice";
import { useFileUpload } from "@/hooks/useFileUpload";
import { sendChatMessage, textToSpeech, playAudioBlob } from "@/utils/apiUtils";
import { EXAMPLE_QUESTIONS, STORAGE_KEYS, AI_SYSTEM_MESSAGES } from "@/config/constants";
import { ChatMessage as ChatMessageType } from "@/types";
import { useState, useEffect } from "react";
import { Sparkles, Download, Plus } from "lucide-react";
import { fileToBase64, fileToText, formatFileSize, processFile } from "@/utils/fileUtils";
import { chatStorage } from "@/utils/storageUtils";
import ReactMarkdown from 'react-markdown';

const Chat = () => {
  const [message, setMessage] = useState("");

  // Загружаем сообщения из localStorage или используем дефолтные
  const [messages, setMessages] = useState<ChatMessageType[]>(() => {
    const savedMessages = chatStorage.get();
    if (savedMessages && savedMessages.length > 0) {
      // Преобразуем timestamp обратно в Date объекты
      return savedMessages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    }
    // Дефолтное приветственное сообщение
    return [{
      id: '1',
      content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос, и я постараюсь помочь вам с профессиональной консультацией.',
      role: 'assistant',
      timestamp: new Date()
    }];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [reasoningText, setReasoningText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');

  // Сохраняем сообщения в localStorage при каждом изменении
  useEffect(() => {
    chatStorage.set(messages);
  }, [messages]);

  // Функция для создания нового чата
  const startNewChat = () => {
    const welcomeMessage: ChatMessageType = {
      id: Date.now().toString(),
      content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос, и я постараюсь помочь вам с профессиональной консультацией.',
      role: 'assistant',
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
    setMessage("");
    setReasoningText('');
    setStreamingMessage('');
    setIsStreaming(false);
  };



  // Custom hooks
  const voice = useVoice({
    onTranscript: (transcript) => {
      const lowerTranscript = transcript.toLowerCase().trim();

      // Проверяем на команду завершения
      if (lowerTranscript.includes('завершить') || lowerTranscript.includes('заверши') || lowerTranscript.includes('стоп')) {
        console.log('Voice command: завершить');
        if (message.trim()) {
          setIsVoiceMode(true);
          voice.stopListening();
        }
        return;
      }

      setMessage(transcript);
      setIsVoiceMode(true);
    },
    onError: (error) => console.error('Voice error:', error),
  });

  const fileUpload = useFileUpload({
    onError: (error) => console.error('File upload error:', error),
  });

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
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400)); // 800-1200ms
    }

    setReasoningText("Генерирую окончательный ответ...");
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  // Функция для обработки streaming ответа
  const sendStreamingMessageToAI = async (userMessage: string, files: File[] = []): Promise<string> => {
    try {
      const currentMessages = [...messages];

      // Если есть файлы, добавляем их в сообщение
      let content = userMessage;
      if (files.length > 0) {
        content += '\n\nПрикрепленные файлы:';
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            // Проверяем размер файла - для больших изображений отправляем только описание
            if (file.size > 1024 * 1024) { // 1MB
              content += `\nИзображение "${file.name}" (файл слишком большой для анализа: ${formatFileSize(file.size)}, загрузите изображение меньшего размера)`;
            } else {
              const base64 = await fileToBase64(file);
              content += `\nИзображение: ${file.name} (содержимое закодировано в base64: ${base64.substring(0, 100)}...)`;
            }
          } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            // Проверяем размер файла - для больших PDF отправляем только описание
            if (file.size > 2 * 1024 * 1024) { // 2MB
              content += `\nPDF документ "${file.name}" (файл слишком большой для анализа: ${formatFileSize(file.size)}, загрузите файл меньшего размера)`;
            } else {
              try {
                const processedFile = await processFile(file);
                content += `\nPDF документ "${file.name}":\n${processedFile.content}`;
              } catch (error) {
                console.error('Error processing PDF:', error);
                content += `\nPDF документ "${file.name}" (не удалось извлечь текст: ${error.message})`;
              }
            }
          } else if (file.type.startsWith('text/') ||
                    file.name.toLowerCase().endsWith('.txt') ||
                    file.name.toLowerCase().endsWith('.doc') ||
                    file.name.toLowerCase().endsWith('.docx') ||
                    file.name.toLowerCase().endsWith('.rtf') ||
                    file.name.toLowerCase().endsWith('.odt')) {
            const text = await fileToText(file);
            content += `\nТекстовый документ "${file.name}":\n${text}`;
          } else if (file.name.toLowerCase().endsWith('.xls') ||
                    file.name.toLowerCase().endsWith('.xlsx') ||
                    file.type.includes('spreadsheet') ||
                    file.type.includes('excel')) {
            content += `\nТаблица Excel "${file.name}" (размер: ${formatFileSize(file.size)}, тип: ${file.type || 'неизвестный'})`;
          } else if (file.name.toLowerCase().endsWith('.ppt') ||
                    file.name.toLowerCase().endsWith('.pptx') ||
                    file.type.includes('presentation') ||
                    file.type.includes('powerpoint')) {
            content += `\nПрезентация PowerPoint "${file.name}" (размер: ${formatFileSize(file.size)}, тип: ${file.type || 'неизвестный'})`;
          } else {
            content += `\nФайл "${file.name}" (${file.type || 'неизвестный тип'}, размер: ${formatFileSize(file.size)})`;
          }
        }
      }

      // Определяем, какой промпт использовать
      const hasFiles = files.length > 0;
      const systemMessage = hasFiles ? AI_SYSTEM_MESSAGES.DOCUMENT_ANALYSIS : AI_SYSTEM_MESSAGES.LEGAL_ASSISTANT;

      const chatMessages = [
        {
          role: 'system' as const,
          content: systemMessage
        },
        ...currentMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user' as const,
          content
        }
      ];

      console.log('Отправка streaming запроса в AI');

      // Создаем AbortController для таймаута
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 минуты таймаут

      try {
        // Создаем streaming соединение через fetch с чтением тела как текст
        const response = await fetch('http://localhost:3001/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: chatMessages,
            model: 'gpt-4o',
            max_tokens: 16000, // Максимально длинные ответы для модульной генерации
            temperature: 0.95, // Максимальная креативность для длинных ответов
            top_p: 0.9, // Более разнообразный выбор слов
            presence_penalty: 0.2, // Активно поощряем новые темы
            frequency_penalty: 0.2, // Сильно избегаем повторений
            stream: true
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        setIsStreaming(true);
        setStreamingMessage('');
        let fullContent = '';

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Unable to read response stream');
        }

        const decoder = new TextDecoder();

        try {
          let buffer = '';
          let streamDone = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done || streamDone) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');

            // Оставляем неполную строку в буфере
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') {
                  streamDone = true;
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.content;
                  if (content && content !== fullContent) {
                    // Получаем только новый контент
                    const newContent = content.slice(fullContent.length);
                    fullContent = content;
                    setStreamingMessage(fullContent);
                    setReasoningText(`Генерирую ответ: ${fullContent.length} символов...`);
                  }
                } catch (e) {
                  // Игнорируем невалидный JSON
                  console.log('Invalid JSON in stream:', data);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
          setReasoningText('');
        }

        console.log('Streaming завершен, полный контент:', fullContent.length, 'символов');
        
        if (!fullContent || fullContent.trim().length === 0) {
          throw new Error('Получен пустой ответ от AI');
        }
        
        return fullContent;

      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('Ошибка streaming:', error);
        
        if (error.name === 'AbortError') {
          throw new Error('Превышено время ожидания ответа от сервера. Попробуйте еще раз.');
        }
        
        throw error;
      } finally {
        setIsStreaming(false);
        setReasoningText('');
      }
    } catch (outerError) {
      console.error('Outer error in sendStreamingMessageToAI:', outerError);
      throw outerError;
    }
  };

  // Обработка сохраненных запросов из localStorage
  useEffect(() => {
    // Проверяем, есть ли сохраненный запрос от шаблона
    const templateRequest = localStorage.getItem(STORAGE_KEYS.TEMPLATE_REQUEST);
    if (templateRequest) {
      localStorage.removeItem(STORAGE_KEYS.TEMPLATE_REQUEST);
      setMessage(templateRequest);
    }

    // Проверяем, есть ли запрос на сканирование
    const scanRequest = localStorage.getItem(STORAGE_KEYS.SCAN_REQUEST);
    if (scanRequest) {
      localStorage.removeItem(STORAGE_KEYS.SCAN_REQUEST);
      setMessage(scanRequest);
    }

    // Проверяем, есть ли отсканированный документ
    const scannedDocument = localStorage.getItem('scannedDocument');
    if (scannedDocument) {
      // Добавляем отсканированный документ к файлам для анализа
      const scannedFile = new File([scannedDocument], 'scanned_document.jpg', { type: 'image/jpeg' });
      setFiles([scannedFile]);
      localStorage.removeItem('scannedDocument');
    }
  }, []);


  // Функция для голосового режима
  const handleVoiceInteraction = async () => {
    console.log('handleVoiceInteraction called:', {
      isVoiceMode,
      message: message.trim(),
      isListening: voice.isListening,
      isSupported: voice.isSupported
    });

    if (isVoiceMode && message.trim()) {
      console.log('Sending voice message');
      await handleSendMessage();
      setIsVoiceMode(false);
    } else if (!voice.isListening) {
      console.log('Starting voice listening');
      if (!voice.isSupported) {
        alert('Голосовой ввод не поддерживается в этом браузере');
        return;
      }
      voice.startListening();
    } else {
      console.log('Already listening or no action needed');
    }
  };

  // Функция для озвучивания ответа с использованием OpenAI TTS
  const speakResponseWithTTS = async (text: string) => {
    try {
      console.log('Starting TTS for:', text.substring(0, 100) + '...');
      const audioBlob = await textToSpeech(text);
      
      if (audioBlob) {
        await playAudioBlob(audioBlob);
        console.log('TTS playback completed');
      } else {
        console.warn('Failed to get audio blob, falling back to browser speech');
        voice.speak(text);
      }
    } catch (error) {
      console.error('TTS error:', error);
      // Fallback to browser speech synthesis
      voice.speak(text);
    }
  };


  const sendMessageToAI = async (userMessage: string, files: File[] = []) => {
    try {
      const currentMessages = [...messages];

      // Если есть файлы, добавляем их в сообщение
      let content = userMessage;
      if (files.length > 0) {
        content += '\n\nПрикрепленные файлы:';
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            // Проверяем размер файла - для больших изображений отправляем только описание
            if (file.size > 1024 * 1024) { // 1MB
              content += `\nИзображение "${file.name}" (файл слишком большой для анализа: ${formatFileSize(file.size)}, загрузите изображение меньшего размера)`;
            } else {
              const base64 = await fileToBase64(file);
              content += `\nИзображение: ${file.name} (содержимое закодировано в base64: ${base64.substring(0, 100)}...)`;
            }
          } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            // Проверяем размер файла - для больших PDF отправляем только описание
            if (file.size > 2 * 1024 * 1024) { // 2MB
              content += `\nPDF документ "${file.name}" (файл слишком большой для анализа: ${formatFileSize(file.size)}, загрузите файл меньшего размера)`;
            } else {
              try {
                const processedFile = await processFile(file);
                content += `\nPDF документ "${file.name}":\n${processedFile.content}`;
              } catch (error) {
                console.error('Error processing PDF:', error);
                content += `\nPDF документ "${file.name}" (не удалось извлечь текст: ${error.message})`;
              }
            }
          } else if (file.type.startsWith('text/') ||
                    file.name.toLowerCase().endsWith('.txt') ||
                    file.name.toLowerCase().endsWith('.doc') ||
                    file.name.toLowerCase().endsWith('.docx') ||
                    file.name.toLowerCase().endsWith('.rtf') ||
                    file.name.toLowerCase().endsWith('.odt')) {
            const text = await fileToText(file);
            content += `\nТекстовый документ "${file.name}":\n${text}`;
          } else if (file.name.toLowerCase().endsWith('.xls') ||
                    file.name.toLowerCase().endsWith('.xlsx') ||
                    file.type.includes('spreadsheet') ||
                    file.type.includes('excel')) {
            content += `\nТаблица Excel "${file.name}" (размер: ${formatFileSize(file.size)}, тип: ${file.type || 'неизвестный'})`;
          } else if (file.name.toLowerCase().endsWith('.ppt') ||
                    file.name.toLowerCase().endsWith('.pptx') ||
                    file.type.includes('presentation') ||
                    file.type.includes('powerpoint')) {
            content += `\nПрезентация PowerPoint "${file.name}" (размер: ${formatFileSize(file.size)}, тип: ${file.type || 'неизвестный'})`;
          } else {
            content += `\nФайл "${file.name}" (${file.type || 'неизвестный тип'}, размер: ${formatFileSize(file.size)})`;
          }
        }
      }

      // Определяем, какой промпт использовать
      const hasFiles = files.length > 0;
      const systemMessage = hasFiles ? AI_SYSTEM_MESSAGES.DOCUMENT_ANALYSIS : AI_SYSTEM_MESSAGES.LEGAL_ASSISTANT;

      const chatMessages = [
        {
          role: 'system' as const,
          content: systemMessage
        },
        ...currentMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user' as const,
          content
        }
      ];

      console.log('Отправка сообщения в AI:', {
        userMessage,
        filesCount: files.length,
        systemMessage: systemMessage.substring(0, 100) + '...',
        chatMessagesCount: chatMessages.length,
        isDocumentAnalysis: hasFiles
      });

      const response = await sendChatMessage(chatMessages, {
        model: 'gpt-4o', // Улучшенная модель для юридических консультаций
        max_tokens: 16000, // Максимально длинные ответы для модульной генерации
        temperature: 0.95, // Максимальная креативность
        top_p: 0.9, // Более разнообразный выбор слов
        presence_penalty: 0.2, // Активно поощряем новые темы
        frequency_penalty: 0.2 // Сильно избегаем повторений
      });

      console.log('Ответ от AI API:', response);
      console.log('Тип ответа:', typeof response);
      console.log('Структура ответа:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        console.log('Содержимое ответа:', response.data.content);
        console.log('Длина содержимого:', response.data.content?.length);
        console.log('Тип содержимого:', typeof response.data.content);

        // Проверяем, что контент существует и не пустой
        if (!response.data.content) {
          console.warn('Ответ от AI не содержит контента');
          return 'Извините, AI не вернул ответ. Попробуйте еще раз.';
        }

        // Проверяем, что контент не пустой после trim
        const content = response.data.content.trim();
        console.log('Содержимое после trim:', content);
        console.log('Длина после trim:', content.length);

        // Проверяем минимальную длину и наличие букв
        const hasLetters = /[а-яё]/i.test(content);
        console.log('Содержит буквы:', hasLetters);

        if (content && content.length > 20 && hasLetters) {
          console.log('Ответ прошел валидацию, возвращаем');
          return content;
        } else {
          console.warn('Получен невалидный ответ от AI:', {
            originalLength: response.data.content.length,
            trimmedLength: content.length,
            hasLetters,
            preview: content.substring(0, 100)
          });
          return 'Извините, я получил неполный ответ от AI. Попробуйте:\n• Переформулировать вопрос более конкретно\n• Разбить вопрос на части\n• Задать вопрос о конкретной ситуации\n• Попробовать другой популярный вопрос';
        }
      } else {
        console.error('Ошибка API ответа:', response.error);
        throw new Error(response.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Ошибка AI API:', error);

      // Пробуем fallback - запрос без системного сообщения
      try {
        console.log('Пробуем fallback запрос без системного сообщения...');
        const fallbackMessages = [
          ...currentMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          {
            role: 'user' as const,
            content: userMessage + '\n\nПожалуйста, ответьте как опытный юрист в России.'
          }
        ];

        const fallbackResponse = await sendChatMessage(fallbackMessages, {
          model: 'gpt-4o',
          max_tokens: 5000,
          temperature: 0.7
        });

        if (fallbackResponse.success && fallbackResponse.data?.content?.trim()) {
          console.log('Fallback запрос успешен');
          return fallbackResponse.data.content.trim();
        }
      } catch (fallbackError) {
        console.error('Fallback запрос тоже не удался:', fallbackError);
      }

      return 'Извините, произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз или обратитесь позже.';
    }
  };


  const handleSendMessage = async () => {
    if ((!message.trim() && fileUpload.files.length === 0) || isLoading || isStreaming) return;

    console.log('handleSendMessage: Начинаем отправку сообщения:', message);

    const files = fileUpload.files.map(fp => fp.file);
    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      content: message,
      role: 'user',
      timestamp: new Date(),
      files: files.length > 0 ? files : undefined
    };

    console.log('handleSendMessage: Создано пользовательское сообщение:', userMessage);

    setMessages(prev => [...prev, userMessage]);
    setMessage("");
    fileUpload.clearFiles();
    setIsLoading(true);

    try {
      console.log('handleSendMessage: Запускаем имитацию размышлений LLM');
      await simulateReasoning(message);

      console.log('handleSendMessage: Вызываем streaming sendMessageToAI');
      const aiResponse = await sendStreamingMessageToAI(message, files);
      console.log('handleSendMessage: Получен ответ от AI:', aiResponse);

      const assistantMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        role: 'assistant',
        timestamp: new Date()
      };

      console.log('handleSendMessage: Создано сообщение ассистента:', assistantMessage);

      setMessages(prev => {
        console.log('handleSendMessage: Обновляем сообщения, текущее количество:', prev.length);
        const newMessages = [...prev, assistantMessage];
        console.log('handleSendMessage: Новое количество сообщений:', newMessages.length);
        return newMessages;
      });

      // Если был голосовой ввод, озвучиваем ответ
      if (isVoiceMode) {
        console.log('handleSendMessage: Озвучиваем ответ в голосовом режиме');
        await speakResponseWithTTS(aiResponse);
      }

      console.log('handleSendMessage: Завершено успешно');
    } catch (error) {
      console.error('handleSendMessage: Ошибка:', error);
      // В случае ошибки добавляем сообщение об ошибке
      const errorMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        content: 'Произошла ошибка при отправке сообщения. Попробуйте еще раз.',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setReasoningText('');
      setStreamingMessage('');
      setIsStreaming(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <Header />
      
      <main className="flex-1 flex flex-col">
        <div className="container mx-auto px-4 pb-6 flex-1 flex flex-col">

          <div className="max-w-4xl mx-auto flex flex-col flex-1">
                {/* Chat Controls */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex-1">
                    {/* Voice Status */}
                    <VoiceStatus
                      isListening={voice.isListening}
                      isVoiceMode={isVoiceMode}
                      isSpeaking={voice.isSpeaking}
                    />
                  </div>
                  <Button
                    onClick={startNewChat}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Новый чат
                  </Button>
                </div>

            {/* Chat Area */}
            <Card className="border-border/50 shadow-elegant flex-1 flex flex-col">
              <CardContent className="flex-1 flex flex-col !p-0">
                <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4">

                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}

                      {/* Loading indicator */}
                      {(isLoading || isStreaming) && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground flex-shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                            <div className={`rounded-lg p-4 ${isStreaming ? 'bg-primary/5 border border-primary/20' : 'bg-muted'}`}>
                              {isStreaming ? (
                                <div className="space-y-3">
                                  {/* Streaming content */}
                                  <div className="text-sm prose prose-sm max-w-none">
                                    <ReactMarkdown>{streamingMessage}</ReactMarkdown>
                                    <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1"></span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <div className="animate-pulse rounded-full h-2 w-2 bg-primary"></div>
                                    <span>{reasoningText}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                  <p className="text-sm text-muted-foreground">
                                    {reasoningText || "Галина печатает..."}
                                  </p>
                                </div>
                              )}
                      </div>
                    </div>
                  </div>
                      )}

                  {/* Example Questions - show only if no messages yet */}
                  {messages.length === 1 && (
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground mb-3 text-center">
                      Популярные вопросы:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {EXAMPLE_QUESTIONS.map((question, index) => (
                        <button
                          key={index}
                          className="text-left text-sm p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-smooth"
                          onClick={() => {
                            setMessage(question);
                            // Автоматически отправляем сообщение
                            setTimeout(() => handleSendMessage(), 100);
                          }}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="px-6 py-4 border-t border-border/50 flex-shrink-0">
                <ChatInput
                  message={message}
                  onMessageChange={setMessage}
                  onSendMessage={handleSendMessage}
                  onStopStreaming={() => {
                    // В будущем можно добавить логику остановки streaming
                    console.log('Остановка streaming (пока не реализована)');
                  }}
                  onVoiceToggle={handleVoiceInteraction}
                  onFileSelect={fileUpload.addFiles}
                  selectedFiles={fileUpload.files}
                  onRemoveFile={fileUpload.removeFile}
                  isLoading={isLoading}
                  isVoiceMode={isVoiceMode}
                  isListening={voice.isListening}
                  isSpeaking={voice.isSpeaking}
                  isStreaming={isStreaming}
                  onVoiceRecordingStart={() => {
                    console.log('Voice recording started');
                  }}
                  onVoiceRecordingStop={(audioBlob) => {
                    if (audioBlob) {
                      console.log('Voice recording completed, size:', audioBlob.size);
                      // Используем Web Speech API для распознавания
                      // Текст уже был получен через speech recognition во время записи
                      // В handleVoiceInteraction этот текст установлен в state
                      console.log('Voice message ready to send:', message);
                      if (message.trim()) {
                        setTimeout(() => handleSendMessage(), 100);
                      }
                    }
                  }}
                  />
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Chat;
