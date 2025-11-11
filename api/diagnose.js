// Диагностика проблем с API сервером
console.log('🔍 Диагностика API сервера...\n');

// 1. Проверяем Node.js
console.log('1. Node.js версия:', process.version);

// 2. Проверяем переменные окружения
console.log('2. Переменные окружения:');
console.log('   PORT:', process.env.PORT || 'не установлена (используется 1041)');
console.log('   DATABASE_URL:', process.env.DATABASE_URL || 'не установлена');

// 3. Проверяем наличие зависимостей
const fs = require('fs');
const path = require('path');

try {
  const packageJson = require('./package.json');
  console.log('3. package.json найден, зависимости:', Object.keys(packageJson.dependencies).length);

  if (fs.existsSync('./node_modules')) {
    console.log('4. node_modules существует');
  } else {
    console.log('4. ❌ node_modules НЕ существует - нужно выполнить npm install');
  }
} catch (e) {
  console.log('3. ❌ package.json не найден или поврежден');
}

// 4. Проверяем базу данных
const dbPath = './prisma/galina.db';
if (fs.existsSync(dbPath)) {
  console.log('5. База данных существует:', dbPath);
} else {
  console.log('5. ❌ База данных не существует - нужно инициализировать Prisma');
}

// 5. Проверяем основные файлы
const requiredFiles = ['index.js', 'prisma/schema.prisma'];
console.log('6. Проверка файлов:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file} существует`);
  } else {
    console.log(`   ❌ ${file} НЕ существует`);
  }
});

console.log('\n📋 Рекомендации:');
console.log('1. Установите зависимости: npm install');
console.log('2. Инициализируйте базу данных: npm run db:push');
console.log('3. Создайте файл .env.local с переменными окружения');
console.log('4. Запустите сервер: npm start');


