# ⚡ Быстрый старт: Профессиональная LLM система

**За 5 минут вы научитесь обрабатывать LLM ответы профессионально!**

## 📦 Установка (1 минута)

```bash
# Установить зависимости
pip install -r requirements.txt

# Готово!
```

## 🚀 Первый запуск (1 минута)

### Самый простой способ

```python
from llm_api import quick_process

# Ваш LLM ответ
text = "Какие документы нужны для регистрации ООО? ООО требует документов..."

# Обработать в одну строку!
result = quick_process(text)

# Использовать результат
print(result.markdown)  # Красиво отформатированный текст
```

**Вот и всё!** Система автоматически:
- ✅ Обнаружит дубликаты
- ✅ Структурирует контент
- ✅ Оптимизирует размер
- ✅ Оценит качество

## 📊 Получение результатов (1 минута)

```python
result = quick_process(text)

# Разные форматы
print(result.markdown)     # Markdown текст
print(result.json)         # JSON структура
print(result.html)         # HTML
print(result.plaintext)    # Просто текст
print(result.summary)      # Краткое резюме

# Статистика
print(result.statistics)   # Словарь со статистикой
result.print_statistics()  # Красиво вывести

# Сохранить
result.save_markdown("output.md")
result.save_json("output.json")
```

## 🎯 Практические примеры (2 минуты)

### Пример 1: Веб-приложение (Flask)

```python
from flask import Flask, request, jsonify
from llm_api import LLMAPIClient

app = Flask(__name__)
client = LLMAPIClient()

@app.route('/api/process', methods=['POST'])
def process():
    text = request.json['text']
    result = client.process(text)
    return jsonify({'markdown': result.markdown})

if __name__ == '__main__':
    app.run()
```

### Пример 2: Telegram бот

```python
from telegram import Update
from telegram.ext import Application, MessageHandler, ContextTypes, filters
from llm_api import quick_process

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    result = quick_process(text)
    await update.message.reply_text(result.summary)

app = Application.builder().token("YOUR_TOKEN").build()
app.add_handler(MessageHandler(filters.TEXT, handle_message))
app.run_polling()
```

### Пример 3: Пакетная обработка

```python
from llm_api import LLMAPIClient

client = LLMAPIClient()

documents = [
    {'title': 'Doc 1', 'content': 'LLM ответ 1...'},
    {'title': 'Doc 2', 'content': 'LLM ответ 2...'},
    {'title': 'Doc 3', 'content': 'LLM ответ 3...'},
]

# Обработать все за раз
results = client.process_batch(documents)

# Использовать результаты
for result in results:
    print(result.markdown)
    result.print_statistics()
```

## ⚙️ Настройка параметров

```python
from llm_api import LLMAPIClient

# Создать клиент с нужными настройками
client = LLMAPIClient(
    max_length=3000,              # Максимальная длина ответа
    similarity_threshold=0.70,    # Порог для обнаружения дубликатов (0-1)
    verbose=True                  # Показывать логи обработки
)

# Использовать как обычно
result = client.process("Ваш текст")
```

### Рекомендуемые настройки

| Сценарий | max_length | threshold | Описание |
|----------|-----------|-----------|-------------|
| Новости | 2000 | 0.65 | Много повторений, нужна чувствительность |
| Техдокументация | 3000 | 0.75 | Балансирует качество и сжатие |
| Юридические | 5000 | 0.80 | Важно сохранить всю информацию |
| Компактно | 1500 | 0.60 | Максимальное сжатие |

## 🎨 Фильтрация контента

```python
from professional_llm_system import ContentType

result = quick_process(text)

# Получить только предупреждения
warnings = result.get_by_type(ContentType.WARNING)

# Получить только инструкции
instructions = result.get_by_type(ContentType.INSTRUCTION)

# Все типы
# - ContentType.DEFINITION (определения)
# - ContentType.INSTRUCTION (как-то делать)
# - ContentType.WARNING (предупреждения)
# - ContentType.RISK (риски)
# - ContentType.EXAMPLE (примеры)
# - ContentType.SUMMARY (резюме)
```

## 🔧 Кастомизация

```python
from professional_llm_system import ContentType

def my_handler(response):
    """Кастомная обработка результата"""
    # Увеличить важность всех предупреждений
    for chunk in response.chunks:
        if chunk.type == ContentType.WARNING:
            chunk.importance = 1.0
    return response

result = client.process(
    text,
    custom_handler=my_handler
)
```

## 📈 Проверка работы

```python
# Запустить демонстрацию
python run_demo.py

# Или запустить примеры
python example_usage.py
```

## ❓ Частые вопросы

### Q: Сколько текста можно обработать?
**A:** Рекомендуемый максимум - 50,000 символов. Для больше - обрабатывайте по частям.

### Q: Работает ли с английским?
**A:** Да, но система оптимизирована для русского. Для английского может быть менее точна.

### Q: Как быстро работает?
**A:** Типично < 0.1 сек для 2000 символов. Зависит от CPU.

### Q: Можно ли использовать в продакшене?
**A:** Да! Система готова для production. Используйте `verbose=False`.

### Q: Как интегрировать с моей LLM?
**A:** Смотрите `INTEGRATION_GUIDE.md` для примеров с OpenAI, Claude, Ollama и т.д.

## 🚨 Типичные проблемы

### Проблема: "ModuleNotFoundError: No module named 'sklearn'"
**Решение:**
```bash
pip install -r requirements.txt
```

### Проблема: "Памяти не хватает при обработке больших текстов"
**Решение:** Обрабатывайте текст по частям
```python
# Вместо одного большого текста
chunk_size = 10000
for i in range(0, len(text), chunk_size):
    chunk = text[i:i+chunk_size]
    result = quick_process(chunk)
    print(result.markdown)
```

### Проблема: "Слишком много дубликатов удаляется"
**Решение:** Увеличьте порог дубликатов
```python
client = LLMAPIClient(similarity_threshold=0.85)
```

## 📚 Дальше учитесь

1. **README_LLM_SYSTEM.md** - подробное описание всех возможностей
2. **INTEGRATION_GUIDE.md** - примеры интеграции с популярными фреймворками
3. **example_usage.py** - 7 практических примеров использования
4. **professional_llm_system.py** - исходный код системы

## 🎁 Бонусные советы

### Совет 1: Кэширование результатов
```python
from functools import lru_cache

@lru_cache(maxsize=100)
def process_cached(text):
    return quick_process(text).markdown

# Второй вызов вернет из кэша
result1 = process_cached("Text")
result2 = process_cached("Text")  # Быстро!
```

### Совет 2: Параллельная обработка
```python
from concurrent.futures import ThreadPoolExecutor
from llm_api import LLMAPIClient

client = LLMAPIClient()

texts = ["Text 1", "Text 2", "Text 3"]

with ThreadPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(client.process, texts))

for result in results:
    print(result.markdown)
```

### Совет 3: Логирование
```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    result = quick_process(text)
    logger.info(f"Success: {result.statistics['quality_score']:.1%}")
except Exception as e:
    logger.error(f"Failed: {e}")
```

## 🆘 Помощь и поддержка

- 📖 Документация: смотрите MD файлы в папке проекта
- 💬 Примеры: запустите `python run_demo.py`
- 🐛 Проблемы: проверьте requirements.txt и установку

## ✨ Что дальше?

1. ✅ Настроить под свои нужды
2. ✅ Интегрировать в проект
3. ✅ Мониторить качество результатов
4. ✅ Собрать feedback и улучшить

---

**Готовы?** Начните с одной строки кода:
```python
from llm_api import quick_process
result = quick_process("Ваш LLM ответ")
print(result.markdown)
```

**Удачи!** 🚀

