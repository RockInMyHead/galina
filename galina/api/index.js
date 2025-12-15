// ===== MAIN SERVER FILE =====
// Refactored to use modular architecture

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const WebSocket = require('ws');

// Load configuration and modules
const config = require('./config');
const { initializeDatabase, initializeDemoUser } = require('./db/init');
const { corsOptions } = require('./config/cors');
const { errorHandler } = require('./middlewares/error');
const { handleMulterError } = require('./middlewares/multer');
const { sttHandler } = require('./routes/stt');

// Import routes
const chatRoutes = require('./routes/chat');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const userRoutes = require('./routes/user');
const ttsRoutes = require('./routes/tts');
const searchRoutes = require('./routes/search');
const documentRoutes = require('./routes/documents');

// Initialize database and demo user
async function initializeServer() {
  try {
    console.log('🚀 Starting server initialization...');
    await initializeDatabase();
    await initializeDemoUser();
    console.log('🚀 Server initialization completed');

    // Start the server only after initialization
    startServer();
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    console.error('Stack:', error.stack);
    // Don't exit in production, let the server try to start anyway
    if (config.NODE_ENV !== 'production') {
      process.exit(1);
    }
    // In production, try to start server anyway
    startServer();
  }
}

// Start server function
function startServer() {

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

      if (lowerContent.includes('потребител') && lowerContent.includes('прав') && lowerContent.includes('нарушени')) {
        // Question about consumer rights violation
        responseContent = `## Защита прав потребителей

При нарушении ваших прав как потребителя вы имеете право на защиту в соответствии с Законом РФ "О защите прав потребителей". Вот что делать:

### Шаги для защиты ваших прав:

1. **Соберите доказательства:**
   - Договор купли-продажи, чек, квитанцию
   - Фотографии товара/услуги
   - Переписку с продавцом/исполнителем
   - Свидетельские показания

2. **Напишите претензию:**
   - Укажите ваши требования (замена, ремонт, возврат денег)
   - Сослаться на нормы Закона о защите прав потребителей
   - Установите срок для ответа (10 дней)

3. **Если претензия не помогла:**
   - Обратитесь в Роспотребнадзор
   - Подайте иск в суд
   - Обратитесь в общество защиты прав потребителей

### Ваши права как потребителя:

**При покупке некачественного товара:**
- Замена на качественный товар
- Соразмерное уменьшение цены
- Безвозмездный ремонт
- Возврат денег и расторжение договора

**При оказании некачественной услуги:**
- Безвозмездное устранение недостатков
- Повторное оказание услуги
- Возврат денег

**Сроки для предъявления претензий:**
- Для товаров: в пределах гарантийного срока или 2 лет
- Для услуг: в течение срока службы или 10 лет

Хотите, чтобы я помог вам составить претензию или исковое заявление?`;
      } else if (lowerContent.includes('расторгнуть') && lowerContent.includes('трудовой') && lowerContent.includes('договор')) {
        // Question about terminating employment contract
        responseContent = `## Расторжение трудового договора

Для расторжения трудового договора предусмотрено несколько оснований. Вот основные случаи:

### По инициативе работника:
1. **Увольнение по собственному желанию** - работник пишет заявление за 2 недели
2. **Соглашение сторон** - договоренность с работодателем

### По инициативе работодателя:
1. **Ликвидация организации** - увольнение всех сотрудников
2. **Сокращение штата** - предупреждение за 2 месяца
3. **Нарушение трудовой дисциплины** - прогул, появление в нетрезвом состоянии и т.д.

### По обоюдному согласию:
**Соглашение о расторжении** - наиболее выгодный вариант для обеих сторон

### Порядок действий:
1. Обсудить условия расторжения с работодателем
2. Подготовить необходимые документы
3. Получить расчет и трудовую книжку
4. Зарегистрироваться в центре занятости (при увольнении не по собственному желанию)

**Важно:** При увольнении работодатель обязан выплатить:
- Заработную плату за отработанное время
- Компенсацию за неиспользованный отпуск
- Выходное пособие (в некоторых случаях)

Если вы столкнулись с нарушением ваших прав при увольнении, рекомендую обратиться в трудовую инспекцию или суд.`;
      } else if (lowerContent.includes('регистрац') && lowerContent.includes('ооо') ||
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
      } else if (lowerContent.includes('трудовой') && lowerContent.includes('договор') && !lowerContent.includes('расторгнуть')) {
        // Question about employment contract
        responseContent = `## Трудовой договор

Трудовой договор - это соглашение между работником и работодателем, устанавливающее взаимные права и обязанности.

### Обязательные условия трудового договора:

1. **Место работы** - указывается организация и ее местонахождение
2. **Трудовая функция** - должность, специальность, квалификация
3. **Дата начала работы** - когда работник приступает к исполнению обязанностей
4. **Условия оплаты труда** - размер оклада, доплаты, надбавки
5. **Режим рабочего времени и времени отдыха**
6. **Компенсации и льготы** (если предусмотрены)
7. **Характер работы** (подвижной, разъездной и т.д.)

### Права и обязанности сторон:

**Работодатель обязан:**
- Своевременно выплачивать заработную плату
- Обеспечивать безопасные условия труда
- Предоставлять ежегодный оплачиваемый отпуск
- Вести трудовую книжку работника

**Работник обязан:**
- Добросовестно выполнять трудовые обязанности
- Соблюдать трудовую дисциплину
- Соблюдать требования охраны труда
- Бережно относиться к имуществу работодателя

Хотите, чтобы я помог вам составить трудовой договор или разъяснил какие-либо конкретные аспекты?`;
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
      } else if (lowerContent.includes('что такое') || lowerContent.includes('что значит') || lowerContent.includes('объясни')) {
        // Handle "what is" questions
        responseContent = `Я отвечу на ваш вопрос о законодательстве.

Пока я работаю в демо-режиме, но в полной версии я бы дал подробный юридический анализ.

**Что я могу объяснить:**
- Нормы гражданского, уголовного, трудового права
- Процедуры судопроизводства
- Права и обязанности сторон в договорах
- Налоговое законодательство
- Защита прав потребителей

Задайте более конкретный вопрос, и я предоставлю подробный юридический анализ!`;
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

  // Configure middleware
app.use(cors(corsOptions));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

  // API routes
  app.use('/chat', chatRoutes);
  app.use('/auth', authRoutes);
  app.use('/files', fileRoutes);
  app.use('/user', userRoutes);
  app.use('/tts', ttsRoutes);
  app.use('/search', searchRoutes);
  app.use('/documents', documentRoutes);

  // Special STT routes with multer middleware
  app.post('/stt', upload.single('audio'), handleMulterError, sttHandler);
  app.post('/stt/raw', sttHandler);

  // Test endpoint to verify proxy is working
  app.get('/test-proxy', async (req, res) => {
    try {
      const { fetchWithProxy } = require('./config/proxy');
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

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: config.DATABASE_URL ? 'configured' : 'not configured',
      openai: config.OPENAI_API_KEY ? 'configured' : 'not configured'
    });
  });

  // Error handling middleware
  app.use(errorHandler);

  // Start the HTTP server
  const server = app.listen(config.PORT, config.HOST, () => {
    console.log(`🚀 API server running on ${config.HOST}:${config.PORT}`);
    console.log(`📊 Database: ${config.DATABASE_URL}`);
    console.log(`✅ Server is ready to accept connections`);
  });

  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`⚠️  Port ${config.PORT} is already in use`);
    }
  });

  // Create WebSocket server for voice interactions
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('🔗 WebSocket client connected');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('📨 WebSocket message received:', data.type);

        switch (data.type) {
          case 'greeting':
            // Generate greeting message
            console.log('🎭 Processing greeting request');

            const openaiAdapter = require('./services/openai/adapter');
            const greetingPrompt = `You are Galina, a professional legal assistant. This is the start of a conversation with a user. Please provide a brief, friendly greeting in Russian that introduces yourself as a legal assistant and invites the user to ask their legal questions. Keep it under 50 words.`;

            try {
              const response = await openaiAdapter.createChatCompletion({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: greetingPrompt }],
                max_completion_tokens: 150,
                temperature: 0.7,
              });

              const greetingText = response.choices[0].message.content;

              console.log('🎭 Greeting generated:', greetingText);

              // Send greeting as TTS
              ws.send(JSON.stringify({
                type: 'tts_start',
                text: greetingText
              }));

              // For demo, also send as LLM response
              ws.send(JSON.stringify({
                type: 'llm_response',
                text: greetingText
              }));

              // End TTS
              setTimeout(() => {
                ws.send(JSON.stringify({
                  type: 'tts_end'
                }));
              }, 2000); // Simulate TTS duration
            } catch (error) {
              console.error('❌ Greeting generation failed:', error);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to generate greeting'
              }));
            }
            break;

          case 'audio':
            // Handle audio transcription and LLM processing
            console.log('🎤 Processing audio message');

            try {
              // Audio comes as base64 string in data.audio_data
              const audioBase64 = data.audio_data;
              if (!audioBase64) {
                throw new Error('No audio data provided');
              }

              console.log('🎵 Transcribing audio...');

              // Convert base64 to buffer for Whisper API
              const audioBuffer = Buffer.from(audioBase64, 'base64');

              // Transcribe audio using Whisper API
              const transcriptionResult = await openaiAdapter.createTranscription(audioBuffer, {
                language: 'ru'
              });

              const transcribedText = transcriptionResult.text?.trim();

              console.log('📝 Transcription result:', transcribedText);

              if (!transcribedText) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'No speech detected in audio'
                }));
                return;
              }

              // Send transcription result to client
              ws.send(JSON.stringify({
                type: 'transcription',
                text: transcribedText
              }));

              console.log('🤖 Sending to LLM...');

              // Process with ChatGPT
              const llmPrompt = `You are Galina, a professional legal assistant in Russia. A user asked: "${transcribedText}"

Please provide a helpful, accurate response in Russian. Be professional, concise, and focus on legal aspects. If the question is not legal-related, politely redirect to legal topics.

Response should be in Russian language.`;

              const llmResult = await openaiAdapter.createChatCompletion({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: llmPrompt }],
                max_completion_tokens: 500,
                temperature: 0.7,
              });

              const responseText = llmResult.choices[0].message.content;

              console.log('💬 LLM response:', responseText);

              // Send LLM response to client
              ws.send(JSON.stringify({
                type: 'llm_response',
                text: responseText
              }));

              // Generate TTS for the response
              console.log('🔊 Generating TTS...');

              const audioBufferResponse = await openaiAdapter.createSpeech({
                text: responseText,
                voice: 'nova',
                model: 'tts-1',
                response_format: 'wav'
              });

              const audioBase64Response = Buffer.from(audioBufferResponse).toString('base64');

              console.log('🎵 TTS generated, sending complete audio file...');

              // Send TTS start
              ws.send(JSON.stringify({
                type: 'tts_start'
              }));

              // Send complete audio file
              ws.send(JSON.stringify({
                type: 'tts_audio',
                audio_data: audioBase64Response,
                format: 'wav'
              }));

              // Send TTS end
              ws.send(JSON.stringify({
                type: 'tts_end'
              }));

              console.log('✅ Audio processing complete');
            } catch (error) {
              console.error('❌ Audio processing error:', error);
              ws.send(JSON.stringify({
                type: 'error',
                message: `Audio processing failed: ${error.message}`
              }));
            }
            break;

          default:
            console.log('⚠️ Unknown message type:', data.type);
            ws.send(JSON.stringify({
              type: 'error',
              message: `Unknown message type: ${data.type}`
            }));
        }
      } catch (error) {
        console.error('WebSocket message processing error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Message processing failed'
        }));
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('⚠️ WebSocket error:', error);
    });
  });
}

// Initialize database and start server
initializeServer().catch(error => {
  console.error('❌ Server initialization failed:', error);
  // Don't exit process in production, just log error
  if (config.NODE_ENV !== 'production') {
    process.exit(1);
  }
});
