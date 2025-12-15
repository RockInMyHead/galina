// Chat service - handles chat logic and conversation management
const openaiAdapter = require('./openai/adapter');
const { generateMockResponse } = require('./mock');
const { RESPONSE_FORMATS } = require('./openai/config');

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

class ChatService {
  async processChatRequest({ messages, model, max_completion_tokens, temperature, stream }) {
    console.log('=== New Chat Request ===');
    console.log('Request body:', JSON.stringify({ messages, model, max_completion_tokens, temperature, stream }, null, 2));

    // Check for placeholder API key
    if (!openaiAdapter.apiKey || openaiAdapter.apiKey.trim() === '' || openaiAdapter.apiKey === 'sk-your-actual-openai-api-key-here') {
      console.log('⚠️ No valid API key configured for chat - using demo response');
      console.log('💡 To enable real AI responses, set OPENAI_API_KEY in api/.env');

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
      } else if (userContent.trim() === '') {
        mockContent = 'Извините, ваш вопрос пустой. Пожалуйста, задайте конкретный юридический вопрос.';
      } else {
        mockContent = `Я Галина, ваш AI-юрист. Вы спросили: "${userContent.substring(0, 100)}${userContent.length > 100 ? '...' : ''}".

Для предоставления точной юридической консультации мне нужно больше деталей о вашей ситуации. Пожалуйста, уточните:
- Какой тип юридической проблемы вас интересует?
- В какой сфере права (гражданское, уголовное, трудовое и т.д.)?
- Какие обстоятельства привели к данному вопросу?

Я готов помочь вам с любыми вопросами законодательства Российской Федерации.`;
      }

      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'demo-mode',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: mockContent
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0),
          completion_tokens: mockContent.length,
          total_tokens: messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) + mockContent.length
        }
      };
    }

    // Use real OpenAI API
    if (!stream) {
      console.log('Processing non-streaming request...');

      const lastMessage = messages[messages.length - 1];
      const isVisionRequest = Array.isArray(lastMessage?.content) &&
                             lastMessage.content.some(item => item.type === 'image_url');

      // Use demo mode only if API key is not valid for non-Vision requests
      const shouldUseDemo = !await openaiAdapter.validateApiKey() && !isVisionRequest;

      if (shouldUseDemo) {
        console.log('⚠️ API key not valid and not Vision API request, using demo mode');
        return generateMockResponse(messages, model);
      }

      // For Vision API requests, try real API even if validation failed
      if (isVisionRequest && !await openaiAdapter.validateApiKey()) {
        console.log('🖼️ Vision API request with potentially invalid key, trying anyway...');
      }

      try {
        const params = {
          messages,
          model,
          max_completion_tokens,
          temperature
        };

        const result = isVisionRequest
          ? await openaiAdapter.createVisionCompletion(params, RESPONSE_FORMATS.LEGACY)
          : await openaiAdapter.createChatCompletion(params, RESPONSE_FORMATS.LEGACY);

        console.log('OpenAI response received, sending to client');
        return result;
      } catch (error) {
        console.error('OpenAI API error:', error);
        // Fallback to demo mode on API errors
        return generateMockResponse(messages, model);
      }
    } else {
      // Handle streaming requests
      const apiKeyValid = await openaiAdapter.validateApiKey();

      if (!apiKeyValid) {
        // Mock streaming for testing when no API key
        console.log('No API key - using mock streaming for testing');
        return this.createMockStream(messages, model);
      } else {
        // Real streaming with OpenAI
        console.log('Starting real streaming with OpenAI');
        return openaiAdapter.createChatCompletion({
          messages,
          model,
          max_completion_tokens,
          temperature,
          stream: true
        }, RESPONSE_FORMATS.LEGACY);
      }
    }
  }

  async createMockStream(messages, model) {
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

    // Create a mock streaming response
    const mockStream = new ReadableStream({
      start(controller) {
        const words = mockContent.split(' ');
        let currentContent = '';

        const sendChunk = (index) => {
          if (index >= words.length) {
            // Send final chunk
            controller.enqueue(`data: [DONE]\n\n`);
            controller.close();
            return;
          }

          currentContent += (index > 0 ? ' ' : '') + words[index];
          const chunk = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: {
                content: (index > 0 ? ' ' : '') + words[index]
              },
              finish_reason: index === words.length - 1 ? 'stop' : null
            }]
          };

          controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);

          setTimeout(() => sendChunk(index + 1), 100);
        };

        sendChunk(0);
      }
    });

    return new Response(mockStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

module.exports = new ChatService();
