import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { useVoice } from "@/hooks/useVoice";
import { useFileUpload } from "@/hooks/useFileUpload";
import { sendChatMessage } from "@/utils/apiUtils";
import { EXAMPLE_QUESTIONS, STORAGE_KEYS, AI_SYSTEM_MESSAGES, API_CONFIG } from "@/config/constants";
import { ChatMessage as ChatMessageType } from "@/types";
import { useState, useEffect } from "react";
import { Sparkles, Download, Plus } from "lucide-react";
import { fileToBase64, fileToText, formatFileSize, processFile, extractTextFromDOCX } from "@/utils/fileUtils";
import { chatStorage } from "@/utils/storageUtils";
import { quickProcess } from "@/utils/responseProcessor";
import ReactMarkdown from 'react-markdown';

const Chat = () => {
  const [message, setMessage] = useState("");
  const voice = useVoice();

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
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [reasoningText, setReasoningText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');

  // Сохраняем сообщения в localStorage при каждом изменении
  useEffect(() => {
    chatStorage.set(messages);
  }, [messages]);

  // Обработка выбранного шаблона документа при загрузке страницы
  useEffect(() => {
    const selectedTemplate = localStorage.getItem('selectedTemplate');
    const templateRequest = localStorage.getItem('templateRequest');

    if (selectedTemplate && templateRequest) {
      // Очищаем данные из localStorage
      localStorage.removeItem('selectedTemplate');
      localStorage.removeItem('templateRequest');

      // Создаем сообщение от пользователя
      const userMessage: ChatMessageType = {
        id: Date.now().toString(),
        content: templateRequest,
        role: 'user',
        timestamp: new Date()
      };

      // Добавляем сообщение в чат
      setMessages(prev => [...prev, userMessage]);

      // Автоматически отправляем запрос к AI
      setTimeout(() => {
        handleSendMessage();
      }, 500); // Небольшая задержка для плавности
    }
  }, []);

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


  const fileUpload = useFileUpload({
    onError: (error) => console.error('File upload error:', error),
  });

  // Функция настоящего процесса размышлений LLM
  const simulateReasoning = async (userQuery: string): Promise<void> => {
    try {
      console.log('🤔 Начинаем настоящий процесс размышлений LLM');

      // Создаем запрос для генерации цепочки размышлений
      const reasoningPrompt = `Ты - Галина, элитный AI-юрист. Проанализируй этот вопрос пользователя и создай цепочку размышлений (ровно 5 шагов), которая покажет твой мыслительный процесс.

Вопрос пользователя: "${userQuery}"

Требования к размышлениям:
- РОВНО 5 шагов размышления
- Каждый шаг должен быть конкретным и содержательным
- Определить тип правовой проблемы
- Указать ключевые нормы законодательства
- Оценить возможные риски и последствия
- Определить оптимальную стратегию действий
- Сформулировать ключевые выводы

Формат вывода: только шаги размышлений, каждый с новой строки, без нумерации или маркеров.`;

      const reasoningMessages = [
        {
          role: 'system' as const,
          content: 'Ты - Галина, опытный юрист. Создай реалистичную цепочку размышлений для анализа юридического вопроса.'
        },
        {
          role: 'user' as const,
          content: reasoningPrompt
        }
      ];

      console.log('📝 Отправляем запрос на генерацию размышлений');

      const reasoningResponse = await sendChatMessage(reasoningMessages, {
        model: 'gpt-5.1',
        max_completion_tokens: 800,
        temperature: 0.7
      });

      if (reasoningResponse.success && reasoningResponse.data?.content) {
        const reasoningText = reasoningResponse.data.content.trim();
        const reasoningSteps = reasoningText.split('\n').filter(step => step.trim().length > 0);

        console.log('🧠 Сгенерированы шаги размышлений:', reasoningSteps.length);

        // Показываем каждый шаг размышлений с реалистичной задержкой
        for (let i = 0; i < reasoningSteps.length; i++) {
          const step = reasoningSteps[i].trim();
          if (step.length > 0) {
            setReasoningText(step);
            // Для 5 шагов используем комфортную задержку (1.2-2 секунды)
            await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 800));
          }
        }

        console.log('✅ Процесс размышлений завершен');
      } else {
        console.warn('⚠️ Не удалось сгенерировать размышления, используем fallback');

        // Fallback на простые шаги
        const fallbackSteps = [
          "Анализирую юридические аспекты вашего вопроса...",
          "Определяю применимые нормы законодательства РФ...",
          "Оцениваю потенциальные правовые последствия...",
          "Формулирую рекомендации на основе анализа..."
        ];

        for (const step of fallbackSteps) {
      setReasoningText(step);
          await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
        }
      }

      setReasoningText("Готовлю окончательный ответ на основе анализа...");
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error('❌ Ошибка в процессе размышлений:', error);

      // Emergency fallback
      setReasoningText("Анализирую ваш вопрос...");
      await new Promise(resolve => setTimeout(resolve, 500));
      setReasoningText("Готовлю юридическую консультацию...");
    await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  // Функция для обработки streaming ответа с модульной генерацией
  const sendStreamingMessageToAI = async (userMessage: string, files: File[] = []): Promise<string> => {
    try {
      const currentMessages = [...messages];
      const lastMessage = currentMessages[currentMessages.length - 1];

      let hasUploadedFile = false;
      let uploadedFileData: ChatMessageType['uploadedFile'] | null = null;
      let isDocumentAnalysis = false;

      if (lastMessage && lastMessage.uploadedFile) {
        hasUploadedFile = true;
        uploadedFileData = lastMessage.uploadedFile;
        isDocumentAnalysis =
          userMessage.includes('Проанализируй его содержимое') ||
                           userMessage.includes('заполнением или создай соответствующий шаблон');
      }

      // Если добавлены новые файлы, инлайн-расширяем пользовательское сообщение
      let content = userMessage;
      if (files.length > 0) {
        content += '\n\nПрикрепленные файлы:';
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            if (file.size > 1024 * 1024) {
              content += `\nИзображение "${file.name}" (файл слишком большой для анализа: ${formatFileSize(file.size)}, загрузите изображение меньшего размера)`;
            } else {
            const base64 = await fileToBase64(file);
            content += `\nИзображение: ${file.name} (содержимое закодировано в base64: ${base64.substring(0, 100)}...)`;
            }
          } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            if (file.size > 2 * 1024 * 1024) {
              content += `\nPDF документ "${file.name}" (файл слишком большой для анализа: ${formatFileSize(file.size)}, загрузите файл меньшего размера)`;
          } else {
              try {
                const processedFile = await processFile(file);
                content += `\nPDF документ "${file.name}":\n${processedFile.content}`;
              } catch (error: any) {
                console.error('Error processing PDF:', error);
                content += `\nPDF документ "${file.name}" (не удалось извлечь текст: ${error?.message || error})`;
              }
            }
          } else if (file.name.toLowerCase().endsWith('.docx') || file.type.includes('word')) {
            try {
              const text = await extractTextFromDOCX(file);
              content += `\nДокумент Word "${file.name}":\n${text}`;
            } catch (error: any) {
              console.error('Error processing DOCX:', error);
              content += `\nДокумент Word "${file.name}" (не удалось извлечь текст: ${error?.message || error})`;
            }
          } else if (file.name.toLowerCase().endsWith('.doc')) {
            content += `\nДокумент "${file.name}" имеет формат .doc, который не поддерживается для автоматического анализа. Сохраните файл в формате DOCX или PDF и повторите попытку.`;
          } else if (
            file.type.startsWith('text/') ||
                    file.name.toLowerCase().endsWith('.txt') ||
                    file.name.toLowerCase().endsWith('.rtf') ||
            file.name.toLowerCase().endsWith('.odt')
          ) {
            const text = await fileToText(file);
            content += `\nТекстовый документ "${file.name}":\n${text}`;
          } else if (
            file.name.toLowerCase().endsWith('.xls') ||
                    file.name.toLowerCase().endsWith('.xlsx') ||
                    file.type.includes('spreadsheet') ||
            file.type.includes('excel')
          ) {
            content += `\nТаблица Excel "${file.name}" (размер: ${formatFileSize(file.size)}, тип: ${file.type || 'неизвестный'})`;
          } else if (
            file.name.toLowerCase().endsWith('.ppt') ||
                    file.name.toLowerCase().endsWith('.pptx') ||
                    file.type.includes('presentation') ||
            file.type.includes('powerpoint')
          ) {
            content += `\nПрезентация PowerPoint "${file.name}" (размер: ${formatFileSize(file.size)}, тип: ${file.type || 'неизвестный'})`;
          } else {
            content += `\nФайл "${file.name}" (${file.type || 'неизвестный тип'}, размер: ${formatFileSize(file.size)})`;
          }
        }
      }

      // Обработка анализа документов
      if (isDocumentAnalysis && hasUploadedFile && uploadedFileData) {
        console.log('📄 Начинаем анализ документа');

        const analysisPrompt = `Ты - Галина, опытный AI-юрист. Пользователь загрузил документ для анализа.

ТВОЯ ЗАДАЧА:
1. Проанализируй изображение документа и извлеки всю видимую информацию
2. Определи тип документа (паспорт, договор, свидетельство, справка и т.д.)
3. Найди все персональные данные, которые можно извлечь:
   - ФИО (полностью)
   - Дата рождения
   - Паспортные данные (серия, номер, когда и кем выдан)
   - Адреса регистрации/проживания
   - Контактные данные (телефон, email)
   - Другие идентифицирующие данные

4. После анализа сообщи пользователю:
   - Какой тип документа ты распознала
   - Какие данные удалось извлечь
   - Какие данные пользователь может использовать для заполнения документов
   - Предложи варианты использования этих данных

ВАЖНО:
- Будь максимально точным в извлечении данных
- Если данные трудно прочитать, укажи это
- Не придумывай данные, которых нет на изображении
- Будь полезным и предложи конкретные действия

Ответь на русском языке в дружелюбной форме.`;

        const analysisMessages = [
          {
            role: 'system' as const,
            content: 'Ты - Галина, опытный AI-юрист, специализирующийся на анализе документов.',
          },
          {
            role: 'user' as const,
            content: [
              {
                type: 'text',
                text: analysisPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: uploadedFileData.data,
                },
              },
            ],
          },
        ];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        try {
          const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: analysisMessages,
              model: 'gpt-5.1',
              max_completion_tokens: 1500,
              temperature: 0.3,
              stream: true,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return await new Promise<string>((resolve, reject) => {
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            if (!reader) {
              reject(new Error('Response body is not readable'));
              return;
            }

            const readStream = async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) {
                    resolve(fullContent);
                    break;
                  }

                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n');

                  for (const line of lines) {
                    if (!line.startsWith('data: ')) {
                      continue;
                    }

                      const data = line.slice(6);
                      if (data === '[DONE]') {
                        resolve(fullContent);
                        return;
                      }

                      try {
                        const parsed = JSON.parse(data);
                      const piece = parsed.choices?.[0]?.delta?.content;
                      if (piece) {
                        fullContent += piece;
                          setStreamingMessage(fullContent);
                        }
                    } catch (streamError) {
                      console.warn('⚠️ Failed to parse streaming JSON:', data, streamError);
                    }
                  }
                }
              } catch (error) {
                reject(error);
              }
            };

            readStream();
          });
        } catch (error) {
          console.error('Ошибка анализа документа:', error);
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      }

      // Проверяем, является ли ответ уже полным и полезным
      const isCompleteResponse = content.length > 100 &&
        (content.includes('Для регистрации') ||
         content.includes('документы') ||
         content.includes('ООО') ||
         content.includes('ИП') ||
         content.includes('договор') ||
         content.includes('иск') ||
         content.includes('налог') ||
         content.includes('банкротств'));

      if (isCompleteResponse) {
        console.log('✅ API вернул полный ответ, используем напрямую без структурирования');
        return content;
      }

      console.log('🚀 Начинаем генерацию структурированного ответа');

      // Переменные для хранения плана
      let planPoints: string[] = [];
      let planContent: string = '';

      // ЭТАП 1: Создаем план ответа из 3 пунктов через streaming (серым цветом)
      console.log('📋 Этап 1: Создание плана ответа');

      const planPrompt = `Создай план ответа на юридический вопрос: "${content}"

Требования:
- 3 пункта в формате: 1. Заголовок раздела
- Каждый заголовок 3-8 слов
- Только нумерованный список, без лишнего текста

Пример:
1. Правовые основы проблемы
2. Практические рекомендации
3. Возможные риски и решения`;

      const planMessages = [
        {
          role: 'user' as const,
          content: `Создай план из 3 пунктов для ответа на юридический вопрос.

Вопрос: "${content}"

Формат ответа: только нумерованный список 1. 2. 3. без дополнительного текста.

Пример:
1. Правовые основы проблемы
2. Практические рекомендации
3. Возможные риски и решения`
        }
      ];

      // Streaming генерация плана (серым цветом)
      setIsStreaming(true);
      setStreamingMessage('');

      const planController = new AbortController();
      const planTimeoutId = setTimeout(() => planController.abort(), 60000);

      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: planMessages,
            model: 'gpt-5.1',
            max_completion_tokens: 1000,
            temperature: 0.7,
            stream: true
          }),
          signal: planController.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        planContent = '';

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let isDone = false;
        try {
          while (!isDone) {
            const { done, value } = await reader.read();
            if (done) {
              isDone = true;
              break;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  isDone = true;
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  let contentChunk = null;
                  
                  if (parsed.content) {
                    planContent = parsed.content;
                    contentChunk = parsed.content;
                  } else if (parsed.choices?.[0]?.delta?.content) {
                    contentChunk = parsed.choices[0].delta.content;
                    planContent += contentChunk;
                  } else if (parsed.choices?.[0]?.message?.content) {
                    planContent = parsed.choices[0].message.content;
                    contentChunk = parsed.choices[0].message.content;
                  }
                  
                  if (contentChunk) {
                    setStreamingMessage(`<div style="color: #6b7280; font-style: italic;">📋 План ответа:\n\n${planContent}</div>`);
                  }
                } catch (e) {
                  console.warn('⚠️ Failed to parse JSON chunk:', data, e);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        console.log('📋 Создан план (raw):', planContent);
        console.log('📋 Длина плана:', planContent.length);
        console.log('📋 Строки плана:', planContent.split('\n'));
        console.log('📋 План в JSON формате:', JSON.stringify(planContent));
        console.log('📋 План символы:', [...planContent].map(c => c.charCodeAt(0)));

        // Парсим план на пункты
        const cleanPlan = planContent
          .replace(/📋\s*План\s*ответа[:\s]*/gi, '')
          .replace(/План\s*ответа[:\s]*/gi, '')
          .replace(/^[^\d]*/i, '')
          .trim();
        
        console.log('📋 Очищенный план:', cleanPlan);
        console.log('📋 Очищенный план символы:', [...cleanPlan].map(c => c.charCodeAt(0)));

        // Более простой и надежный парсер
        let planLines = cleanPlan.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        console.log('📋 Все строки после split:', planLines);

        // Ищем строки, которые выглядят как пункты плана
        planLines = planLines.filter(line => {
          // Простая проверка: строка содержит цифру в начале ИЛИ начинается с русской буквы и достаточно длинная
          const startsWithNumber = line.match(/^\d+[\.)]?\s*/);
          const startsWithBullet = line.match(/^[-*•]\s*/);
          const isRussianTitle = line.match(/^[А-ЯЁ]/) && line.length > 5 && line.length < 80;

          const isValid = startsWithNumber || startsWithBullet || isRussianTitle;
          console.log(`📋 Проверяем строку "${line}": startsWithNumber=${!!startsWithNumber}, startsWithBullet=${!!startsWithBullet}, isRussianTitle=${!!isRussianTitle}, isValid=${isValid}`);
          return isValid;
        });

        console.log('📋 Отфильтрованные строки плана:', planLines);

        console.log('📋 Найденные строки плана:', planLines);

        console.log('📋 Обрабатываем строки в пункты плана...');

        const seenPoints = new Set();
        planPoints = planLines
          .map((line, index) => {
            console.log(`📋 Обрабатываем строку ${index + 1}: "${line}"`);
            const cleaned = line
              .trim()
              .replace(/^\d+[\.)]\s*/, '') // Убираем нумерацию
              .replace(/^[-*•]\s*/, '')   // Убираем маркеры
              .replace(/^📋\s*/, '')      // Убираем иконки
              .trim();

            console.log(`📋 Очищенная строка ${index + 1}: "${cleaned}"`);
            return cleaned;
          })
          .filter(point => {
            const isValid = point && point.length >= 2; // Минимум 2 символа
            console.log(`📋 Фильтруем пункт "${point}": length=${point?.length}, isValid=${isValid}`);
            return isValid;
          })
          .filter((point, index) => {
            // Проверяем на дубликаты (case-insensitive)
            const normalized = point.toLowerCase().trim();
            const isDuplicate = seenPoints.has(normalized);
            if (!isDuplicate) {
            seenPoints.add(normalized);
            }
            console.log(`📋 Проверяем дубликат "${point}": normalized="${normalized}", isDuplicate=${isDuplicate}`);
            return !isDuplicate;
          })
          .slice(0, 3); // Берем максимум 3 пункта

        console.log('📋 Финальные пункты плана:', planPoints);

        console.log('📋 Пункты плана после обработки:', planPoints);

        if (planPoints.length === 0) {
          console.warn('📋 План не распознан, создаем дефолтные пункты');
          planPoints = [
            'Анализ правовой ситуации',
            'Практические рекомендации',
            'Возможные риски и решения'
          ];
        }

        // Ждем немного, чтобы пользователь увидел план
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Очищаем план и начинаем генерацию основного ответа
        setStreamingMessage('Формирую подробный ответ по плану...\n\n');

      } catch (error) {
        clearTimeout(planTimeoutId);
        console.error('Ошибка при генерации плана:', error);
        setStreamingMessage('⚠️ Ошибка при создании плана. Начинаю стандартный ответ...\n\n');

        planPoints = [
          'Анализ правовой ситуации',
          'Практические рекомендации',
          'Возможные риски и решения'
        ];
      }

      // ЭТАП 2: Последовательно обрабатываем каждый пункт плана с учетом предыдущих ответов
      let fullResponse = '';
      const previousResponses: string[] = [];

      console.log('🚀 Начинаем последовательную обработку пунктов плана:', planPoints.length);

      for (let i = 0; i < planPoints.length; i++) {
        const point = planPoints[i];
        console.log(`📝 Этап ${i + 2}: Обработка пункта "${point}" (${i + 1}/${planPoints.length})`);

        // Показываем какой пункт сейчас обрабатывается
        setStreamingMessage(`${fullResponse}**Обработка раздела ${i + 1}: ${point}...**\n\n`);

        // Создаем контекст из предыдущих ответов
        const previousContext = previousResponses.length > 0
          ? `\n\nПРЕДЫДУЩИЕ РАЗДЕЛЫ (УЧТИ ИХ ПРИ НАПИСАНИИ ТЕКУЩЕГО РАЗДЕЛА):\n${previousResponses.map((response, idx) =>
              `РАЗДЕЛ ${idx + 1}: ${response.substring(0, 300)}${response.length > 300 ? '...' : ''}`
            ).join('\n\n')}`
          : '';

        const pointPrompt = `Вопрос пользователя: "${content}".

План ответа:
${planPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

Сейчас ты пишешь только раздел №${i + 1}: "${point}".

Требования к разделу:
- это часть единого ответа, а не самостоятельная статья;
- не пиши отдельное вступление ко всему ответу и общие выводы;
- не пересказывай вопрос пользователя;
- не используй фразы типа «Регистрация ООО — важный шаг…», если это уже звучало в других разделах;
- пиши так, как будто выше уже был раздел ${i > 0 ? `1${i > 1 ? `-${i}` : ''}` : 'ничего'}, а ниже будет раздел ${i + 2};
- не дублируй подробно то, что логично относится к другим разделам;
- будь конкретным и практичным;
- РАЗДЕЛ ДОЛЖЕН БЫТЬ ПОДРОБНЫМ: минимум 400-600 слов, с примерами, ссылками на законодательство, практическими советами;
- Рассматривай тему с разных сторон: правовые аспекты, практические нюансы, возможные риски, альтернативные варианты;
- Используй конкретные статьи законов, судебную практику, реальные примеры;
- Давай пошаговые инструкции, чек-листы, советы по избежанию ошибок.

Выведи только текст раздела №${i + 1} без заголовка и без общего резюме.`;

        // Создаем сообщения для API для текущего пункта
        const pointMessages = [
          {
            role: 'system' as const,
            content: AI_SYSTEM_MESSAGES.LEGAL_ASSISTANT,
          },
          ...currentMessages.slice(-3).map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          {
            role: 'user' as const,
            content: pointPrompt,
          },
        ];

        // Генерируем ответ для текущего пункта
        const stepController = new AbortController();
        const stepTimeoutId = setTimeout(() => stepController.abort(), 120000); // 2 минуты на шаг

        try {
          const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                    messages: pointMessages,
              model: hasUploadedFile && uploadedFileData?.type.startsWith('image/') ? 'gpt-5.1' : 'gpt-5.1',
                    max_completion_tokens: 2500, // Для каждого раздела (увеличено для подробности)
                    temperature: 0.7,
                    stream: true,
                  }),
            signal: stepController.signal,
          });

          clearTimeout(stepTimeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('Response body is not readable');
          }

          const decoder = new TextDecoder();
          let currentStepResponse = '';

          let isStepDone = false;
          while (!isStepDone) {
            const { value, done } = await reader.read();
              if (done) {
              isStepDone = true;
                break;
              }

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
              if (!line.startsWith('data: ')) {
                continue;
              }

                  const data = line.slice(6);
                  if (data === '[DONE]') {
                isStepDone = true;
                    break;
                  }

                  try {
                    const parsed = JSON.parse(data);
                let contentChunk: string | undefined;

                    if (parsed.content) {
                  currentStepResponse = parsed.content;
                      contentChunk = parsed.content;
                    } else if (parsed.choices?.[0]?.delta?.content) {
                      contentChunk = parsed.choices[0].delta.content;
                  currentStepResponse += contentChunk;
                    } else if (parsed.choices?.[0]?.message?.content) {
                  currentStepResponse = parsed.choices[0].message.content;
                      contentChunk = parsed.choices[0].message.content;
                    }

                    if (contentChunk) {
                  // Показываем накопленный ответ для текущего шага
                  setStreamingMessage(`${fullResponse}**${i + 1}. ${point}**\n\n${currentStepResponse}\n\n`);
                }
              } catch (parseError) {
                console.warn('⚠️ Failed to parse JSON chunk for step:', data, parseError);
              }
            }
          }

          reader.releaseLock();

          // Сохраняем ответ текущего шага для следующих шагов
          previousResponses.push(currentStepResponse);

          // Добавляем оформленный раздел к общему ответу
          if (i > 0) {
            fullResponse += '\n\n---\n\n';
          }
          fullResponse += `**${i + 1}. ${point}**\n\n${currentStepResponse.trim()}\n\n`;

          console.log(`✅ Завершен раздел ${i + 1}/${planPoints.length}: ${point}`);

          // Небольшая пауза между разделами
          if (i < planPoints.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (stepError) {
          console.error(`Ошибка при обработке раздела ${i + 1}:`, stepError);
          previousResponses.push(`Ошибка при генерации раздела ${i + 1}`);
          fullResponse += `**${i + 1}. ${point}**\n\nПроизошла ошибка при обработке этого раздела. Попробуйте переформулировать вопрос.\n\n`;
      } finally {
          clearTimeout(stepTimeoutId);
        }
      }

      // ЭТАП 3: Объединение и зачистка дублей
      console.log('🔄 Этап 3: Объединение разделов в единый ответ');

      setStreamingMessage('Объединяю разделы в единый связный ответ...\n\n');

      const finalPrompt = `Ниже три текстовых фрагмента — проект разделов единого ответа на вопрос: "${content}".

Раздел 1: ${planPoints[0]}
${previousResponses[0] || 'Ошибка генерации'}

Раздел 2: ${planPoints[1]}
${previousResponses[1] || 'Ошибка генерации'}

Раздел 3: ${planPoints[2]}
${previousResponses[2] || 'Ошибка генерации'}

Задача:
Объединить их в единый связный, подробный ответ.

Убрать ТОЛЬКО явные повторы и дубли, но сохранить всю полезную информацию:
- убрать повторяющиеся объяснения одних и тех же понятий
- убрать дублирующиеся списки документов или шагов
- убрать повторяющиеся вступления и мини-выводы

НЕ сокращать контент искусственно! Каждый раздел должен сохранить свою глубину и подробность.

Сделать плавные логические переходы между разделами.
Сохранить структуру: короткое вступление → подробные разделы по смыслу → общий вывод.

Верни только конечный текст для пользователя, без указания номеров разделов в финальном ответе.`;

      const finalMessages = [
        {
          role: 'system' as const,
          content: AI_SYSTEM_MESSAGES.LEGAL_ASSISTANT,
        },
        ...currentMessages.slice(-2).map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        {
          role: 'user' as const,
          content: finalPrompt,
        },
      ];

      const finalController = new AbortController();
      const finalTimeoutId = setTimeout(() => finalController.abort(), 120000);

      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: finalMessages,
            model: 'gpt-5.1',
            max_completion_tokens: 4000, // Увеличено для вмещения подробных разделов
            temperature: 0.6,
            stream: true,
          }),
          signal: finalController.signal,
        });

        clearTimeout(finalTimeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let finalAnswer = '';

        let isFinalDone = false;
        while (!isFinalDone) {
          const { value, done } = await reader.read();
          if (done) {
            isFinalDone = true;
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) {
              continue;
            }

            const data = line.slice(6);
            if (data === '[DONE]') {
              isFinalDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(data);
              let contentChunk: string | undefined;

              if (parsed.content) {
                finalAnswer = parsed.content;
                contentChunk = parsed.content;
              } else if (parsed.choices?.[0]?.delta?.content) {
                contentChunk = parsed.choices[0].delta.content;
                finalAnswer += contentChunk;
              } else if (parsed.choices?.[0]?.message?.content) {
                finalAnswer = parsed.choices[0].message.content;
                contentChunk = parsed.choices[0].message.content;
              }

              if (contentChunk) {
                setStreamingMessage(finalAnswer);
              }
            } catch (parseError) {
              console.warn('⚠️ Failed to parse JSON chunk for final:', data, parseError);
            }
          }
        }

        reader.releaseLock();

      setIsStreaming(false);
        console.log('✅ Финальная сборка завершена');

        return finalAnswer.trim();

      } catch (finalError) {
        console.error('Ошибка финальной сборки:', finalError);
        // Если финальная сборка не удалась, возвращаем объединенные разделы
        setIsStreaming(false);
        return fullResponse.trim();
      } finally {
        clearTimeout(finalTimeoutId);
      }
    } catch (outerError: any) {
      console.error('Outer error in sendStreamingMessageToAI:', outerError);
      throw new Error(`Ошибка модульной генерации: ${outerError?.message || outerError}`);
    }
  };

  // Функция для озвучивания ответа с использованием OpenAI TTS

  // Функция для обработки голосового взаимодействия
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
          } else if (file.name.toLowerCase().endsWith('.docx') || file.type.includes('word')) {
            try {
              const text = await extractTextFromDOCX(file);
              content += `\nДокумент Word "${file.name}":\n${text}`;
            } catch (error: any) {
              console.error('Error processing DOCX:', error);
              content += `\nДокумент Word "${file.name}" (не удалось извлечь текст: ${error.message || error})`;
            }
          } else if (file.name.toLowerCase().endsWith('.doc')) {
            content += `\nДокумент "${file.name}" имеет формат .doc, который не поддерживается для автоматического анализа. Сохраните файл в формате DOCX или PDF и повторите попытку.`;
          } else if (file.type.startsWith('text/') ||
                    file.name.toLowerCase().endsWith('.txt') ||
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

      const chatMessages: Array<{
        role: string;
        content: string | Array<{
          type: 'text' | 'image_url';
          text?: string;
          image_url?: { url: string };
        }>;
      }> = [
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
        systemMessage: `${systemMessage.substring(0, 100)  }...`,
        chatMessagesCount: chatMessages.length,
        isDocumentAnalysis: hasFiles
      });

      const response = await sendChatMessage(chatMessages, {
        model: 'gpt-5.1',
        max_completion_tokens: 8000, // Оптимальный лимит для качественных ответов
        temperature: 0.8 // Увеличиваем для более разнообразных и длинных ответов
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

        if (content.length === 0) {
          console.warn('Ответ от AI пустой после trim');
          return 'Извините, AI вернул пустой ответ. Попробуйте переформулировать вопрос.';
        }

        return content;
      } else {
        console.error('Ошибка в ответе AI:', response);
        return 'Произошла ошибка при обработке ответа AI. Попробуйте еще раз.';
      }
    } catch (error) {
      console.error('Error in sendMessageToAI:', error);
      throw error;
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
      // Проверяем, есть ли в сообщении загруженный файл
      const lastMessage = messages[messages.length - 1];
      const hasUploadedFile = lastMessage && lastMessage.uploadedFile;

      let aiResponse: string;
      let finalResponse: string;

      if (hasUploadedFile) {
        console.log('handleSendMessage: Обнаружен загруженный файл, запускаем анализ документа');
        // Для загруженных файлов используем специальный режим анализа
        aiResponse = await sendStreamingMessageToAI(message, files);
        console.log('handleSendMessage: Получен анализ документа от AI:', aiResponse);

        // Применяем постобработку для анализа документов тоже
        console.log('handleSendMessage: Применяем постобработку анализа документа');
        const processedResponse = quickProcess(aiResponse, 'Результаты анализа документа');
        const finalResponse = processedResponse.markdown;

        console.log('handleSendMessage: Постобработка анализа завершена. Статистика:', processedResponse.statistics);
      } else {
        console.log('handleSendMessage: Запускаем настоящий процесс размышлений LLM');
        await simulateReasoning(message);

        console.log('handleSendMessage: Вызываем streaming sendMessageToAI');
        aiResponse = await sendStreamingMessageToAI(message, files);
        console.log('handleSendMessage: Получен ответ от AI:', aiResponse);

        // Применяем профессиональную постобработку для удаления дубликатов и оптимизации
        console.log('handleSendMessage: Применяем постобработку ответа AI');
        const processedResponse = quickProcess(aiResponse);
        const finalResponse = processedResponse.markdown;

        console.log('handleSendMessage: Постобработка завершена. Статистика:', processedResponse.statistics);
        console.log('handleSendMessage: Оптимизированный ответ:', finalResponse);
      }

      const assistantMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        content: finalResponse || aiResponse,
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
                <div className="flex justify-center items-center mb-4">
                  <Button
                    onClick={startNewChat}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5 hover:bg-primary hover:text-primary-foreground transition-colors px-2 sm:px-3 text-xs sm:text-sm"
                    title="Новый чат"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="font-medium">Новый чат</span>
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
