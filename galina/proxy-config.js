// Прокси конфигурация для проекта Galina
// Все внешние запросы (OpenAI API, TTS, etc.) будут идти через этот прокси

const proxyConfig = {
  // Основной прокси-сервер
  proxy: {
    host: '185.68.187.20',
    port: 8000,
    auth: {
      username: 'rBD9e6',
      password: 'jZdUnJ'
    }
  },

  // HTTP прокси строка (используется в API сервере)
  httpProxy: 'http://rBD9e6:jZdUnJ@185.68.187.20:8000',

  // SOCKS5 прокси строка (альтернатива)
  socksProxy: 'socks5://rBD9e6:jZdUnJ@185.68.187.20:8000',

  // Исключения (не проксировать эти хосты)
  noProxy: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'lawyer.windexs.ru',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ],

  // Статус прокси
  isEnabled: true,

  // Тип прокси (http или socks5)
  type: 'http',

  // Таймауты
  timeout: {
    connect: 10000,
    read: 30000
  }
};

// Экспорт для использования в коде
export default proxyConfig;

// Функция для проверки доступности прокси
const testProxy = async () => {
  try {
    const response = await fetch('https://httpbin.org/ip', {
      agent: new (require('https-proxy-agent'))(proxyConfig.httpProxy),
      timeout: proxyConfig.timeout.connect
    });
    const data = await response.json();
    console.log('✅ Прокси работает, ваш IP:', data.origin);
    return true;
  } catch (error) {
    console.error('❌ Прокси недоступен:', error.message);
    return false;
  }
};

// Экспорт функции тестирования
proxyConfig.test = testProxy;
