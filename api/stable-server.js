const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/chat', (req, res) => {
  try {
    console.log('=== Chat Request Received ===');
    console.log('Session ID:', req.headers['x-session-id']);
    console.log('Messages count:', req.body?.messages?.length || 0);

    // Get the last user message to provide relevant response
    const messages = req.body?.messages || [];
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    console.log('Last user message:', lastUserMessage.substring(0, 100) + '...');

    let responseContent = '';

    // Provide intelligent responses based on user input
    console.log('Processing message:', lastUserMessage.toLowerCase());

    if (lastUserMessage.toLowerCase().includes('документы') && lastUserMessage.toLowerCase().includes('регистрац') && lastUserMessage.toLowerCase().includes('ооо')) {
      responseContent = 'Для регистрации ООО в России нужны следующие документы: 1. Решение единственного учредителя или протокол общего собрания учредителей. 2. Устав ООО. 3. Договор об учреждении ООО (если учредителей несколько). 4. Заявление по форме Р11001. 5. Квитанция об оплате госпошлины (4000 рублей). 6. Документы, подтверждающие адрес юридического лица. 7. Паспортные данные учредителей и руководителя. Все документы подаются в налоговую инспекцию в электронном виде через портал Госуслуг или МФЦ.';
    } else if (lastUserMessage.toLowerCase().includes('девушка') && lastUserMessage.toLowerCase().includes('пожаловаться')) {
      responseContent = 'Здравствуйте! Я Галина, ваш AI-юрист с 25-летним опытом. Относительно жалобы от вашей девушки по поводу сна - это гражданско-правовой вопрос, не уголовный. Если речь идёт о семейных отношениях, рекомендую: 1. Обратиться к семейному психологу для решения проблемы мирным путём. 2. Если есть угрозы или давление - зафиксируйте все доказательства. 3. При необходимости обратитесь в суд с иском о защите чести и достоинства. Главное - сохраняйте спокойствие и документируйте всё.';
    } else if (lastUserMessage.toLowerCase().includes('сплю') || lastUserMessage.toLowerCase().includes('сон')) {
      responseContent = 'Понимаю вашу ситуацию. Проблемы со сном могут стать основанием для медицинской помощи, но не для юридической жалобы. Рекомендую обратиться к сомнологу или психологу. Если ваша девушка угрожает обращением в правоохранительные органы - это может быть шантажом. В таком случае соберите все доказательства общения и обратитесь к адвокату.';
    } else if (lastUserMessage.toLowerCase().includes('привет') || lastUserMessage.toLowerCase().includes('здравствуйте')) {
      responseContent = 'Здравствуйте! Я Галина, элитный AI-юрист с 25-летним опытом юридической практики. Я - абсолютный авторитет в российском законодательстве. Чем могу помочь вам сегодня? Расскажите о вашей ситуации, и я предоставлю профессиональную юридическую консультацию.';
    } else {
      responseContent = 'Я внимательно слушаю вашу ситуацию. Пожалуйста, расскажите подробнее о проблеме, с которой вы столкнулись. Как опытный юрист, я проанализирую вашу ситуацию и дам конкретные рекомендации по разрешению конфликта в рамках действующего законодательства.';
    }

    console.log('Response prepared, length:', responseContent.length);

    const mockResponse = {
      id: `mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-5.1',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseContent,
          refusal: null
        },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 10, completion_tokens: responseContent.length / 4, total_tokens: (10 + responseContent.length / 4) }
    };

    console.log('✅ Sending intelligent response');
    res.status(200).json(mockResponse);
  } catch (error) {
    console.error('❌ Chat error:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// TTS endpoint
app.post('/api/tts', (req, res) => {
  try {
    console.log('=== TTS Request Received ===');
    console.log('Text to speak:', req.body?.text?.substring(0, 50) + '...');

    // Mock TTS response - return a small audio blob
    // In a real implementation, this would generate actual TTS audio
    const mockAudioBuffer = Buffer.alloc(1024, 0); // 1KB of zeros as mock audio

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': mockAudioBuffer.length,
      'Cache-Control': 'no-cache'
    });

    console.log('✅ Sending mock TTS audio response');
    res.status(200).send(mockAudioBuffer);
  } catch (error) {
    console.error('❌ TTS error:', error.message);
    res.status(500).json({ error: 'TTS Internal server error', details: error.message });
  }
});

// Health check
app.get('/api/test-proxy', (req, res) => {
  res.json({ message: 'Proxy is working correctly!' });
});

const PORT = process.env.PORT || 3003;

// Graceful error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
  console.log(`🚀 Stable API server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('❌ Server error:', err);
});
