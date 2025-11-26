const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config({ path: './.env' });

// Configure proxy agent for external requests
const proxyUrl = 'http://rBD9e6:jZdUnJ@185.68.187.20:8000';
const proxyAgent = new HttpsProxyAgent(proxyUrl);

// Helper function for fetch with proxy
const fetchWithProxy = (url, options = {}) => {
  return fetch(url, {
    ...options,
    agent: proxyAgent
  });
};

// Initialize Prisma Client (disabled for testing)
// const prisma = new PrismaClient();

// Environment loaded successfully
console.log('Database URL:', process.env.DATABASE_URL);

// In-memory conversation storage for GPT-5.1 (since it doesn't support conversation history)
const conversationMemory = new Map();

// Helper function to get conversation context
function getConversationContext(sessionId, maxMessages = 10) {
  const conversation = conversationMemory.get(sessionId) || [];
  return conversation.slice(-maxMessages); // Keep only last N messages
}

// Helper function to add message to conversation
function addToConversation(sessionId, message) {
  if (!conversationMemory.has(sessionId)) {
    conversationMemory.set(sessionId, []);
  }
  const conversation = conversationMemory.get(sessionId);
  conversation.push(message);

  // Keep only last 50 messages to prevent memory leaks
  if (conversation.length > 50) {
    conversation.splice(0, conversation.length - 50);
  }
}

// Mock response generator for demo mode
function generateMockResponse(messages, model) {
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage?.content || '';

  console.log('🎭 Generating mock response for content type:', Array.isArray(content) ? 'array (Vision API)' : 'string (text)');
  console.log('🎭 Full messages:', JSON.stringify(messages, null, 2).substring(0, 500) + '...');

  // Handle Vision API requests (content is array with image_url)
  if (Array.isArray(content)) {
    const textContent = content.find(item => item.type === 'text')?.text || '';
    const hasImage = content.some(item => item.type === 'image_url');
    console.log('🖼️ Vision API request detected, has image:', hasImage, 'text:', textContent.substring(0, 100) + '...');

    // Vision API response for document analysis
    if (textContent.includes('Проанализируйте изображение документа') || textContent.includes('автоматически заполните этот шаблон')) {
      // Для демо-режима Vision API возвращаем заполненный шаблон
      // В реальном приложении selectedTemplateForChat не доступен, поэтому возвращаем общий пример
      return {
        id: 'mock-vision-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: `Проанализирован текст из изображения. На основе распознанных данных автоматически заполняю документ.

ГОТОВО

РЕШЕНИЕ № 1
ЕДИНСТВЕННОГО УЧРЕДИТЕЛЯ
ОБЩЕСТВА С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ПРИМЕР ООО"

г. Москва                                               "${new Date().getDate()}" ${new Date().toLocaleDateString('ru-RU', { month: 'long' })} ${new Date().getFullYear()} г.

Единственный учредитель Общества с ограниченной ответственностью "ПРИМЕР ООО" (далее – "Общество"), Иванов Иван Иванович, паспорт серии 1234 № 567890, выдан ГУ МВД России по г. Москве "01.01.2020", код подразделения 770-001, зарегистрированный по адресу: г. Москва, ул. Примерная, д. 1, кв. 1, действующий в соответствии с Уставом Общества,

РЕШИЛ:

1. Утвердить годовой отчет Общества за ${new Date().getFullYear()} год.

2. Настоящее решение вступает в силу с момента его принятия.

3. Контроль за исполнением настоящего решения возложить на единственного учредителя Общества.

Единственный учредитель:
Иванов Иван Иванович

_________________________
И.И. Иванов

М.П.

*Примечание: Документ заполнен в демо-режиме на основе распознанных данных из изображения. Для полноценной работы обновите API ключ OpenAI.*`
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 300,
          completion_tokens: 400,
          total_tokens: 700
        }
      };
    }
  }

  // Handle text-based requests
  if (typeof content === 'string') {
    console.log('💬 Text request, content:', content.substring(0, 100) + '...');

    // Analyze content to determine response type
    if (content.includes('Проанализируй этот PDF документ') || content.includes('Проанализируй первую страницу')) {
      // PDF/Image analysis response
      return {
        id: 'mock-chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: `## Анализ документа
**Тип:** Решение единственного учредителя

**Заполненные поля:**
- Наименование общества: Общество с ограниченной ответственностью
- Дата: ${new Date().toLocaleDateString('ru-RU')}
- Сумма: 900 000 (девятьсот тысяч) рублей 00 копеек

**Незаполненные поля:**
- ФИО единственного учредителя
- Серия и номер паспорта
- Дата выдачи паспорта
- Адрес регистрации

**Статус документа:** ТРЕБУЕТ ЗАПОЛНЕНИЯ

Пожалуйста, предоставьте недостающие данные для заполнения документа.`
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 200,
          total_tokens: 350
        }
      };
    } else if (content.includes('ГОТОВО')) {
      // Document completion response
      return {
        id: 'mock-chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: `ГОТОВО

РЕШЕНИЕ № 1
ЕДИНСТВЕННОГО УЧРЕДИТЕЛЯ
ОБЩЕСТВА С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ПРИМЕР ООО"

г. Москва                                               "${new Date().toLocaleDateString('ru-RU')}"

Единственный учредитель Общества с ограниченной ответственностью "ПРИМЕР ООО" (далее – "Общество"), Иванов Иван Иванович, паспорт серии 1234 № 567890, выдан ГУ МВД России по г. Москве 01.01.2020, зарегистрированный по адресу: г. Москва, ул. Примерная, д. 1, кв. 1, действующий в соответствии с Уставом Общества,

РЕШИЛ:

1. Утвердить годовой отчет Общества за ${new Date().getFullYear()} год.

2. Настоящее решение вступает в силу с момента его принятия.

3. Контроль за исполнением настоящего решения возложить на единственного учредителя Общества.

Единственный учредитель:
Иванов Иван Иванович

_________________________
[ПОДПИСЬ УЧРЕДИТЕЛЯ]

М.П.`
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 300,
          total_tokens: 500
        }
      };
    } else {
      // General chat response with smart question recognition
      console.log('💬 Processing general question:', content);

      let responseContent = '';

      // Check for specific legal questions
      const lowerContent = content.toLowerCase();

      if (lowerContent.includes('регистрац') && lowerContent.includes('ооо') ||
          lowerContent.includes('документ') && lowerContent.includes('ооо') ||
          lowerContent.includes('нужн') && lowerContent.includes('ооо')) {
        // Question about LLC registration documents
        responseContent = `Для регистрации ООО в России требуются следующие документы:

## Основные документы для регистрации ООО:

1. **Устав общества** - учредительный документ ООО
2. **Решение о создании ООО** (если единственный учредитель) или **Протокол общего собрания учредителей**
3. **Заявление по форме Р11001** - подается в налоговую инспекцию
4. **Договор об учреждении ООО** (если несколько учредителей)
5. **Квитанция об оплате госпошлины** (4000 рублей)

## Документы, удостоверяющие личность учредителей и директора:

6. **Паспорта учредителей и директора**
7. **ИНН учредителей и директора**
8. **Документы о регистрации по месту жительства** (для физлиц)

## Дополнительные документы:

9. **Гарантийное письмо** (если адрес регистрации отличается от фактического)
10. **Документы на юридический адрес** (договор аренды или свидетельство о собственности)

## Порядок регистрации:

1. Подготовка документов
2. Подача в налоговую инспекцию (МФЦ)
3. Получение свидетельства о постановке на учет
4. Изготовление печати (по желанию)
5. Открытие расчетного счета в банке

Хотите, чтобы я помог вам заполнить какой-либо из этих документов?`;
      } else if (lowerContent.includes('ип') || lowerContent.includes('индивидуальн') && lowerContent.includes('предпринимател')) {
        // Question about individual entrepreneur registration
        responseContent = `Для регистрации ИП в России требуются следующие документы:

## Основные документы для регистрации ИП:

1. **Заявление по форме Р21001** - подается в налоговую инспекцию
2. **Паспорт** (оригинал + копия)
3. **ИНН** (оригинал + копия)
4. **Квитанция об оплате госпошлины** (800 рублей)

## Порядок регистрации:

1. Подготовка заявления Р21001
2. Оплата госпошлины
3. Подача документов в налоговую (лично, через МФЦ или онлайн)
4. Получение свидетельства ОГРНИП через 3-5 рабочих дней

Хотите, чтобы я помог вам заполнить заявление на регистрацию ИП?`;
      } else if (lowerContent.includes('договор') || lowerContent.includes('контракт')) {
        responseContent = `Я могу помочь вам с составлением различных видов договоров:

## Популярные виды договоров:

- **Договор купли-продажи** (недвижимости, товаров, услуг)
- **Договор аренды** (помещений, оборудования, транспорта)
- **Трудовой договор**
- **Договор подряда**
- **Договор поставки**
- **Договор оказания услуг**

Какой именно договор вы хотите составить? Расскажите подробнее об условиях, и я подготовлю проект документа.`;
      } else if (lowerContent.includes('иск') || lowerContent.includes('суд') || lowerContent.includes('исков')) {
        responseContent = `Для подачи искового заявления в суд вам понадобятся:

## Обязательные документы:

1. **Исковое заявление** (с указанием сторон, предмета спора, требований)
2. **Документы, подтверждающие основания иска**
3. **Расчет суммы иска**
4. **Доверенность** (если представляет юрист)
5. **Квитанция об оплате госпошлины**

## Рекомендуемые документы:

- Доказательства по делу
- Свидетельские показания
- Экспертные заключения
- Иные документы, подтверждающие позицию истца

Хотите, чтобы я помог вам составить исковое заявление?`;
      } else if (lowerContent.includes('налог') || lowerContent.includes('налогов')) {
        responseContent = `Я могу помочь вам с налоговыми вопросами:

## Популярные налоговые вопросы:

- Расчет и уплата налогов (НДС, НДФЛ, налог на прибыль)
- Налоговые декларации
- Налоговые вычеты
- Налоговые льготы
- Споры с налоговыми органами

Какой конкретно налоговый вопрос вас интересует?`;
      } else if (lowerContent.includes('банкротств') || lowerContent.includes('банкрот')) {
        responseContent = `Процедура банкротства - сложный юридический процесс. Я могу предоставить общую информацию:

## Основные этапы банкротства юридического лица:

1. **Наблюдение** - анализ финансового состояния
2. **Финансовое оздоровление** (опционально)
3. **Внешнее управление** (опционально)
4. **Конкурсное производство** - реализация имущества
5. **Мировое соглашение** (возможно на любом этапе)

## Основания для банкротства:

- Невозможность удовлетворить требования кредиторов
- Просрочка платежей более 3 месяцев
- Размер долга более 300 000 рублей

Рекомендую обратиться к специализированному юристу по банкротству для конкретной ситуации.`;
      } else {
        // Default greeting for unrecognized questions
        responseContent = 'Привет! Я Галина, ваш AI-юрист. Я помогу вам с юридическими вопросами. Задайте мне любой вопрос о законодательстве Российской Федерации.';
      }

      return {
        id: 'mock-chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: responseContent
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 200,
          total_tokens: 250
        }
      };
    }
  }

  // Fallback response
  return {
    id: 'mock-fallback-' + Date.now(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: 'Извините, я не смог обработать ваш запрос. Попробуйте переформулировать вопрос.'
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 20,
      completion_tokens: 30,
      total_tokens: 50
    }
  };
}

const app = express();
const PORT = process.env.PORT || 1042;

// Configure CORS for development and production
const corsAllowedOrigins = [
  'https://lawyer.windexs.ru',
  'http://lawyer.windexs.ru',
  'https://lawyer.windexs.ru:1041',
  'http://lawyer.windexs.ru:1041',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3004',
  'http://localhost:4000',
  'http://localhost:5173',
];

const corsOptions = {
  origin: corsAllowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Увеличиваем лимит для JSON
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Для form data

// API routes with /api prefix

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Express error:', err);
  console.error('❌ Error stack:', err.stack);
  console.error('❌ Request:', req.method, req.url);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Middleware для обработки raw binary data для /stt/raw
app.use('/stt/raw', express.raw({ limit: '50mb', type: 'audio/*' }));

// Настройка multer для обработки больших файлов
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('🎵 Multer file filter:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    cb(null, true);
  }
});

// Middleware для обработки ошибок multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('🚨 Multer error:', error.code, error.message);
    return res.status(400).json({
      error: 'File upload error',
      details: error.message,
      code: error.code
    });
  }
  next(error);
};


// Test endpoint to verify proxy is working
app.get('/test-proxy', async (req, res) => {
  try {
    console.log('🧪 Testing proxy connection...');
    const response = await fetchWithProxy('https://httpbin.org/ip');
    const data = await response.json();
    console.log('✅ Proxy test successful, IP:', data.origin);
    res.json({
      success: true,
      proxyWorking: true,
      clientIP: data.origin,
      message: 'Proxy is working correctly!'
    });
  } catch (error) {
    console.error('❌ Proxy test failed:', error.message);
    res.status(500).json({
      success: false,
      proxyWorking: false,
      error: error.message,
      message: 'Proxy test failed'
    });
  }
});

app.post('/chat', async (req, res) => {
  try {
    console.log('=== New Chat Request ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { messages, model = 'gpt-5.1', max_completion_tokens = 2000, temperature = 0.7, top_p = 1, presence_penalty = 0, frequency_penalty = 0, stream = false, reasoning = 'medium' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // Handle streaming requests
    if (stream) {
      // Test API key validity for streaming
      let apiKeyValid = false;
      if (apiKey) {
        try {
          console.log('🔍 Testing OpenAI API key validity...');
          // Quick test request to check if API key works with GPT-5.1
            const testResponse = await fetchWithProxy('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
        body: JSON.stringify({
          model: 'gpt-5.1',
          messages: [{ role: 'user', content: 'test' }],
          max_completion_tokens: 10
        })
          });
          apiKeyValid = testResponse.ok;
          console.log('🔑 API key valid:', apiKeyValid, 'Status:', testResponse.status);
        } catch (error) {
          console.log('❌ API key test failed:', error.message);
          apiKeyValid = false;
        }
      }
      if (!apiKey || !apiKeyValid) {
        // Mock streaming for testing when no API key
        console.log('No API key - using mock streaming for testing');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Get smart mock content based on the last message
        const lastMessage = messages[messages.length - 1];
        const userContent = lastMessage?.content || '';
        const lowerContent = userContent.toLowerCase();

        let mockContent = '';

        if (lowerContent.includes('регистрац') && lowerContent.includes('ооо') ||
            lowerContent.includes('документ') && lowerContent.includes('ооо') ||
            lowerContent.includes('нужн') && lowerContent.includes('ооо')) {
          mockContent = 'Для регистрации ООО в России требуются следующие документы: Устав общества, Решение о создании ООО, Заявление по форме Р11001, Договор об учреждении ООО (если несколько учредителей), Квитанция об оплате госпошлины (4000 рублей), Паспорта и ИНН учредителей и директора, а также документы на юридический адрес.';
        } else if (lowerContent.includes('ип') || lowerContent.includes('индивидуальн') && lowerContent.includes('предпринимател')) {
          mockContent = 'Для регистрации ИП в России требуются: Заявление по форме Р21001, Паспорт, ИНН и Квитанция об оплате госпошлины (800 рублей).';
        } else if (lowerContent.includes('план') && lowerContent.includes('ответ')) {
          mockContent = '1. Правовые основы проблемы\n2. Практические рекомендации\n3. Возможные риски и решения';
        } else {
          mockContent = 'Привет! Я Галина, ваш AI-юрист. Я помогу вам с юридическими вопросами. Задайте мне любой вопрос о законодательстве Российской Федерации.';
        }

        const words = mockContent.split(' ');

        let currentContent = '';
        (async () => {
          for (let i = 0; i < words.length; i++) {
            currentContent += (i > 0 ? ' ' : '') + words[i];
            res.write(`data: ${JSON.stringify({ content: currentContent })}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          res.write('data: [DONE]\n\n');
          res.end();
        })();
        return;
      } else {
        // Real streaming with OpenAI GPT-5.1 Chat Completions API
        console.log('Starting real streaming with OpenAI GPT-5.1 Chat Completions API');

        const response = await fetchWithProxy('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-5.1',
            messages: messages,
            max_completion_tokens: max_completion_tokens || 2000,
            stream: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('OpenAI API error:', response.status, errorData);
          return res.status(response.status).json(errorData);
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let streamDone = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || streamDone) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  res.write('data: [DONE]\n\n');
                  streamDone = true;
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  let content = null;

                  // GPT-5.1 streaming uses standard Chat Completions format
                  if (parsed.choices && Array.isArray(parsed.choices) && parsed.choices.length > 0) {
                    content = parsed.choices[0]?.delta?.content || '';
                    console.log('✅ Extracted content from GPT-5.1 streaming Chat Completions format');
                  }

                  // Fallback to Responses API format (output_text)
                  else if (parsed.output_text !== undefined) {
                    content = parsed.output_text;
                    console.log('✅ Extracted content from GPT-5.1 streaming Responses API (output_text)');
                  }

                  // Fallback to old Responses API format
                  else if (parsed.output && Array.isArray(parsed.output) && parsed.output.length > 0) {
                    const firstOutput = parsed.output[0];
                    if (firstOutput.content && Array.isArray(firstOutput.content) && firstOutput.content.length > 0) {
                      content = firstOutput.content[0].text || '';
                      console.log('✅ Extracted content from old Responses API streaming format');
                    }
                  }

                  if (content !== null && content !== '') {
                    fullContent += content;
                    res.write(`data: ${JSON.stringify({ content: fullContent })}\n\n`);
                  }
                } catch (e) {
                  console.warn('⚠️ Failed to parse streaming JSON:', data, e);
                  // Ignore invalid JSON
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
          res.end();
        }
        return;
      }
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('Making request to OpenAI with model:', model, 'stream:', stream);

    if (stream) {
      console.log('Starting streaming response...');
      // Streaming response
      const response = await fetchWithProxy('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          max_completion_tokens: max_completion_tokens,
          temperature,
          stream: true
        })
      });

      console.log('OpenAI response status:', response.status);
      console.log('OpenAI response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenAI API error:', response.status, errorData);
        return res.status(response.status).json(errorData);
      }

      console.log('Starting to stream response...');

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let streamDone = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || streamDone) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                res.write(`data: [DONE]\n\n`);
                streamDone = true;
                break;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                  res.write(`data: ${JSON.stringify({ content: fullContent })}\n\n`);
                }
              } catch (e) {
                // Ignore invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        res.end();
      }
    } else {
      // Test API key validity for non-streaming requests
      let apiKeyValid = false;
      if (apiKey) {
        try {
          console.log('🔍 Testing OpenAI API key validity...');
          // Quick test request to check if API key works
          const testResponse = await fetchWithProxy('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          apiKeyValid = testResponse.ok;
          console.log('🔑 API key valid:', apiKeyValid, 'Status:', testResponse.status);

          // If basic test fails, try Vision API test
          if (!apiKeyValid) {
            console.log('🔍 Basic API test failed, trying Vision API test...');
            const visionTestData = JSON.stringify({
              model: 'gpt-4-turbo',
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: 'test' },
                  { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' } }
                ]
              }],
              max_completion_tokens: 10
            });

            const visionResponse = await fetchWithProxy('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: visionTestData
            });

            console.log('🔍 Vision API test status:', visionResponse.status);
            // Vision API is considered valid if it doesn't return auth errors
            const visionValid = visionResponse.status !== 401 && visionResponse.status !== 403;
            console.log('🔍 Vision API valid:', visionValid);

            // API key is valid if basic test passed (Vision API test is optional)
            // We don't fail the entire API if Vision API test fails
            console.log('🔑 API key valid (basic test passed, Vision API test:', visionValid ? 'passed' : 'failed but optional)', apiKeyValid);
          }
        } catch (error) {
          console.log('❌ API key test failed:', error.message);
          apiKeyValid = false;
        }
      }

      // Check if we can use real API or need demo mode
      const lastMessage = messages[messages.length - 1];
      const isVisionRequest = Array.isArray(lastMessage?.content) &&
                             lastMessage.content.some(item => item.type === 'image_url');

      // Use demo mode only if API key is not valid for non-Vision requests
      // Vision API requests are allowed to try real API even if validation failed
      if (!apiKeyValid && !isVisionRequest) {
        console.log('⚠️ API key not valid and not Vision API request, using demo mode');
        const mockResponse = generateMockResponse(messages, model);
        return res.status(200).json(mockResponse);
      }

      // For Vision API requests, try real API even if validation failed
      if (isVisionRequest && !apiKeyValid) {
        console.log('🖼️ Vision API request with potentially invalid key, trying anyway...');
      }

    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Use GPT-5.1 Responses API for all requests
    const finalModel = 'gpt-5.1';

    // Regular response
    console.log('🔄 Sending request to OpenAI GPT-5.1 Responses API...');
    console.log('📋 Model:', finalModel, isVisionRequest ? '(Vision API)' : '');
    console.log('💬 Messages count:', messages.length);
    console.log('🔑 API Key exists and valid:', !!apiKey && apiKeyValid);

    // Use GPT-5.1 Chat Completions API (GPT-5.1 works through standard endpoint)
    console.log('🔄 Using GPT-5.1 Chat Completions API...');
      const response = await fetchWithProxy('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
        model: 'gpt-5.1',
          messages: messages,
        max_completion_tokens: max_completion_tokens || 2000
        })
      });

      const useResponsesAPI = false;

      console.log('📡 OpenAI response status:', response.status);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = { message: 'Failed to parse error response' };
        }
        console.error('❌ OpenAI API error:', response.status, errorData);

        // For Vision API requests, if we get auth errors, fall back to demo mode
        if (isVisionRequest && (response.status === 401 || response.status === 403)) {
          console.log('🖼️ Vision API auth failed, falling back to demo mode');
          const mockResponse = generateMockResponse(messages, model);
          return res.status(200).json(mockResponse);
        }

        return res.status(response.status).json({ error: 'Internal server error', details: errorData });
      }

      let data;
      try {
        data = await response.json();
      console.log('✅ OpenAI response received successfully');
      } catch (parseError) {
        console.error('❌ Failed to parse response JSON:', parseError);
        return res.status(500).json({
          error: 'Failed to parse OpenAI response',
          details: parseError.message
        });
      }
      console.log('📄 Full response data:', JSON.stringify(data, null, 2));

      // Handle GPT-5.1 response (either Responses API or Chat Completions)
      console.log('📄 GPT-5.1 response data:', JSON.stringify(data, null, 2));

      let content = '';
      try {
        // GPT-5.1 returns standard Chat Completions format
        if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
          const firstChoice = data.choices[0];
          if (firstChoice.message && firstChoice.message.content) {
            content = firstChoice.message.content;
            console.log('✅ Extracted text from GPT-5.1 Chat Completions format (choices[0].message.content)');
          }
        }

        // Fallback to Responses API format (if needed)
        else if (data.output_text) {
          content = data.output_text;
          console.log('✅ Extracted text from GPT-5.1 Responses API (output_text)');
        }

        // Fallback to old Responses API format
        else if (data.output && Array.isArray(data.output) && data.output.length > 0) {
          const firstOutput = data.output[0];
          if (firstOutput.content && Array.isArray(firstOutput.content) && firstOutput.content.length > 0) {
            content = firstOutput.content[0].text || '';
            console.log('✅ Extracted text from old Responses API format (output[0].content[0].text)');
          }
        }

        if (!content) {
          console.log('⚠️ GPT-5.1 returned response but no text found');
          console.log('📋 Response structure:', Object.keys(data));
          content = 'Пустой ответ от модели.';
        } else {
          console.log('✅ Successfully extracted content:', content.substring(0, 100) + (content.length > 100 ? '...' : ''));
        }
      } catch (extractError) {
        console.error('❌ Error extracting content from GPT-5.1 response:', extractError);
        content = 'Ошибка при обработке ответа модели.';
      }

      const legacyResponse = {
        id: data.id || `resp-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-5.1',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: content,
            refusal: null
          },
          finish_reason: 'stop'
        }],
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      };

      // Note: Conversation memory disabled for GPT-4o fallback

      res.status(200).json(legacyResponse);
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Text to Speech endpoint
app.post('/tts', async (req, res) => {
  try {
    console.log('🎵 TTS request received:', {
      text: req.body.text?.substring(0, 50),
      voice: req.body.voice,
      model: req.body.model,
      hasApiKey: !!process.env.OPENAI_API_KEY
    });

    const { text, voice = 'alloy', model = 'tts-1' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    console.log('🔑 TTS API Key check:', {
      exists: !!apiKey,
      length: apiKey?.length,
      startsWith: apiKey?.substring(0, 15) + '...',
      envVarSet: 'OPENAI_API_KEY' in process.env
    });

    // Check if API key exists and is valid
    let apiKeyValid = false;
    if (apiKey) {
      try {
        console.log('🔍 Testing OpenAI API key validity for TTS...');
        // Quick test request to check if API key works
        const testResponse = await fetchWithProxy('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        apiKeyValid = testResponse.ok;
        console.log('🔑 TTS API key valid:', apiKeyValid, 'Status:', testResponse.status);
        if (!apiKeyValid) {
          console.log('❌ API key validation failed, response status:', testResponse.status);
        }
      } catch (error) {
        console.log('❌ TTS API key test failed:', error.message);
        apiKeyValid = false;
      }
    } else {
      console.log('❌ No OPENAI_API_KEY environment variable found');
    }

    // Use demo mode if API key is not valid
    if (!apiKey || !apiKeyValid) {
      console.log('⚠️ TTS API key not valid, using demo mode');
      // Mock response for testing - return a simple audio placeholder
      const mockAudio = Buffer.from([
        0xFF, 0xFB, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]); // Minimal MP3 frame
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', mockAudio.length);
      return res.send(mockAudio);
    }

    console.log('🎵 Requesting TTS from OpenAI:', { text: text.substring(0, 50), voice, model });

    const response = await fetchWithProxy('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => '');
      console.error('❌ OpenAI TTS API error:', response.status, errorData);

      // If we get auth errors, fall back to demo mode
      if (response.status === 401 || response.status === 403) {
        console.log('🔄 TTS auth failed, falling back to demo mode');
        const mockAudio = Buffer.from([
          0xFF, 0xFB, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', mockAudio.length);
        return res.send(mockAudio);
      }

      return res.status(response.status).json({ error: 'Failed to generate speech' });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('TTS Server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Speech to Text endpoint - supports both multipart and raw binary
const sttHandler = async (req, res) => {
  try {
    console.log('🎤 STT Request received');
    console.log('📋 Content-Type:', req.headers['content-type']);

    let audioBuffer;
    let mimeType = 'audio/wav';
    let fileName = 'recording.wav';

    // Check if it's multipart/form-data (multer processed)
    if (req.file) {
      console.log('📁 Received as multipart/form-data');
      audioBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
      fileName = req.file.originalname;
    }
    // Check if it's raw body (express raw parser for /stt/raw)
    else if (req.body && Buffer.isBuffer(req.body)) {
      console.log('📁 Received as raw body buffer (express.raw)');
      audioBuffer = req.body;
      mimeType = req.headers['content-type'] || 'audio/wav';
      fileName = req.headers['content-disposition']?.match(/filename="([^"]+)"/)?.[1] || 'recording.wav';
    }
    // Check if it's raw binary data (fallback for manual streaming)
    else if (req.headers['content-type'] && req.headers['content-type'].includes('audio/')) {
      console.log('📁 Received as raw binary data (manual streaming)');
      audioBuffer = Buffer.from(await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      }));
      mimeType = req.headers['content-type'];
      fileName = req.headers['content-disposition']?.match(/filename="([^"]+)"/)?.[1] || 'recording.wav';
    }
    else {
      console.log('❌ No audio data found in request');
      console.log('📋 Request keys:', Object.keys(req));
      console.log('📋 Body type:', typeof req.body);
      return res.status(400).json({ error: 'No audio data received. Expected multipart/form-data with "audio" field or raw binary data.' });
    }

    console.log('🎵 Audio processing info:', {
      bufferSize: audioBuffer.length,
      mimeType,
      fileName,
      sizeMB: (audioBuffer.length / 1024 / 1024).toFixed(2)
    });

    const apiKey = process.env.OPENAI_API_KEY;
    console.log('🔑 API Key check:', {
      exists: !!apiKey,
      length: apiKey?.length,
      isEmpty: !apiKey || apiKey.trim() === '',
      startsWith: apiKey?.substring(0, 15) + '...' || 'undefined',
      envVarSet: 'OPENAI_API_KEY' in process.env,
      rawValue: apiKey ? `"${apiKey}"` : 'null'
    });

    // Дополнительная проверка - если ключ существует, но некорректный, возвращаем демо
    if (apiKey && (apiKey.trim() === '' || apiKey.length < 20 || (!apiKey.startsWith('sk-') && !apiKey.startsWith('sk-proj-') && !apiKey.startsWith('sk-svc-')))) {
      console.log('🚨 API key exists but invalid - returning demo response');
      return res.json({
        success: true,
        text: 'Привет! Я Галина, ваш AI-юрист. API ключ OpenAI некорректен. Для полноценной работы установите правильный OPENAI_API_KEY в файле api/.env'
      });
    }

    // Проверяем на различные случаи отсутствия ключа
    if (!apiKey || apiKey.trim() === '' || apiKey === 'sk-your-actual-openai-api-key-here') {
      console.log('⚠️ No valid API key configured - returning demo response');
      console.log('💡 To enable real STT, create api/.env file with: OPENAI_API_KEY=your_actual_key_here');
      return res.json({
        success: true,
        text: 'Привет! Я Галина, ваш AI-юрист. К сожалению, API ключ OpenAI не настроен, поэтому я работаю в демо-режиме. Для полноценной работы с голосом установите OPENAI_API_KEY в файле api/.env'
      });
    }

    console.log('📤 About to send to OpenAI - final check:');
    console.log('   API Key exists:', !!apiKey);
    console.log('   API Key length:', apiKey?.length);
    console.log('   API Key starts with:', apiKey?.substring(0, 15) + '...');

    // Дополнительная проверка - если ключ некорректный, возвращаем демо
    if (!apiKey || apiKey.length < 20 || (!apiKey.startsWith('sk-') && !apiKey.startsWith('sk-proj-'))) {
      console.log('🚨 API key validation failed - returning demo response');
      return res.json({
        success: true,
        text: 'Привет! Я Галина, ваш AI-юрист. API ключ OpenAI некорректен. Проверьте правильность ключа в файле api/.env'
      });
    }

    // Используем простой подход с fetch и FormData
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', audioBlob, fileName || 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ru');
    formData.append('response_format', 'json');

    console.log('📝 Prepared FormData for OpenAI:');
    console.log('   Audio blob size:', audioBlob.size);
    console.log('   Audio blob type:', audioBlob.type);

    const response = await fetchWithProxy('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    console.log('📥 OpenAI response status:', response.status);
    console.log('📥 OpenAI response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI STT API error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to transcribe audio',
        details: errorText
      });
    }

    const result = await response.json();
    console.log('✅ OpenAI STT successful:', {
      text: result.text,
      language: result.language,
      duration: result.duration
    });

    if (!result.text || result.text.trim().length === 0) {
      console.warn('⚠️ OpenAI returned empty text');
      return res.json({
        success: true,
        text: 'Извините, не удалось распознать речь. Попробуйте говорить четче.'
      });
    }

    res.json({
      success: true,
      text: result.text.trim()
    });

  } catch (error) {
    console.error('STT Server error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

// Routes for STT with different upload methods
app.post('/stt', upload.single('audio'), handleMulterError, sttHandler); // multipart/form-data
app.post('/stt/raw', sttHandler); // raw binary - middleware applied above

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured'
  });
});

// ===== DATABASE API ENDPOINTS =====

// Получить историю чата пользователя
app.get('/chat/history', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      include: {
        files: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    // Преобразуем timestamp для совместимости с фронтендом
    const formattedMessages = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    }));

    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Сохранить сообщение в базу данных
app.post('/chat/message', async (req, res) => {
  try {
    const { content, role, files = [] } = req.body;
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const message = await prisma.chatMessage.create({
      data: {
        content,
        role,
        userId,
        files: {
          create: files.map(file => ({
            name: file.name,
            type: file.type,
            size: file.size,
            content: file.content,
            userId,
          })),
        },
      },
      include: {
        files: true,
      },
    });

    res.json({ message });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Получить информацию о пользователе
app.get('/user/profile', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        balance: true,
        messages: {
          take: 10,
          orderBy: { timestamp: 'desc' },
        },
        files: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: userProfile });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Получить файлы пользователя
app.get('/files', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const files = await prisma.file.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Загрузить файл
app.post('/files/upload', async (req, res) => {
  try {
    const { name, type, size, content } = req.body;
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const file = await prisma.file.create({
      data: {
        name,
        type,
        size: parseInt(size),
        content,
        userId,
      },
    });

    res.json({ file });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Удалить файл
app.delete('/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    await prisma.file.delete({
      where: { id: fileId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Очистить всю историю чата
app.delete('/chat/history', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    await prisma.chatMessage.deleteMany({
      where: { userId },
    });

    // Создаем приветственное сообщение заново
    const welcomeMessage = await prisma.chatMessage.create({
      data: {
        content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос, и я постараюсь помочь вам с профессиональной консультацией.',
        role: 'assistant',
        userId,
      },
    });

    res.json({
      success: true,
      message: 'Chat history cleared',
      welcomeMessage
    });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// Получить статистику пользователя
app.get('/stats', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const [messageCount, fileCount, balance] = await Promise.all([
      prisma.chatMessage.count({ where: { userId } }),
      prisma.file.count({ where: { userId } }),
      prisma.userBalance.findUnique({ where: { userId } }),
    ]);

    res.json({
      stats: {
        messages: messageCount,
        files: fileCount,
        balance: balance?.amount || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Поиск судебных дел через DuckDuckGo API (бесплатно, без API ключей)
const searchDuckDuckGo = async (query) => {
  try {
    const searchQuery = `${query} судебное дело решение`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    
    console.log('🔍 DuckDuckGo search URL:', url);
    
    const response = await fetchWithProxy(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.warn('⚠️ DuckDuckGo search failed:', response.status, response.statusText);
      return [];
    }

    const html = await response.text();
    console.log('📄 DuckDuckGo HTML length:', html.length);
    console.log('📄 DuckDuckGo HTML preview:', html.substring(0, 500));

    const cases = [];
    const seenUrls = new Set();
    
    // Ищем все ссылки в HTML
    const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    const allLinks = [];
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      
      if (url && title && title.length > 10) {
        allLinks.push({ url, title });
      }
    }
    
    console.log(`📊 Total links found in HTML: ${allLinks.length}`);
    
    // Ключевые слова для поиска судебных дел
    const courtKeywords = [
      'sudrf', 'sudact', 'rospravosudie', 'kad.arbitr',
      'суд', 'судебн', 'решение', 'дело', 'арбитраж',
      'court', 'judicial', 'verdict', 'case'
    ];
    
    // Ищем ссылки, которые содержат ключевые слова
    for (const link of allLinks) {
      if (cases.length >= 10) break;
      
      const urlLower = link.url.toLowerCase();
      const titleLower = link.title.toLowerCase();
      
      // Проверяем, содержит ли URL или заголовок ключевые слова
      const hasCourtKeyword = courtKeywords.some(keyword => 
        urlLower.includes(keyword) || titleLower.includes(keyword)
      );
      
      if (hasCourtKeyword && !seenUrls.has(link.url)) {
        seenUrls.add(link.url);
        
        // Определяем источник по URL
        let source = 'unknown';
        if (urlLower.includes('sudrf')) source = 'sudrf.ru';
        else if (urlLower.includes('sudact')) source = 'sudact.ru';
        else if (urlLower.includes('rospravosudie')) source = 'rospravosudie.com';
        else if (urlLower.includes('kad.arbitr')) source = 'kad.arbitr.ru';
        else if (urlLower.includes('суд') || urlLower.includes('court')) source = 'court.ru';
        
        // Извлекаем название суда из URL или заголовка
        let court = source;
        const courtMatch = link.url.match(/([^\/]+\.(ru|com|org))/i);
        if (courtMatch) {
          court = courtMatch[1];
        }
        
              cases.push({
          title: link.title.substring(0, 200),
                court: court,
          date: new Date().toLocaleDateString('ru-RU'),
          source: source,
          url: link.url.startsWith('http') ? link.url : `https://${link.url}`
        });
      }
    }
    
    console.log(`⚖️ Total court cases found: ${cases.length}`);
    
    // Если не нашли через ключевые слова, возвращаем первые несколько ссылок как примеры
    if (cases.length === 0 && allLinks.length > 0) {
      console.log('⚠️ No court-specific links found, returning general legal links');
      for (let i = 0; i < Math.min(3, allLinks.length); i++) {
        const link = allLinks[i];
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          cases.push({
            title: link.title.substring(0, 200),
            court: 'general',
            date: new Date().toLocaleDateString('ru-RU'),
            source: 'search',
            url: link.url.startsWith('http') ? link.url : `https://${link.url}`
          });
        }
      }
    }

    return cases;
  } catch (error) {
    console.error('❌ DuckDuckGo search error:', error);
    return [];
  }
};

// Поиск судебных дел
app.post('/search-court-cases', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is required' });
    }

    console.log('🔍 Searching court cases for query:', query);

    // Вариант 1: DuckDuckGo API (бесплатно, без API ключей)
    let courtCases = await searchDuckDuckGo(query);

    // Если результатов мало, можно добавить другие источники:
    // - Парсинг sudrf.ru напрямую
    // - Парсинг sudact.ru напрямую
    // - Использование других бесплатных API

    console.log(`⚖️ Found ${courtCases.length} court cases for query: "${query}"`);

    res.json({
      success: true,
      query,
      cases: courtCases,
      count: courtCases.length
    });
  } catch (error) {
    console.error('Error searching court cases:', error);
    res.status(500).json({
      error: 'Failed to search court cases',
      details: error.message
    });
  }
});

// Сохранение анализа документа
app.post('/document-analyses', async (req, res) => {
  try {
    const { title, fileName, fileSize, analysis } = req.body;

    if (!title || !fileName || !fileSize || !analysis) {
      return res.status(400).json({ error: 'All fields are required: title, fileName, fileSize, analysis' });
    }

    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const documentAnalysis = await prisma.documentAnalysis.create({
      data: {
        title,
        fileName,
        fileSize: parseInt(fileSize),
        analysis,
        userId: user.id
      }
    });

    console.log('📄 Document analysis saved:', documentAnalysis.id);
    res.json({ documentAnalysis });
  } catch (error) {
    console.error('Error saving document analysis:', error);
    res.status(500).json({ error: 'Failed to save document analysis' });
  }
});

// Получение списка анализов пользователя
app.get('/document-analyses', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const analyses = await prisma.documentAnalysis.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📄 Retrieved ${analyses.length} document analyses for user`);
    res.json({ analyses });
  } catch (error) {
    console.error('Error retrieving document analyses:', error);
    res.status(500).json({ error: 'Failed to retrieve document analyses' });
  }
});

// Получение конкретного анализа
app.get('/document-analyses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const analysis = await prisma.documentAnalysis.findFirst({
      where: {
        id,
        userId: user.id
      }
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Document analysis not found' });
    }

    console.log('📄 Retrieved document analysis:', analysis.id);
    res.json({ analysis });
  } catch (error) {
    console.error('Error retrieving document analysis:', error);
    res.status(500).json({ error: 'Failed to retrieve document analysis' });
  }
});

// Обновление анализа (изменение названия)
app.put('/document-analyses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const analysis = await prisma.documentAnalysis.updateMany({
      where: {
        id,
        userId: user.id
      },
      data: {
        title,
        updatedAt: new Date()
      }
    });

    if (analysis.count === 0) {
      return res.status(404).json({ error: 'Document analysis not found' });
    }

    console.log('📄 Document analysis updated:', id);
    res.json({ success: true, updated: analysis.count });
  } catch (error) {
    console.error('Error updating document analysis:', error);
    res.status(500).json({ error: 'Failed to update document analysis' });
  }
});

// Удаление анализа
app.delete('/document-analyses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const analysis = await prisma.documentAnalysis.deleteMany({
      where: {
        id,
        userId: user.id
      }
    });

    if (analysis.count === 0) {
      return res.status(404).json({ error: 'Document analysis not found' });
    }

    console.log('📄 Document analysis deleted:', id);
    res.json({ success: true, deleted: analysis.count });
  } catch (error) {
    console.error('Error deleting document analysis:', error);
    res.status(500).json({ error: 'Failed to delete document analysis' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL}`);
});
