#!/usr/bin/env node

// Скрипт для тестирования прокси-сервера
// Запуск: node test-proxy.js

import { HttpsProxyAgent } from 'https-proxy-agent';
import proxyConfig from './proxy-config.js';

async function testProxy() {
  console.log('🧪 Тестирование прокси-сервера...');
  console.log('📡 Прокси:', proxyConfig.httpProxy);
  console.log('🎯 Цель:', 'https://httpbin.org/ip');

  try {
    console.log('⏳ Отправка запроса через прокси...');

    const response = await fetch('https://httpbin.org/ip', {
      agent: new HttpsProxyAgent(proxyConfig.httpProxy),
      timeout: proxyConfig.timeout.connect
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('✅ Прокси работает!');
    console.log('🌐 Ваш IP через прокси:', data.origin);
    console.log('📍 Заголовки:', JSON.stringify(Object.fromEntries(response.headers), null, 2));

    return true;

  } catch (error) {
    console.error('❌ Ошибка прокси:');
    console.error('📝 Сообщение:', error.message);
    console.error('🔍 Код ошибки:', error.code || 'неизвестен');

    console.log('\n💡 Возможные причины:');
    console.log('1. Прокси-сервер недоступен');
    console.log('2. Неверные учетные данные');
    console.log('3. Блокировка порта/хоста провайдером');
    console.log('4. Проблемы с сетью');

    console.log('\n🔧 Проверьте настройки в proxy-config.js');

    return false;
  }
}

// Запуск тестирования
if (import.meta.url === `file://${process.argv[1]}`) {
  testProxy().then(success => {
    process.exit(success ? 0 : 1);
  });
}

// Экспорт функции тестирования
export { testProxy };
