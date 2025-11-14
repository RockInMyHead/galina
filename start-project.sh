#!/bin/bash

# Скрипт для запуска всего проекта Галиной (frontend + backend)
echo "🚀 Запуск проекта Галиной..."

# Функция для проверки доступности порта
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "❌ Порт $port уже занят"
        return 1
    else
        echo "✅ Порт $port свободен"
        return 0
    fi
}

# Проверяем порты
echo "📋 Проверка доступности портов:"
check_port 3000 && VITE_OK=true || VITE_OK=false
check_port 3001 && API_OK=true || API_OK=false

if [ "$VITE_OK" = false ] || [ "$API_OK" = false ]; then
    echo ""
    echo "🔧 Освободите занятые порты или остановите конфликтующие процессы"
    echo "Примеры команд:"
    echo "  lsof -ti:3000 | xargs kill -9  # для порта 3000"
    echo "  lsof -ti:3001 | xargs kill -9  # для порта 3001"
    exit 1
fi

# Запускаем API сервер в фоне
echo ""
echo "🔄 Запуск API сервера на порту 3001..."
cd api
./start-server.sh &
API_PID=$!
cd ..

# Ждем запуска API сервера
echo "⏳ Ожидание запуска API сервера..."
sleep 3

# Проверяем что API сервер запустился
if curl -s http://localhost:3001/chat -X POST -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"ping"}], "model":"gpt-3.5-turbo"}' > /dev/null 2>&1; then
    echo "✅ API сервер успешно запущен"
else
    echo "❌ Ошибка запуска API сервера"
    kill $API_PID 2>/dev/null
    exit 1
fi

# Запускаем frontend dev сервер
echo ""
echo "🔄 Запуск frontend dev сервера..."
npm run dev -- --port 3000 &
VITE_PID=$!

# Ждем запуска Vite
sleep 5

# Проверяем что frontend доступен
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend сервер успешно запущен"
else
    echo "⚠️  Frontend сервер может запускаться..."
fi

echo ""
echo "🎉 Проект Галиной запущен!"
echo ""
echo "📍 Доступ к приложению:"
echo "   Frontend: http://localhost:3000"
echo "   API: http://localhost:3001"
echo ""
echo "🛑 Для остановки всех серверов:"
echo "   kill $API_PID $VITE_PID"
echo "   или Ctrl+C в соответствующих терминалах"
echo ""
echo "📊 PID процессов:"
echo "   API сервер: $API_PID"
echo "   Vite сервер: $VITE_PID"
