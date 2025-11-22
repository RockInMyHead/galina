#!/bin/bash

echo "🔍 Диагностика API сервера Галины..."
echo "====================================="

# Настройки
API_HOST="lawyer.windexs.ru"
API_PORT="1041"  # Из .env файла
FRONTEND_PORT="1042"

echo "📍 Проверяемые адреса:"
echo "  Frontend: https://$API_HOST:$FRONTEND_PORT"
echo "  API: https://$API_HOST:$API_PORT"
echo "  API proxy: https://$API_HOST/api"
echo ""

# Проверка процессов
echo "🔧 Проверка запущенных процессов:"
echo "PM2 процессы:"
pm2 list 2>/dev/null || echo "PM2 не установлен или не запущен"

echo ""
echo "Node процессы:"
ps aux | grep node | grep -v grep || echo "Node процессы не найдены"

echo ""
echo "Проверка портов:"
echo "Порт $API_PORT (API):"
netstat -tlnp 2>/dev/null | grep ":$API_PORT " || echo "Порт $API_PORT не слушается"

echo ""
echo "🔗 Проверка доступности API:"

# Проверка прямого доступа к API
echo "Прямой доступ к API (порт $API_PORT):"
curl -s -w "HTTP %{http_code}\n" "https://$API_HOST:$API_PORT/health" | head -c 200

echo ""
echo "Через прокси (/api/health):"
curl -s -w "HTTP %{http_code}\n" "https://$API_HOST/api/health" | head -c 200

echo ""
echo "Тест chat API:"
curl -s -X POST -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"test"}]}' "https://$API_HOST/api/chat" | head -c 200

echo ""
echo "📋 Рекомендации:"
echo "1. Проверьте, запущен ли PM2: pm2 status"
echo "2. Перезапустите API: pm2 restart galina"
echo "3. Проверьте логи: pm2 logs galina"
echo "4. Если проблема в Nginx, проверьте конфигурацию"
echo "5. Убедитесь, что порт $API_PORT не занят другим процессом"

echo ""
echo "🔄 Попытка перезапуска API сервера..."

# Попытка перезапуска
if command -v pm2 &> /dev/null; then
    echo "Перезапуск через PM2..."
    pm2 restart galina 2>/dev/null || pm2 restart all 2>/dev/null || echo "Не удалось перезапустить через PM2"
else
    echo "PM2 не найден, пробуем другие способы..."
fi

# Проверка после перезапуска
echo ""
echo "Проверка после перезапуска:"
curl -s "https://$API_HOST/api/health" | head -c 100

echo ""
echo "✅ Диагностика завершена"
