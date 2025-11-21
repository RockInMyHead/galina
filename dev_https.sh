#!/bin/bash

# Быстрый запуск с HTTPS для тестирования Web Speech API

echo "🚀 Запуск с HTTPS для Web Speech API..."

# Проверяем наличие сертификатов
if [ ! -f "localhost-key.pem" ] || [ ! -f "localhost.pem" ]; then
    echo "📄 Создание SSL сертификатов..."
    if command -v mkcert &> /dev/null; then
        mkcert localhost 127.0.0.1
        echo "✅ Сертификаты созданы"
    else
        echo "❌ mkcert не найден. Установите: brew install mkcert && mkcert -install"
        echo "🔄 Продолжаем без HTTPS..."
        npm run dev -- --port 3002
        exit 0
    fi
fi

echo "🔒 Запуск с HTTPS..."
echo ""
echo "📱 Откройте: https://localhost:3002"
echo "⚠️  Браузер может показать предупреждение безопасности - нажмите 'Дополнительно' > 'Перейти на localhost (небезопасно)'"
echo ""

npm run dev -- --port 3002 --https

