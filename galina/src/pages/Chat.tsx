import React from "react";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { useFileUpload } from "@/hooks/useFileUpload";
import { AI_SYSTEM_MESSAGES } from "@/config/constants";
import { ChatMessage as ChatMessageType } from "@/types";
import { useState, useRef } from "react";
import { Sparkles, Plus } from "lucide-react";
import { fileToText, extractTextFromDOCX } from "@/utils/fileUtils";
import { chatStorage } from "@/utils/storageUtils";
import { quickProcess } from "@/utils/responseProcessor";
import ReactMarkdown from 'react-markdown';
import { useToast } from "@/hooks/use-toast";

// Content size limits to prevent data leaks and token overuse
const MAX_DOCUMENT_CONTENT_LENGTH = 10000; // 10KB of text content
const MAX_PDF_CONTENT_LENGTH = 5000; // 5KB for PDF content
const MAX_DOCX_CONTENT_LENGTH = 5000; // 5KB for DOCX content

// Feature flag for advanced reasoning pipeline - only for complex queries
const _ENABLE_ADVANCED_REASONING = process.env.NODE_ENV === 'development' || localStorage.getItem('advanced-reasoning') === 'true';

// Chat interaction phases for unified state management
type ChatPhase = 'idle' | 'reasoning' | 'streaming' | 'loading' | 'error';






// Truncate document content to prevent data leaks
const truncateDocumentContent = (content: string, maxLength: number, fileName: string): string => {
  if (content.length <= maxLength) {
    return content;
  }

  const truncated = content.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const safeTruncated = lastSpace > maxLength * 0.8 ? truncated.substring(0, lastSpace) : truncated;

  return `${safeTruncated}...\n\n[СОДЕРЖИМОЕ ДОКУМЕНТА "${fileName.toUpperCase()}" ОБРЕЗАНО ДЛЯ ЭКОНОМИИ ТОКЕНОВ. ПОЛНЫЙ ТЕКСТ ДОСТУПЕН В ЗАГРУЖЕННОМ ФАЙЛЕ.]`;
};

const Chat = () => {
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  // Загружаем сообщения из localStorage или используем дефолтные
  const [messages, setMessages] = useState<ChatMessageType[]>(() => {
    const savedMessages = chatStorage.get() as any[];
    if (savedMessages && savedMessages.length > 0) {
      // Преобразуем timestamp обратно в Date объекты
      return savedMessages.map((msg: any) => ({
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

  // Unified chat phase state machine
  const [chatPhase, setChatPhase] = useState<ChatPhase>('idle');
  const [reasoningText, setReasoningText] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');

  // Derived state flags for backward compatibility
  const isLoading = chatPhase === 'loading';
  const isStreaming = chatPhase === 'streaming';
  const isReasoning = chatPhase === 'reasoning';
  const _hasError = chatPhase === 'error';

  // Privacy/Security: Track user consent for personal data processing
  const [_hasPersonalDataConsent, setHasPersonalDataConsent] = useState(() => {
    return localStorage.getItem('personalDataConsent') === 'true';
  });

  // Concurrency control: Track current request ID for state updates
  const currentRequestIdRef = useRef<string | null>(null);
  const currentOperationRef = useRef<AbortController | null>(null);

  const fileUpload = useFileUpload();

  // Handle user consent for personal data processing
  const _handlePersonalDataConsent = (consented: boolean) => {
    setHasPersonalDataConsent(consented);
    localStorage.setItem('personalDataConsent', consented.toString());
  };

  // Start new chat - cancel any ongoing operations
  const startNewChat = () => {
    // Cancel any ongoing operations
    if (currentOperationRef.current) {
      console.log('🛑 Отмена операций при начале нового чата');
      currentOperationRef.current.abort();
      currentOperationRef.current = null;
    }

    // Reset all states
    const welcomeMessage: ChatMessageType = {
      id: Date.now().toString(),
      content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос, и я постараюсь помочь вам с профессиональной консультацией.',
      role: 'assistant',
      timestamp: new Date()
    };

    setMessages([welcomeMessage]);
    setMessage("");
    setChatPhase('idle');
    setReasoningText('');
    setStreamingMessage('');
    fileUpload.clearFiles();
    currentRequestIdRef.current = null;

    // Save to localStorage
    chatStorage.set([welcomeMessage]);
  };

  // Handle sending message
  const handleSendMessage = async () => {
    if ((!message.trim() && fileUpload.files.length === 0) || chatPhase !== 'idle') return;

    // Generate unique request ID for concurrency control
    const requestId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    currentRequestIdRef.current = requestId;

    const userMessageText = message.trim();

    console.log('handleSendMessage: Начинаем отправку сообщения:', message, 'requestId:', requestId);

    const files = fileUpload.files.map(fp => fp.file);
    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      content: message,
      role: 'user',
      timestamp: new Date(),
      files: files.length > 0 ? files : undefined
    };

    // Add message to chat synchronously
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setMessage("");
    fileUpload.clearFiles();
    setChatPhase('loading');

    try {
      // Check for uploaded file in last message
      const lastMessage = updatedMessages[updatedMessages.length - 1];
      const hasUploadedFile = lastMessage && lastMessage.uploadedFile;

      let aiResponse: string;
      let finalResponse: string;

      if (hasUploadedFile) {
        console.log('handleSendMessage: Обнаружен загруженный файл, запускаем анализ документа');
        // For uploaded files, use special document analysis mode
        aiResponse = await sendStreamingMessageToAI(typeof userMessage.content === 'string' ? userMessage.content : 'Uploaded file analysis', files, updatedMessages, requestId);
        console.log('handleSendMessage: Получен анализ документа от AI:', aiResponse);

        // Apply post-processing for document analysis too
        console.log('handleSendMessage: Применяем постобработку анализа документа');
        const processedResponse = quickProcess(aiResponse, 'Результаты анализа документа');
        finalResponse = processedResponse.markdown;

        console.log('handleSendMessage: Постобработка анализа завершена. Статистика:', processedResponse.statistics);
      } else {
        // Send message to AI
        console.log('handleSendMessage: Отправляем сообщение в AI');
        aiResponse = await sendStreamingMessageToAI(userMessageText, files, updatedMessages, requestId);
        console.log('handleSendMessage: Получен ответ от AI:', aiResponse);

        // Apply post-processing
        const processedResponse = quickProcess(aiResponse, 'Юридическая консультация');
        finalResponse = processedResponse.markdown;

        console.log('handleSendMessage: Постобработка завершена. Статистика:', processedResponse.statistics);
      }

      const assistantMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        content: finalResponse,
        role: 'assistant',
        timestamp: new Date()
      };

      console.log('handleSendMessage: Создано сообщение ассистента:', assistantMessage);

      setMessages(prev => {
        console.log('handleSendMessage: Обновляем сообщения, текущее количество:', prev.length);
        const newMessages = [...prev, assistantMessage];
        console.log('handleSendMessage: Новое количество сообщений:', newMessages.length);

        // Save to localStorage
        chatStorage.set(newMessages);

        return newMessages;
      });

      console.log('handleSendMessage: Завершено успешно');
    } catch (error: unknown) {
      console.error('handleSendMessage: Ошибка:', error);
      const errorMsg = error?.message || 'неизвестная ошибка';

      // Safari-specific error handling
      if (error instanceof TypeError && error.message.includes('CORS')) {
        console.error('🚫 Safari CORS Error:', error.message);
        toast({
          title: "Ошибка CORS в Safari",
          description: "Safari блокирует запрос. Попробуйте Chrome/Firefox или обновите страницу.",
          variant: "destructive"
        });
      } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('🌐 Safari Network Error:', error.message);
        toast({
          title: "Ошибка подключения",
          description: "Safari не может подключиться к серверу. Проверьте интернет-соединение.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Ошибка",
          description: errorMsg,
          variant: "destructive"
        });
      }

      const errorMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        content: 'Извините, произошла ошибка при обработке вашего запроса. Попробуйте еще раз.',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatPhase('idle');
      setStreamingMessage('');
    }
  };

  // Generate fallback response for when API fails
  const generateFallbackResponse = (userQuery: string | ChatMessageType | { type: string; text?: string; image_url?: { url: string } }[]): string => {
    // Extract string from content
    let queryString = '';
    if (typeof userQuery === 'string') {
      queryString = userQuery;
    } else if (Array.isArray(userQuery)) {
      // If it's an array (multimodal content)
      queryString = userQuery.find(item => item.type === 'text')?.text || userQuery.map(item =>
        item.type === 'text' ? item.text : ''
      ).filter(Boolean).join(' ') || 'ваш вопрос';
    } else if (userQuery && typeof userQuery === 'object' && 'content' in userQuery) {
      // If it's ChatMessageType
      const content = userQuery.content;
      queryString = typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.find(item => item.type === 'text')?.text || 'ваш вопрос'
          : 'ваш вопрос';
      } else {
      queryString = 'ваш вопрос';
    }

    // Generate a basic fallback response
    return `Я понимаю ваш вопрос: "${queryString}".

К сожалению, в данный момент я не могу предоставить полноценную консультацию из-за технических проблем.

Рекомендую обратиться к квалифицированному юристу для получения профессиональной помощи. Вы также можете попробовать переформулировать вопрос или обратиться позже.

Если у вас есть срочный юридический вопрос, рекомендую обратиться в юридическую консультацию или к адвокату.`;
  };

  // Send message to AI with streaming
  const sendStreamingMessageToAI = async (
    userMessage: string,
    files: File[] = [],
    currentMessages: ChatMessageType[],
    _requestId?: string
  ): Promise<string> => {
    try {
      const messagesToUse = currentMessages || [...messages];

      // Build attachment context for files
      const attachmentContext = await buildAttachmentContext(files);
      const content = userMessage + attachmentContext;

      // Determine which prompt to use
      const hasFiles = files.length > 0;
      const systemMessage = hasFiles ? AI_SYSTEM_MESSAGES.DOCUMENT_ANALYSIS : AI_SYSTEM_MESSAGES.LEGAL_ASSISTANT;

      const chatMessages: Array<{
        role: string;
        content: string | Array<{
          type: 'text' | 'image_url';
          text?: string;
          image_url?: { url: string };
        }>;
      }> = [
        { role: 'system', content: systemMessage },
        ...messagesToUse.slice(-10).map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : 'message content'
        })),
        { role: 'user', content }
      ];

      console.log('sendStreamingMessageToAI: Отправка в API, messages count:', chatMessages.length);

      // For now, return a simple response
      // In production, this would call the actual API
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(`Я получил ваше сообщение: "${userMessage}". Это тестовый ответ. В рабочей версии здесь будет полноценная юридическая консультация.`);
        }, 1000);
      });
    } catch (error: unknown) {
      console.error('Error in sendStreamingMessageToAI:', error);

      // If it's an OpenAI API error, use fallback response
      if (error.message && (error.message.includes('500') || error.message.includes('OpenAI') || error.message.includes('Internal Server'))) {
        console.warn('⚠️ OpenAI API недоступен, используем fallback ответ');
        return generateFallbackResponse(userMessage);
      }

      throw error;
    }
  };

  // Build attachment context for files
  const buildAttachmentContext = async (files: File[]): Promise<string> => {
    if (files.length === 0) return '';

    let attachmentContext = '\n\nПРИКРЕПЛЕННЫЕ ДОКУМЕНТЫ:\n';

    for (const file of files) {
      try {
        let fileContent = '';

        if (file.type === 'application/pdf') {
          fileContent = await fileToText(file);
          fileContent = truncateDocumentContent(fileContent, MAX_PDF_CONTENT_LENGTH, file.name);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          fileContent = await extractTextFromDOCX(file);
          fileContent = truncateDocumentContent(fileContent, MAX_DOCX_CONTENT_LENGTH, file.name);
        } else if (file.type.startsWith('text/')) {
          fileContent = await fileToText(file);
          fileContent = truncateDocumentContent(fileContent, MAX_DOCUMENT_CONTENT_LENGTH, file.name);
        }

        attachmentContext += `\n--- ФАЙЛ: ${file.name} ---\n${fileContent}\n`;
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        attachmentContext += `\n--- ФАЙЛ: ${file.name} ---\n[ОШИБКА ОБРАБОТКИ ФАЙЛА]\n`;
      }
    }

    return attachmentContext;
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <Header />
      
      <main className="flex-1 flex flex-col">
        <div className="container mx-auto px-4 pb-6 flex-1 flex flex-col">

          <div className="max-w-4xl mx-auto flex flex-col flex-1">
            {/* Chat Controls */}
            <div className="flex justify-center items-center mb-4">
              <Button
                onClick={startNewChat}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="font-medium">Новый чат</span>
              </Button>
            </div>

            {/* Chat Area */}
            <Card className="border-border/50 shadow-elegant flex-1 flex flex-col">
              <CardContent className="flex-1 flex flex-col !p-0">
                <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4">

                  {messages.map((msg) => (
                    <ChatMessage
                      key={msg.id}
                      message={msg}
                    />
                  ))}

                  {isReasoning && reasoningText && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-muted-foreground mb-1">Анализирую запрос...</div>
                        <div className="text-sm">{reasoningText}</div>
                      </div>
                    </div>
                  )}

                  {isStreaming && streamingMessage && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-muted-foreground mb-1">Печатает...</div>
                        <div className="text-sm">
                          <ReactMarkdown>{streamingMessage}</ReactMarkdown>
                        </div>
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
                    onFileSelect={fileUpload.addFiles}
                    selectedFiles={fileUpload.files}
                    onRemoveFile={fileUpload.removeFile}
                    isLoading={isLoading}
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