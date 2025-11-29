// Проверка переменных окружения на сервере
const dotenv = require('./api/node_modules/dotenv');

// Загружаем .env файл
const result = dotenv.config({ path: './api/.env' });

console.log('📋 Проверка загрузки .env файла:\n');

console.log('✅ dotenv loaded:', result.error ? 'с ошибкой' : 'успешно');
if (result.error) {
  console.log('❌ Ошибка:', result.error.message);
}

console.log('\n🔍 Переменные окружения:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 20)}...` : '❌ не найден');
console.log('PROXY_HOST:', process.env.PROXY_HOST || '❌ не найден');
console.log('PROXY_PORT:', process.env.PROXY_PORT || '❌ не найден');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ найден' : '❌ не найден');

console.log('\n💡 Если все переменные загружены, API сервер должен работать правильно.');
console.log('💡 Если OPENAI_API_KEY отсутствует, проверьте файл api/.env');
