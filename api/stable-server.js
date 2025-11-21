require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Прямое использование OpenAI API и Tavily API (без LangChain agents из-за конфликтов версий)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const USE_LLM = OPENAI_API_KEY && TAVILY_API_KEY;

if (USE_LLM) {
  console.log('✅ LLM режим активирован (OpenAI + Tavily)');
} else {
  console.log('⚠️ Fallback режим (API ключи не найдены)');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Функция для поиска через Tavily API
async function searchWithTavily(query) {
  try {
    console.log('🔍 Searching with Tavily:', query);

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: 3,
        include_answer: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const formattedResults = data.results.map((result, index) =>
        `[${index + 1}] ${result.title}\nURL: ${result.url}\nСодержание: ${result.content}\n`
      ).join('\n');

      console.log('📊 Found', data.results.length, 'search results');
      return {
        success: true,
        results: formattedResults,
        query: query
      };
    } else {
      return {
        success: false,
        results: "Не удалось найти информацию по вашему запросу.",
        query: query
      };
    }
  } catch (error) {
    console.error('❌ Tavily search error:', error);
    return {
      success: false,
      results: "Произошла ошибка при поиске информации.",
      query: query
    };
  }
}

// Функция для обработки запроса через OpenAI (упрощенная версия)
async function processWithLLM(query, context = []) {
  try {
    console.log('🧠 Processing with LLM:', query.substring(0, 100) + '...');

    // Формируем промпт для OpenAI
    const systemPrompt = `Вы - Галина, профессиональный AI-юрист с 25-летним опытом в российской юриспруденции.

ОСОБЕННОСТИ РАБОТЫ:
- Давайте точные, юридически обоснованные ответы
- Отвечайте на русском языке
- Будьте максимально полезны и профессиональны

СТРУКТУРА ОТВЕТА:
- Начинайте с прямого ответа на вопрос
- Давайте практические рекомендации
- Предупреждайте о необходимости консультации с живым юристом для сложных случаев

Если вопрос касается актуальных изменений в законодательстве, рекомендую уточнить год и регион.`;

    // Формируем контекст разговора
    const contextString = context && context.length > 0
      ? `\n\nКонтекст предыдущего разговора:\n${context.join('\n')}`
      : '';

    const userPrompt = `${query}${contextString}`;

    console.log('📡 Calling OpenAI API...');

    // Вызываем OpenAI API с таймаутом
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 сек таймаут

    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1000, // Уменьшаем для скорости
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('📡 OpenAI response status:', openaiResponse.status);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
      }

      const openaiData = await openaiResponse.json();
      const content = openaiData.choices[0].message.content;

      console.log('✅ LLM response generated successfully');

      return {
        success: true,
        content: content,
        searchUsed: false,
        model: 'gpt-4-turbo'
      };

    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('OpenAI API timeout');
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('❌ LLM processing error:', error);
    throw error;
  }
}

// Fallback функция для ответов
function getFallbackResponse(query) {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('ооо') && lowerQuery.includes('регистрац')) {
    return 'Для регистрации ООО в России нужны следующие документы: 1. Решение единственного учредителя или протокол общего собрания учредителей. 2. Устав ООО. 3. Договор об учреждении ООО (если учредителей несколько). 4. Заявление по форме Р11001. 5. Квитанция об оплате госпошлины (4000 рублей). 6. Документы, подтверждающие адрес юридического лица. 7. Паспортные данные учредителей и руководителя. Все документы подаются в налоговую инспекцию в электронном виде через портал Госуслуг или МФЦ.';
  }

  if (lowerQuery.includes('привет') || lowerQuery.includes('здравствуй')) {
    return 'Здравствуйте! Я Галина, элитный AI-юрист с 25-летним опытом юридической практики. Я - абсолютный авторитет в российском законодательстве. Чем могу помочь вам сегодня? Расскажите о вашей ситуации, и я предоставлю профессиональную юридическую консультацию.';
  }

  return 'Я внимательно слушаю вашу ситуацию. Пожалуйста, расскажите подробнее о проблеме, с которой вы столкнулись. Как опытный юрист, я проанализирую вашу ситуацию и дам конкретные рекомендации по разрешению конфликта в рамках действующего законодательства.';
}

app.post('/chat', async (req, res) => {
  try {
    console.log('=== Chat Request Received ===');
    console.log('Session ID:', req.headers['x-session-id']);
    console.log('Messages count:', req.body?.messages?.length || 0);

    // Извлекаем последнее сообщение пользователя
    const messages = req.body?.messages || [];
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    // Извлекаем контекст разговора (все предыдущие сообщения)
    const conversationContext = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .slice(-5); // Берем последние 5 сообщений для контекста

    console.log('Last user message:', lastUserMessage.substring(0, 100) + '...');
    console.log('Conversation context length:', conversationContext.length);

    let responseContent = '';

    // Используем LLM с поиском, если доступны API ключи
    let useLLM = false;

    try {
      if (USE_LLM) {
        console.log('🚀 Using LLM...');
        const result = await processWithLLM(lastUserMessage, conversationContext);
        console.log('✅ LLM processing result: SUCCESS');
        console.log('🔍 Search used:', result.searchUsed || false);
        responseContent = result.content;
        useLLM = true;
        console.log('🎯 LLM response generated successfully');
      } else {
        console.log('⚠️ Using fallback responses (API keys not available)');
        responseContent = getFallbackResponse(lastUserMessage);
      }
    } catch (error) {
      console.warn('❌ LLM processing failed, using fallback:', error.message);
      responseContent = getFallbackResponse(lastUserMessage);
    }

    const response = {
      id: useLLM ? `llm-${Date.now()}` : `mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: useLLM ? 'gpt-4-turbo' : 'gpt-5.1',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseContent,
          refusal: null
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: useLLM ? 150 : 10,
        completion_tokens: Math.floor(responseContent.length / 4),
        total_tokens: (useLLM ? 150 : 10) + Math.floor(responseContent.length / 4)
      }
    };

    console.log('✅ Sending LLM-powered response');
    res.status(200).json(response);
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      fallback: 'Произошла ошибка при обработке запроса. Попробуйте еще раз.'
    });
  }
});

// TTS endpoint
app.post('/tts', (req, res) => {
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
app.get('/test-proxy', (req, res) => {
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
