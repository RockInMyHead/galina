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
import { fileToBase64, fileToText, formatFileSize, processFile } from "@/utils/fileUtils";
import { chatStorage } from "@/utils/storageUtils";
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
        model: 'gpt-4o',
        max_tokens: 800,
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

      // Проверяем, есть ли в последних сообщениях uploadedFile
      const lastMessage = currentMessages[currentMessages.length - 1];
      let hasUploadedFile = false;
      let uploadedFileData = null;
      let isDocumentAnalysis = false;

      if (lastMessage && lastMessage.uploadedFile) {
        hasUploadedFile = true;
        uploadedFileData = lastMessage.uploadedFile;
        // Проверяем, является ли это запросом на анализ документа
        isDocumentAnalysis = userMessage.includes('Проанализируй его содержимое') ||
                           userMessage.includes('заполнением или создай соответствующий шаблон');
      }

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

      // Если это анализ документа, используем специальный режим
      if (isDocumentAnalysis && hasUploadedFile && uploadedFileData) {
        console.log('📄 Начинаем анализ документа');

        // Создаем сообщение для анализа документа
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
            content: 'Ты - Галина, опытный AI-юрист, специализирующийся на анализе документов.'
          },
          {
            role: 'user' as const,
            content: [
              {
                type: 'text',
                text: analysisPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: uploadedFileData.data
                }
              }
            ]
          }
        ];

        // Отправляем запрос на анализ
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
              model: 'gpt-4o',
              max_tokens: 1500,
              temperature: 0.3, // Более точный анализ
              stream: true
            }),
            signal: controller.signal
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return new Promise((resolve, reject) => {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            const readStream = async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n');

                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const data = line.slice(6);
                      if (data === '[DONE]') {
                        resolve(fullContent);
                        return;
                      }

                      try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content;
                        if (content) {
                          fullContent += content;
                          setStreamingMessage(fullContent);
                        }
                      } catch (e) {
                        console.warn('⚠️ Failed to parse streaming JSON:', data, e);
                      }
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

      console.log('🚀 Начинаем модульную генерацию ответа');

      // Переменные для хранения плана
      let planPoints: string[] = [];
      let planContent: string = '';

      // ЭТАП 1: Создаем план ответа из 3 пунктов через streaming (серым цветом)
      console.log('📋 Этап 1: Создание плана ответа');

      const planPrompt = `Создай краткий план ответа на вопрос пользователя. План должен содержать ровно 3 основных пункта, которые полностью охватывают тему вопроса.

Вопрос пользователя: ${content}

План должен быть в формате:
1. [Краткий заголовок первого пункта]
2. [Краткий заголовок второго пункта]
3. [Краткий заголовок третьего пункта]

Требования к плану:
- Каждый пункт должен быть развернутым заголовком (5-10 слов)
- План должен полностью охватывать юридический аспект вопроса
- Избегай общих фраз типа "Анализ ситуации" - будь конкретен
- Фокус на практических аспектах и юридических последствиях`;

      const systemMessage = AI_SYSTEM_MESSAGES.LEGAL_ASSISTANT;
      const planMessages = [
        {
          role: 'system' as const,
          content: 'Ты - помощник юриста. Создай краткий план из 3 пунктов для ответа на юридический вопрос. Будь максимально конкретен и практичен. ВАЖНО: Ответь ТОЛЬКО планом в формате:\n1. [Пункт 1]\n2. [Пункт 2]\n3. [Пункт 3]\n\nБез дополнительного текста, только нумерованный список.'
        },
        {
          role: 'user' as const,
          content: planPrompt
        }
      ];

      // Streaming генерация плана (серым цветом)
      setIsStreaming(true);
      setStreamingMessage('');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch('http://localhost:3001/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: planMessages,
            model: 'gpt-4o',
            max_tokens: 1000,
            temperature: 0.7,
            stream: true
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

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
                  console.log('📋 Streaming chunk:', parsed);
                  
                  // Проверяем разные форматы ответа
                  // API возвращает { content: fullContent } - полный накопленный контент
                  let contentChunk = null;
                  
                  if (parsed.content) {
                    // API возвращает полный накопленный контент
                    planContent = parsed.content;
                    contentChunk = parsed.content;
                  } else if (parsed.choices?.[0]?.delta?.content) {
                    // OpenAI streaming формат - инкрементальные чанки
                    contentChunk = parsed.choices[0].delta.content;
                    planContent += contentChunk;
                  } else if (parsed.choices?.[0]?.message?.content) {
                    // Не streaming формат
                    planContent = parsed.choices[0].message.content;
                    contentChunk = parsed.choices[0].message.content;
                  }
                  
                  if (contentChunk) {
                    console.log('📋 Plan content so far:', planContent);
                    // Показываем план серым цветом как промежуточный результат
                    setStreamingMessage(`<div style="color: #6b7280; font-style: italic;">📋 План ответа:\n\n${planContent}</div>`);
                  } else {
                    console.log('⚠️ No content in chunk:', parsed);
                  }
                } catch (e) {
                  console.warn('⚠️ Failed to parse JSON chunk:', data, e);
                  // Игнорируем некорректный JSON
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

        // Парсим план на пункты - пробуем разные варианты
        // Сначала убираем заголовки и лишний текст
        let cleanPlan = planContent
          .replace(/📋\s*План\s*ответа[:\s]*/gi, '')
          .replace(/План\s*ответа[:\s]*/gi, '')
          .replace(/^[^\d]*/i, '') // Убираем текст до первой цифры
          .trim();
        
        console.log('📋 Очищенный план:', cleanPlan);

        // Ищем пункты плана с нумерацией
        let planLines = cleanPlan.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .filter(line => {
            // Ищем строки с нумерацией: 1., 2., 3. или 1), 2), 3)
            const hasNumbering = line.match(/^\d+[\.)]\s+/) || line.match(/^[-*]\s+/);
            // Или строки, которые начинаются с заглавной русской буквы и достаточно длинные
            const hasRussianStart = line.match(/^[А-ЯЁ]/) && line.length > 10;
            return hasNumbering || hasRussianStart;
          });
        
        console.log('📋 Отфильтрованные строки плана:', planLines);

        // Если не нашли пункты с нумерацией, пробуем найти по структуре
        if (planLines.length === 0) {
          planLines = cleanPlan.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 5 && line.length < 100)
            .filter((line, index, arr) => {
              // Берем только строки, которые выглядят как пункты плана
              return !line.match(/^📋|^План|^ответа|^:/i) &&
                     line.length > 5;
            });
        }

        console.log('📋 Найденные строки плана:', planLines);

        // Берем уникальные пункты (убираем дубликаты)
        const seenPoints = new Set();
        planPoints = planLines
          .map(line => {
            // Убираем маркеры списков и лишние пробелы
            let cleaned = line
              .trim()
              .replace(/^\d+[\.)]\s*/, '') // 1. или 1)
              .replace(/^[-*]\s*/, '') // - или *
              .replace(/^📋\s*/, '') // Эмодзи
              .trim();
            return cleaned;
          })
          .filter(point => {
            // Убираем пустые и дубликаты
            if (!point || point.length < 3) return false;
            const normalized = point.toLowerCase().trim();
            if (seenPoints.has(normalized)) return false;
            seenPoints.add(normalized);
            return true;
          })
          .slice(0, 3); // Берем максимум 3 пункта

        console.log('📋 Пункты плана после обработки:', planPoints);

        // Если все еще пустой массив, создаем дефолтные пункты
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
        setStreamingMessage('Разрабатываю подробный ответ...\n\n');

      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Ошибка при генерации плана:', error);
        setStreamingMessage('⚠️ Ошибка при создании плана. Начинаю стандартный ответ...\n\n');

        // При ошибке создаем дефолтные пункты плана
        planPoints = [
          'Анализ правовой ситуации',
          'Практические рекомендации',
          'Возможные риски и решения'
        ];
      }

      // ЭТАП 2: Последовательно обрабатываем каждый пункт плана
      let fullResponse = '';

      console.log('🚀 Начинаем обработку пунктов плана, количество:', planPoints.length);

      // Разные типы анализа для разнообразия ответов
      const analysisTypes = [
        {
          name: 'Теоретический анализ',
          focus: 'Дай глубокий теоретический анализ правовой природы проблемы. Объясни фундаментальные принципы и доктринальные подходы права.',
          requirements: '- Философский анализ права\n- Доктринальные подходы\n- Фундаментальные принципы\n- Правовая природа проблемы',
          structure: '1. Теоретические основы\n2. Доктринальные подходы\n3. Правовая природа проблемы\n4. Выводы'
        },
        {
          name: 'Практический разбор',
          focus: 'Сделай детальный практический разбор с пошаговыми инструкциями. Опиши реальные процедуры, документы, сроки.',
          requirements: '- Пошаговые инструкции\n- Формы документов\n- Процессуальные сроки\n- Практические примеры',
          structure: '1. Алгоритм действий\n2. Необходимые документы\n3. Сроки и этапы\n4. Практические советы'
        },
        {
          name: 'Судебная практика',
          focus: 'Проанализируй судебную практику по данной теме. Разбери ключевые дела, позиции судов, тенденции.',
          requirements: '- Анализ прецедентов\n- Судебная статистика\n- Тенденции правоприменения\n- Прогнозы развития',
          structure: '1. Ключевые судебные дела\n2. Статистика и тенденции\n3. Анализ позиций судов\n4. Прогнозы'
        },
        {
          name: 'Риск-анализ',
          focus: 'Проведи детальный анализ рисков. Выяви скрытые угрозы, потенциальные проблемы, способы минимизации.',
          requirements: '- Идентификация рисков\n- Вероятность наступления\n- Последствия\n- Меры минимизации',
          structure: '1. Идентификация рисков\n2. Оценка вероятности\n3. Анализ последствий\n4. Меры минимизации'
        },
        {
          name: 'Стратегический подход',
          focus: 'Разработай стратегический план действий. Определи приоритеты, этапы, ресурсы.',
          requirements: '- Стратегическое планирование\n- Приоритизация действий\n- Ресурсное обеспечение\n- Контрольные точки',
          structure: '1. Стратегические цели\n2. Этапы реализации\n3. Необходимые ресурсы\n4. Контроль и корректировка'
        },
        {
          name: 'Экспертная оценка',
          focus: 'Дай экспертную оценку ситуации как практикующий юрист. Поделись практическими советами.',
          requirements: '- Экспертные рекомендации\n- Типичные ошибки\n- Лучшие практики\n- Прогноз развития',
          structure: '1. Экспертная оценка\n2. Практические рекомендации\n3. Предупреждение об ошибках\n4. Прогноз'
        },
        {
          name: 'Комплексный анализ',
          focus: 'Сделай комплексный анализ с разных точек зрения: экономической, социальной, политической.',
          requirements: '- Мультидисциплинарный подход\n- Экономические последствия\n- Социальные аспекты\n- Политическое влияние',
          structure: '1. Экономический анализ\n2. Социальные последствия\n3. Политические аспекты\n4. Комплексные выводы'
        },
        {
          name: 'Альтернативные решения',
          focus: 'Рассмотри все возможные варианты решения проблемы. Сравни плюсы и минусы каждого подхода.',
          requirements: '- Варианты решений\n- Сравнительный анализ\n- Оптимизация выбора\n- Альтернативные сценарии',
          structure: '1. Варианты решения\n2. Сравнение преимуществ\n3. Анализ недостатков\n4. Рекомендации'
        },
        {
          name: 'Профилактика и предотвращение',
          focus: 'Разработай систему профилактики подобных ситуаций. Создай чек-листы, инструкции.',
          requirements: '- Профилактические меры\n- Системы контроля\n- Чек-листы безопасности\n- Мониторинг рисков',
          structure: '1. Профилактические меры\n2. Системы контроля\n3. Чек-листы и инструкции\n4. Мониторинг'
        },
        {
          name: 'Итоговые рекомендации',
          focus: 'Подведи итоги анализа. Дай окончательные рекомендации, приоритизируй действия.',
          requirements: '- Итоговые выводы\n- Приоритизация\n- Сроки исполнения\n- Ответственность',
          structure: '1. Итоговые выводы\n2. Приоритетные действия\n3. Сроки и этапы\n4. Ответственность'
        }
      ];

      for (let i = 0; i < planPoints.length; i++) {
        const point = planPoints[i];
        const analysisType = analysisTypes[i % analysisTypes.length]; // Циклически используем разные типы

        console.log(`🔍 Этап ${i + 2}: Обработка пункта "${point}" (${analysisType.name})`);

        // Показываем какой пункт сейчас обрабатывается
        setStreamingMessage(`${analysisType.name} раздела ${i + 1}: ${point}...\n\n`);

        // Текст для судебной практики (без поиска по интернету)
        const courtCasesText = '\n\nПо данной теме найдены следующие тенденции судебной практики:';

        const pointPrompt = `Ты - Галина, элитный AI-юрист.

ЗАДАЧА: Напиши подробный раздел юридической консультации по теме "${point}".

КОНТЕКСТ: Пользователь спросил: "${content}"

${courtCasesText}

СТИЛЬ: Будь практичным и конкретным. Дай полезные советы. Используй примеры из практики.

НАПИШИ ПОДРОБНЫЙ ТЕКСТ РАЗДЕЛА (минимум 200 слов).`;

        const pointMessages = [
          {
            role: 'system' as const,
            content: systemMessage
          },
          ...currentMessages.slice(-5).map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })),
          {
            role: 'user' as const,
            content: pointPrompt
          }
        ];

        // Создаем streaming соединение для каждого пункта
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        try {
          console.log(`🚀 Отправляем запрос на генерацию раздела "${point}"`);
          console.log('📝 Промпт:', pointPrompt.substring(0, 200) + '...');

          // Подготавливаем сообщения для API
          let apiMessages = pointMessages;

          // Если есть загруженное изображение, добавляем его в первое пользовательское сообщение
          if (hasUploadedFile && uploadedFileData && uploadedFileData.type.startsWith('image/')) {
            // Находим первое пользовательское сообщение и добавляем изображение
            const userMessageIndex = apiMessages.findIndex(msg => msg.role === 'user');
            if (userMessageIndex !== -1) {
              apiMessages[userMessageIndex] = {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: pointPrompt
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: uploadedFileData.data
                    }
                  }
                ]
              };
            }
          }

          const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: apiMessages,
              model: hasUploadedFile && uploadedFileData?.type.startsWith('image/') ? 'gpt-4o' : 'gpt-4o',
              max_tokens: 1200, // Для каждого раздела (минимум 200 слов)
              temperature: 0.8,
              top_p: 0.9,
              presence_penalty: 0.2,
              frequency_penalty: 0.2,
              stream: true
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let pointContent = '';

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

                    // API возвращает { content: fullContent } - полный накопленный контент
                    if (parsed.content) {
                      pointContent = parsed.content;
                      contentChunk = parsed.content;
                    } else if (parsed.choices?.[0]?.delta?.content) {
                      // OpenAI streaming формат - инкрементальные чанки
                      contentChunk = parsed.choices[0].delta.content;
                      pointContent += contentChunk;
                    } else if (parsed.choices?.[0]?.message?.content) {
                      // Не streaming формат
                      pointContent = parsed.choices[0].message.content;
                      contentChunk = parsed.choices[0].message.content;
                    }

                    if (contentChunk) {
                      // Показываем накопленный контент для этого пункта
                      setStreamingMessage(`${fullResponse}**${i + 1}. ${point}**\n\n${pointContent}\n\n`);
                    }
                  } catch (e) {
                    console.warn('⚠️ Failed to parse JSON chunk for point:', data, e);
                    // Игнорируем некорректный JSON
                  }
                }
              }
            }
      } finally {
            reader.releaseLock();
          }

          // Добавляем обработанный пункт к общему ответу
          console.log(`📝 Сгенерирован контент для пункта "${point}":`, pointContent.length, 'символов');
          console.log(`📝 Контент:`, pointContent.substring(0, 200) + '...');

          fullResponse += `**${i + 1}. ${point}**\n\n${pointContent.trim()}\n\n`;

        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error(`Ошибка при обработке пункта ${i + 1}:`, fetchError);
          fullResponse += `**${i + 1}. ${point}**\n\nПроизошла ошибка при обработке этого раздела. Попробуйте переформулировать вопрос.\n\n`;
        }
      }

      // План уже был показан в streaming сообщении, не добавляем его в финальный ответ
      // Просто возвращаем полный ответ без плана
      const finalResponse = fullResponse;

      setIsStreaming(false);
      console.log('✅ Модульная генерация завершена');

      return finalResponse.trim();

    } catch (outerError) {
      console.error('Outer error in sendStreamingMessageToAI:', outerError);
      throw new Error(`Ошибка модульной генерации: ${outerError.message}`);
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
        systemMessage: systemMessage.substring(0, 100) + '...',
        chatMessagesCount: chatMessages.length,
        isDocumentAnalysis: hasFiles
      });

      const response = await sendChatMessage(chatMessages, {
        model: 'gpt-4o', // Улучшенная модель для юридических консультаций
        max_tokens: 8000, // Оптимальный лимит для качественных ответов
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

      if (hasUploadedFile) {
        console.log('handleSendMessage: Обнаружен загруженный файл, запускаем анализ документа');
        // Для загруженных файлов используем специальный режим анализа
        aiResponse = await sendStreamingMessageToAI(message, files);
        console.log('handleSendMessage: Получен анализ документа от AI:', aiResponse);
      } else {
        console.log('handleSendMessage: Запускаем настоящий процесс размышлений LLM');
        await simulateReasoning(message);

        console.log('handleSendMessage: Вызываем streaming sendMessageToAI');
        aiResponse = await sendStreamingMessageToAI(message, files);
        console.log('handleSendMessage: Получен ответ от AI:', aiResponse);
      }

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
