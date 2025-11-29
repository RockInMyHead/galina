#!/bin/bash

echo "🚀 Запуск Галины AI-Юриста в PRODUCTION режиме..."
echo "=================================================="

# Остановить предыдущие процессы
echo "🛑 Останавливаем предыдущие серверы..."
pkill -f "vite" 2>/dev/null || true
pkill -f "node.*index.js" 2>/dev/null || true
sleep 2

# Проверить зависимости
echo "📦 Проверяем зависимости..."
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js не установлен!"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm не установлен!"
    exit 1
fi

# Установить зависимости если нужно
if [ ! -d "node_modules" ]; then
    echo "📦 Устанавливаем зависимости frontend..."
    npm install
fi

if [ ! -d "api/node_modules" ]; then
    echo "📦 Устанавливаем зависимости API..."
    cd api && npm install && cd ..
fi

# Собрать production build
echo "🔨 Собираем production build..."
npm run build:prod

if [ $? -ne 0 ]; then
    echo "❌ Ошибка сборки production!"
    exit 1
fi

echo "✅ Production build готов"

# Запустить production сервер
echo "🌐 Запускаем production сервер на порту 3002..."
npm run serve:prod &
PROD_PID=$!

# Подождать немного
sleep 5

# Проверить production сервер
if curl -s http://localhost:3002 >/dev/null 2>&1; then
    echo "✅ Production сервер запущен: http://localhost:3002"
else
    echo "❌ Production сервер не отвечает!"
    kill $PROD_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "🎉 Production сервер запущен успешно!"
echo ""
echo "📱 Доступ к приложению:"
echo "   Production: http://localhost:3002"
echo ""
echo "🎤 Голосовая консультация: http://localhost:3002/voice"
echo ""
echo "📡 API: https://lawyer.windexs.ru/api"
echo ""
echo "🛑 Для остановки: Ctrl+C или ./stop-prod.sh"

# Ожидать завершения
wait
