#!/usr/bin/env node

// Простой скрипт для запуска API сервера с диагностикой
console.log('🚀 Запуск API сервера Галиной...\n');

// Устанавливаем переменные окружения
process.env.PORT = process.env.PORT || '5001';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/galina.db';

// Проверяем наличие файлов
const fs = require('fs');
const requiredFiles = [
  'index.js',
  './node_modules/express',
  './prisma/schema.prisma'
];

console.log('📋 Проверка необходимых файлов:');
let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - отсутствует`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Некоторые файлы отсутствуют. Выполните:');
  console.log('npm install');
  console.log('npm run db:push');
  process.exit(1);
}

// Проверяем базу данных
const dbPath = './prisma/galina.db';
if (!fs.existsSync(dbPath)) {
  console.log('\n⚠️  База данных не инициализирована. Выполните:');
  console.log('npm run db:push');
}

// Запускаем сервер
console.log('\n🔄 Запуск сервера...');

try {
  require('./index.js');
} catch (error) {
  console.error('❌ Ошибка запуска сервера:', error.message);
  console.log('\n🔧 Возможные решения:');
  console.log('1. Проверьте наличие всех зависимостей: npm install');
  console.log('2. Инициализируйте базу данных: npm run db:push');
  console.log('3. Проверьте переменные окружения в .env.local');
  process.exit(1);
}


