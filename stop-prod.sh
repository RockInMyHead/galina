#!/bin/bash

echo "🛑 Останавливаем Production сервер Галины AI-Юриста..."
echo "===================================================="

# Остановить Vite preview (production)
echo "Останавливаем Vite preview (production)..."
pkill -f "vite.*preview" 2>/dev/null || echo "Vite preview не найден"

# Остановить Node.js процессы
echo "Останавливаем Node.js процессы..."
pkill -f "node.*index.js" 2>/dev/null || echo "API сервер не найден"

# Проверить порты
echo ""
echo "Проверяем порты..."
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Порт 3002 все еще занят"
else
    echo "✅ Порт 3002 освобожден"
fi

if lsof -Pi :3003 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Порт 3003 все еще занят"
else
    echo "✅ Порт 3003 освобожден"
fi

echo ""
echo "🎉 Production сервер остановлен!"
