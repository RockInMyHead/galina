#!/bin/bash
echo "=== ТЕСТИРОВАНИЕ OPENAI TTS API ==="
echo ""

# Проверяем, запущен ли сервер
if ! curl -s http://localhost:3003/health > /dev/null; then
    echo "❌ API сервер не запущен!"
    echo "Запустите: ./start-dev.sh"
    exit 1
fi

echo "✅ API сервер работает"

# Тестируем TTS
echo ""
echo "🧪 Тестируем TTS API..."
curl -s -X POST http://localhost:3003/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Привет, это тест голосового синтеза", "voice":"alloy", "model":"tts-1"}' \
  -o test_tts.mp3

FILE_SIZE=$(stat -f%z test_tts.mp3 2>/dev/null || wc -c < test_tts.mp3)
echo "📊 Размер полученного файла: $FILE_SIZE байт"

if [ "$FILE_SIZE" -gt 1000 ]; then
    echo "✅ УСПЕХ! OpenAI TTS работает корректно"
    echo "🎵 Файл содержит реальный MP3 аудио"
    echo "🎉 Голосовое общение готово к работе!"
else
    echo "❌ ОШИБКА! Получен mock аудио файл ($FILE_SIZE байт)"
    echo "🔧 Проверьте API ключ в api/.env файле"
    echo "💡 Возможно, API ключ неправильный или истёк"
    echo ""
    echo "📝 Инструкции:"
    echo "1. Откройте api/.env"
    echo "2. Замените: OPENAI_API_KEY=sk-your-actual-openai-api-key-here"
    echo "3. На ваш реальный ключ: OPENAI_API_KEY=sk-proj-..."
    echo "4. Перезапустите серверы: ./stop-dev.sh && ./start-dev.sh"
fi

echo ""
echo "📁 Файл сохранён как: test_tts.mp3"
echo "🎵 Можете прослушать файл, чтобы проверить качество аудио"
