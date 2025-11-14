#!/bin/bash

# Скрипт для запуска API сервера Галиной
echo "🚀 Запуск API сервера Галиной..."

# Устанавливаем переменные окружения
export PORT=3001
export DATABASE_URL="file:./prisma/galina.db"

# Проверяем наличие файлов
REQUIRED_FILES=(
  "index.js"
  "node_modules/express"
  "prisma/schema.prisma"
)

echo "📋 Проверка необходимых файлов:"
for file in "${REQUIRED_FILES[@]}"; do
  if [ -e "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file - отсутствует"
    echo "🔧 Выполните: npm install"
    exit 1
  fi
done

# Проверяем базу данных
DB_PATH="./prisma/galina.db"
if [ ! -f "$DB_PATH" ]; then
  echo "⚠️  База данных не инициализирована. Выполните:"
  echo "npm run db:push"
fi

# Запускаем сервер
echo "🔄 Запуск сервера на порту $PORT..."
exec node index.js
