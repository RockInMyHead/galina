const express = require('express');
const cors = require('cors');

// LangChain imports (с проверкой доступности)
let ChatOpenAI, AgentExecutor, createOpenAIToolsAgent, TavilySearchResults, ChatPromptTemplate, MessagesPlaceholder;

try {
  ChatOpenAI = require('@langchain/openai').ChatOpenAI;
  ({ AgentExecutor, createOpenAIToolsAgent } = require('langchain/agents'));
  ({ TavilySearchResults } = require('@langchain/community/tools/tavily_search'));
  ({ ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts'));
  console.log('✅ LangChain modules loaded successfully');
} catch (error) {
  console.warn('⚠️ LangChain modules not available, using fallback mode:', error.message);
  ChatOpenAI = null;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// LangChain агент для обработки запросов (только если доступны модули)
let agent = null;

if (ChatOpenAI) {
  class LangChainAgent {
    constructor() {
      this.agentExecutor = null;
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL || "gpt-4-turbo",
        temperature: 0.3,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
    }

    async initializeAgent() {
      if (this.agentExecutor) return;

      console.log('🤖 Initializing LangChain agent...');

      try {
        // Создаем инструменты
        const tools = [
          new TavilySearchResults({
            maxResults: 3,
            apiKey: process.env.TAVILY_API_KEY,
          }),
        ];

        // Создаем промпт для агента
        const prompt = ChatPromptTemplate.fromMessages([
          ["system", `Вы - Галина, профессиональный AI-юрист с 25-летним опытом в российской юриспруденции.

ОСОБЕННОСТИ РАБОТЫ:
- Давайте точные, юридически обоснованные ответы
- Используйте поиск в интернете для актуальной информации
- Отвечайте на русском языке
- Будьте максимально полезны и профессиональны

ИНСТРУМЕНТЫ:
- tavily_search_results_json: Для поиска актуальной информации в интернете

КОГДА ИСПОЛЬЗОВАТЬ ПОИСК:
- Для вопросов о текущих законах, изменениях в законодательстве
- Для поиска судебной практики, прецедентов
- Для актуальной информации о государственных услугах
- Когда нужны свежие новости или обновления

СТРУКТУРА ОТВЕТА:
- Начинайте с прямого ответа на вопрос
- Приводите ссылки на источники при использовании поиска
- Давайте практические рекомендации
- Предупреждайте о необходимости консультации с живым юристом для сложных случаев`],
          ["human", "{input}"],
          new MessagesPlaceholder("agent_scratchpad"),
        ]);

        // Создаем агента
        const agent = await createOpenAIToolsAgent({
          llm: this.llm,
          tools,
          prompt,
        });

        // Создаем исполнителя
        this.agentExecutor = new AgentExecutor({
          agent,
          tools,
          verbose: true,
          maxIterations: 3,
          returnIntermediateSteps: true,
        });

        console.log('✅ LangChain agent initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize LangChain agent:', error);
        this.agentExecutor = null;
      }
    }

    async processQuery(query, context = []) {
      try {
        await this.initializeAgent();

        if (!this.agentExecutor) {
          throw new Error('Agent not available');
        }

        console.log('🧠 Processing query with LangChain:', query.substring(0, 100) + '...');

        // Формируем input с учетом контекста
        const input = context && context.length > 0
          ? `${query}\n\nКонтекст предыдущего разговора:\n${context.join('\n')}`
          : query;

        // Выполняем запрос
        const result = await this.agentExecutor.invoke({
          input,
        });

        console.log('✅ LLM response generated with LangChain');

        return {
          success: true,
          content: result.output,
          searchUsed: result.intermediateSteps?.some(step => step.action.tool === 'tavily_search_results_json') || false,
        };

      } catch (error) {
        console.error('❌ LangChain agent error:', error);
        throw error; // Пробрасываем ошибку для fallback
      }
    }
  }

  agent = new LangChainAgent();
} else {
  console.log('⚠️ LangChain modules not available, using mock responses only');
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

    // Пытаемся использовать LangChain агента, если он доступен
    if (agent) {
      try {
        const result = await agent.processQuery(lastUserMessage, conversationContext);
        console.log('LLM processing result:', result.success ? 'SUCCESS' : 'FALLBACK');
        console.log('Search used:', result.searchUsed || false);
        responseContent = result.content;
      } catch (error) {
        console.warn('LangChain agent failed, using fallback:', error.message);
        responseContent = getFallbackResponse(lastUserMessage);
      }
    } else {
      // Fallback для случаев, когда LangChain недоступен
      console.log('Using fallback responses (LangChain not available)');
      responseContent = getFallbackResponse(lastUserMessage);
    }

    const response = {
      id: agent ? `llm-${Date.now()}` : `mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: agent ? 'gpt-4-turbo' : 'gpt-5.1',
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
        prompt_tokens: 100,
        completion_tokens: Math.floor(responseContent.length / 4),
        total_tokens: 100 + Math.floor(responseContent.length / 4)
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
