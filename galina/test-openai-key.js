// Скрипт для тестирования OpenAI API ключа
import { HttpsProxyAgent } from 'https-proxy-agent';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('./api/node_modules/dotenv');

// Загружаем переменные окружения
dotenv.config({ path: './api/.env' });

const proxyUrl = `http://${process.env.PROXY_USERNAME || 'rBD9e6'}:${process.env.PROXY_PASSWORD || 'jZdUnJ'}@${process.env.PROXY_HOST || '185.68.187.20'}:${process.env.PROXY_PORT || '8000'}`;
const proxyAgent = new HttpsProxyAgent(proxyUrl);

async function testOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  console.log('🧪 Тестирование OpenAI API ключа...\n');
  console.log('🔑 API Key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'не найден');
  console.log('🌐 Прокси:', proxyUrl.replace(/:([^:@]{4})[^:@]*@/, ':$1***@'));
  
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY не найден в .env файле');
    return;
  }

  try {
    console.log('\n⏳ Отправка тестового запроса к OpenAI...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Say "Hello" in one word.' }],
        max_tokens: 10
      }),
      agent: proxyAgent
    });

    console.log('📡 Ответ от OpenAI:');
    console.log('   Status:', response.status);
    console.log('   OK:', response.ok);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API ключ работает!');
      console.log('📝 Ответ:', data.choices[0]?.message?.content || 'пустой ответ');
    } else {
      const errorText = await response.text();
      console.log('❌ API ключ не работает');
      console.log('📝 Ошибка:', errorText);
      
      if (response.status === 401) {
        console.log('💡 Причина: Неверный API ключ');
      } else if (response.status === 429) {
        console.log('💡 Причина: Превышен лимит запросов');
      } else if (response.status === 403) {
        console.log('💡 Причина: Доступ запрещен (возможно, региональные ограничения)');
      }
    }
    
  } catch (error) {
    console.log('❌ Ошибка при подключении к OpenAI:');
    console.log('📝 Ошибка:', error.message);
    console.log('💡 Возможные причины:');
    console.log('   - Проблемы с прокси');
    console.log('   - Сетевые проблемы');
    console.log('   - OpenAI API недоступен');
  }
}

testOpenAIKey();
