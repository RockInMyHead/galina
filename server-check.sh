#!/bin/bash

echo "🔍 ДИАГНОСТИКА СЕРВЕРА GALINA"
echo "================================"

# Проверка что мы на сервере
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx не установлен"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен"
    exit 1
fi

echo "✅ Система: $(uname -s) $(uname -r)"

# Проверка Nginx
echo ""
echo "🌐 NGINX СТАТУС:"
echo "---------------"
sudo systemctl is-active nginx 2>/dev/null && echo "✅ Nginx активен" || echo "❌ Nginx не активен"

if sudo nginx -t 2>/dev/null; then
    echo "✅ Конфигурация Nginx корректна"
else
    echo "❌ Ошибка в конфигурации Nginx"
fi

# Проверка backend
echo ""
echo "🔧 BACKEND СТАТУС:"
echo "-----------------"
if netstat -tlnp 2>/dev/null | grep -q ":3003 "; then
    echo "✅ Backend слушает порт 3003"
else
    echo "❌ Backend НЕ слушает порт 3003"
fi

if command -v pm2 &> /dev/null; then
    if pm2 list 2>/dev/null | grep -q "galina-backend"; then
        echo "✅ PM2 процесс galina-backend запущен"
    else
        echo "❌ PM2 процесс galina-backend НЕ запущен"
    fi
fi

# Тест API локально
echo ""
echo "🔗 ТЕСТ API ЛОКАЛЬНО:"
echo "--------------------"
if curl -s http://localhost:3003/api/test-proxy 2>/dev/null | grep -q "Proxy is working correctly"; then
    echo "✅ Backend API работает локально"
else
    echo "❌ Backend API НЕ работает локально"
fi

# Тест API через домен
echo ""
echo "🌍 ТЕСТ API ЧЕРЕЗ ДОМЕН:"
echo "----------------------"
if curl -s https://lawyer.windexs.ru/api/test-proxy 2>/dev/null | grep -q "Proxy is working correctly"; then
    echo "✅ API работает через домен"
else
    echo "❌ API НЕ работает через домен"
fi

# Тест chat API
echo ""
echo "💬 ТЕСТ CHAT API:"
echo "----------------"
CHAT_RESPONSE=$(curl -s -X POST https://lawyer.windexs.ru/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: diagnostic-test" \
  -d '{"messages":[{"role":"user","content":"test"}],"model":"gpt-5.1"}' 2>/dev/null)

if echo "$CHAT_RESPONSE" | grep -q "Галина"; then
    echo "✅ Chat API работает корректно"
elif echo "$CHAT_RESPONSE" | grep -q "doctype html"; then
    echo "❌ Chat API возвращает HTML (Nginx не проксирует)"
else
    echo "❌ Chat API не отвечает или возвращает ошибку"
fi

echo ""
echo "📋 РЕЗУЛЬТАТЫ ДИАГНОСТИКИ:"
echo "=========================="

# Проверка всех условий
BACKEND_LOCAL=$(curl -s http://localhost:3003/api/test-proxy 2>/dev/null | grep -q "Proxy is working correctly" && echo "true" || echo "false")
API_DOMAIN=$(curl -s https://lawyer.windexs.ru/api/test-proxy 2>/dev/null | grep -q "Proxy is working correctly" && echo "true" || echo "false")
CHAT_API=$(echo "$CHAT_RESPONSE" | grep -q "Галина" && echo "true" || echo "false")

if [ "$BACKEND_LOCAL" = "true" ] && [ "$API_DOMAIN" = "true" ] && [ "$CHAT_API" = "true" ]; then
    echo "🎉 ВСЕ СИСТЕМЫ РАБОТАЮТ! Сервер готов к работе."
    echo ""
    echo "🌐 Доступ: https://lawyer.windexs.ru"
    echo "🎤 Голосовое общение: https://lawyer.windexs.ru/voice"
else
    echo "❌ ЕСТЬ ПРОБЛЕМЫ! Нужно исправить:"
    [ "$BACKEND_LOCAL" = "false" ] && echo "  - Backend не работает локально"
    [ "$API_DOMAIN" = "false" ] && echo "  - Nginx не проксирует API"
    [ "$CHAT_API" = "false" ] && echo "  - Chat API не отвечает"
fi

echo ""
echo "📞 ДИАГНОСТИКА ЗАВЕРШЕНА"
