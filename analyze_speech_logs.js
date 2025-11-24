#!/usr/bin/env node

/**
 * Анализатор логов голосового распознавания
 * Помогает диагностировать проблемы с Web Speech API
 */

console.log('🔍 Анализатор логов голосового распознавания');
console.log('==========================================\n');

console.log('📋 Инструкции:');
console.log('1. Откройте http://localhost:3000/voice или https://lawyer.windexs.ru/voice');
console.log('2. Попробуйте голосовое распознавание');
console.log('3. Скопируйте логи из консоли браузера (F12)');
console.log('4. Вставьте логи ниже и нажмите Ctrl+D\n');

console.log('🔧 Возможные проблемы и решения:');
console.log('─────────────────────────────────────────');

const issues = [
  {
    pattern: /Not in secure context|Failed to access assets/,
    problem: 'HTTPS требование',
    solution: 'Запустите с HTTPS: ./dev_https.sh или настройте браузер'
  },
  {
    pattern: /Microphone permission denied|not-allowed/,
    problem: 'Доступ к микрофону запрещен',
    solution: 'Разрешите доступ к микрофону в настройках браузера'
  },
  {
    pattern: /network|network error/i,
    problem: 'Проблемы с сетью',
    solution: 'Проверьте интернет-соединение'
  },
  {
    pattern: /no-speech/i,
    problem: 'Речь не обнаружена',
    solution: 'Говорите громче, ближе к микрофону'
  },
  {
    pattern: /audio-capture/i,
    problem: 'Проблемы с захватом аудио',
    solution: 'Проверьте микрофон в настройках системы'
  },
  {
    pattern: /Web Speech API not supported/i,
    problem: 'API не поддерживается',
    solution: 'Используйте Chrome, Edge или Safari'
  }
];

issues.forEach((issue, index) => {
  console.log(`${index + 1}. ${issue.problem}`);
  console.log(`   Решение: ${issue.solution}\n`);
});

console.log('📊 Ключевые параметры для проверки:');
console.log('- location.protocol должен быть "https:"');
console.log('- window.isSecureContext должен быть true');
console.log('- navigator.mediaDevices должен существовать');
console.log('- SpeechRecognition API должен быть доступен');
console.log('- Микрофон должен быть разрешен\n');

console.log('🛠️ Быстрые команды:');
console.log('- ./dev_https.sh              # Запуск с HTTPS');
console.log('- npm run dev -- --port 3002  # Обычный запуск');
console.log('- open test_speech_recognition.html  # Тестовый файл\n');

console.log('💡 Советы по отладке:');
console.log('- Проверьте вкладку Application > Local Storage в DevTools');
console.log('- Очистите кэш браузера');
console.log('- Попробуйте в режиме инкогнито');
console.log('- Проверьте, не заблокирован ли микрофон другими приложениями\n');

console.log('🎯 Если проблема сохраняется, поделитесь:');
console.log('- Полными логами из консоли');
console.log('- Версией браузера');
console.log('- ОС');
console.log('- Настройками микрофона\n');

