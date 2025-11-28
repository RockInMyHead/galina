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
check_port 3004 && API_OK=true || API_OK=false

if [ "$VITE_OK" = false ] && ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo ""
    echo "🔧 Освободите порт 3000 или остановите конфликтующие процессы"
    echo "Примеры команд:"
    echo "  lsof -ti:3000 | xargs kill -9  # для порта 3000"
    echo "  ./stop-project.sh"
    exit 1
fi

if [ "$API_OK" = false ] && ! curl -s http://localhost:3004/health > /dev/null 2>&1; then
    echo ""
    echo "🔧 Освободите порт 3004 или остановите конфликтующие процессы"
    echo "Примеры команд:"
    echo "  lsof -ti:3004 | xargs kill -9  # для порта 3004"
    echo "  ./stop-project.sh"
    exit 1
fi

# Проверяем и запускаем API сервер если нужно
if curl -s http://localhost:3004/health > /dev/null 2>&1; then
    echo "✅ API сервер уже запущен на порту 3004"
else
    echo "🔄 Запуск API сервера на порту 3004..."
    cd api
    PORT=3004 DATABASE_URL="file:./prisma/galina.db" node index.js &
    API_PID=$!
    cd ..

    # Ждем запуска API сервера
    echo "⏳ Ожидание запуска API сервера..."
    sleep 5

    # Проверяем что API сервер запустился
    if curl -s http://localhost:3004/health > /dev/null 2>&1; then
        echo "✅ API сервер успешно запущен"
    else
        echo "❌ Ошибка запуска API сервера"
        kill $API_PID 2>/dev/null
        exit 1
    fi
fi

# Проверяем и запускаем frontend dev сервер если нужно
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend сервер уже запущен на порту 3000"
else
    echo "🔄 Запуск frontend dev сервера..."
    npm run dev &
    VITE_PID=$!
fi

# Ждем запуска Vite
sleep 5

# Проверяем что frontend доступен
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend сервер успешно запущен"
else
    echo "⚠️  Frontend сервер может запускаться..."
fi

# Ждем запуска frontend если он запускался
if [ ! -z "$VITE_PID" ]; then
    sleep 5
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Frontend сервер успешно запущен"
    else
        echo "⚠️  Frontend сервер может запускаться..."
    fi
fi

echo ""
echo "🎉 Проект Галиной запущен!"
echo ""
echo "📍 Доступ к приложению:"
echo "   🌐 Frontend: http://localhost:3000"
echo "   🔧 API: http://localhost:3004"
echo ""
echo "🧪 Тестирование:"
echo "   node test-chat-api.cjs"
echo ""
echo "🛑 Для остановки всех серверов:"
if [ ! -z "$API_PID" ] || [ ! -z "$VITE_PID" ]; then
    echo "   ./stop-project.sh"
    echo "   или kill $API_PID $VITE_PID"
else
    echo "   ./stop-project.sh"
fi
echo ""
if [ ! -z "$API_PID" ] || [ ! -z "$VITE_PID" ]; then
    echo "📊 PID новых процессов:"
    [ ! -z "$API_PID" ] && echo "   API сервер: $API_PID"
    [ ! -z "$VITE_PID" ] && echo "   Vite сервер: $VITE_PID"
    echo ""
    echo "💡 Нажмите Ctrl+C для остановки..."
    trap "echo '🛑 Останавливаю серверы...'; kill $API_PID $VITE_PID 2>/dev/null; exit 0" INT
    wait
fi
