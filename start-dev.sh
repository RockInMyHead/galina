#!/bin/bash

echo "🚀 Запуск Галины AI-Юриста в режиме разработки..."
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

# Запустить API сервер
echo "🔧 Запускаем API сервер на порту 3003..."
cd api
# Загрузить переменные окружения из .env файла
if [ -f ".env" ]; then
    echo "📋 Загружаем переменные окружения из .env файла..."
    # Экспортировать переменные в текущий shell
    export $(grep -v '^#' .env | xargs)
    echo "✅ Переменные окружения загружены"
else
    echo "⚠️ Файл .env не найден в директории api/"
fi
# Запустить node с переменными окружения
PORT=3003 node index.js &
API_PID=$!
cd ..

# Подождать немного
sleep 3

# Проверить API сервер
if curl -s http://localhost:3003/health >/dev/null 2>&1; then
    echo "✅ API сервер запущен: http://localhost:3003"
else
    echo "❌ API сервер не отвечает!"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

# Запустить frontend сервер
echo "🌐 Запускаем frontend сервер на порту 3001..."
npm run dev -- --port 3001 --host 0.0.0.0 &
FRONTEND_PID=$!

# Подождать немного
sleep 5

# Проверить frontend сервер
if curl -s http://localhost:3001 >/dev/null 2>&1; then
    echo "✅ Frontend сервер запущен: http://localhost:3001"
else
    echo "❌ Frontend сервер не отвечает!"
    kill $API_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "🎉 Все серверы запущены успешно!"
echo ""
echo "📱 Доступ к приложению:"
echo "   Frontend: http://localhost:3001"
echo "   API:      http://localhost:3003"
echo ""
echo "🎤 Голосовая консультация: http://localhost:3001/voice"
echo ""
echo "🛑 Для остановки: Ctrl+C или ./stop-dev.sh"

# Ожидать завершения
wait
