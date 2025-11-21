#!/bin/bash

# Скрипт для настройки HTTPS для разработки
# Это позволит Web Speech API работать на localhost

echo "🔧 Настройка HTTPS для Web Speech API"
echo ""

# Проверка наличия mkcert
if ! command -v mkcert &> /dev/null; then
    echo "❌ mkcert не установлен"
    echo ""
    echo "Установка mkcert:"
    echo "macOS: brew install mkcert"
    echo "Linux: sudo apt install mkcert"
    echo "Windows: choco install mkcert"
    echo ""
    echo "После установки запустите: mkcert -install"
    exit 1
fi

echo "✅ mkcert найден"

# Создание сертификатов для localhost
echo "📄 Создание SSL сертификатов для localhost..."
mkcert localhost 127.0.0.1

echo "✅ Сертификаты созданы"
echo ""
echo "📝 Инструкции:"
echo "1. Добавьте в vite.config.ts:"
echo "   server: {"
echo "     https: {"
echo "       key: './localhost-key.pem',"
echo "       cert: './localhost.pem'"
echo "     }"
echo "   }"
echo ""
echo "2. Перезапустите сервер:"
echo "   npm run dev -- --port 3002"
echo ""
echo "3. Откройте https://localhost:3002"
echo ""
echo "🎉 Готово! Web Speech API теперь будет работать."

