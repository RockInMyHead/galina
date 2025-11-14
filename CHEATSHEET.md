# 🎯 Шпаргалка профессиональной LLM системы

## ⚡ Самые быстрые команды

```python
# 1 строка - обработать текст
from llm_api import quick_process
quick_process("текст").markdown

# Получить все форматы
r = quick_process("текст")
r.markdown, r.json, r.html, r.summary

# Сохранить результат
r.save_markdown("output.md")
r.save_json("output.json")

# Статистика
r.print_statistics()
```

## 🔧 Основные настройки

```python
from llm_api import LLMAPIClient

# Создать клиент
client = LLMAPIClient(
    max_length=3000,           # Максимальная длина
    similarity_threshold=0.70, # Порог дубликатов
    verbose=True              # Логи
)

# Использовать
result = client.process(text, title="Мой документ")
```

## 🎯 Фильтрация контента

```python
from professional_llm_system import ContentType

result = quick_process(text)

# Получить по типам
result.get_by_type(ContentType.WARNING)     # Предупреждения
result.get_by_type(ContentType.INSTRUCTION) # Инструкции
result.get_by_type(ContentType.DEFINITION)  # Определения
result.get_by_type(ContentType.EXAMPLE)     # Примеры
result.get_by_type(ContentType.RISK)        # Риски
result.get_by_type(ContentType.SUMMARY)     # Резюме
```

## 🌐 Интеграция

```python
# Flask
@app.post('/api/process')
def process():
    return {'result': quick_process(request.json['text']).markdown}

# Telegram
@bot.on_message()
def handle(msg):
    bot.send_message(msg.chat.id, quick_process(msg.text).summary)

# OpenAI
from llm_api import LLMIntegration
result = LLMIntegration.process_openai_response(response)
```

## 📊 Пакетная обработка

```python
docs = [
    {'title': 'Doc1', 'content': '...'},
    {'title': 'Doc2', 'content': '...'},
]

results = client.process_batch(docs)
for r in results:
    print(r.markdown)
```

## 🔧 Кастомизация

```python
def my_handler(response):
    # Ваша обработка
    return response

result = client.process(text, custom_handler=my_handler)
```

## 📈 Статистика

```python
stats = result.statistics
print(f"Сжатие: {stats['compression_ratio']:.1%}")
print(f"Качество: {stats['quality_score']:.1%}")
print(f"Блоков: {stats['chunks_count']}")
```

## 🆘 Быстрое решение проблем

| Проблема | Решение |
|----------|---------|
| Много дубликатов | `similarity_threshold=0.65` |
| Мало дубликатов | `similarity_threshold=0.80` |
| Слишком короткий ответ | `max_length=5000` |
| Слишком медленно | `verbose=False` |
| ModuleNotFoundError | `pip install -r requirements.txt` |

## 🚀 Установка и запуск

```bash
# Установить
pip install -r requirements.txt

# Запустить демо
python run_demo.py

# Примеры использования
python example_usage.py

# Анализ повторений
python llm_response_analysis.py
```

## 📖 Документация

- **QUICK_START.md** - начало за 5 минут
- **README_LLM_SYSTEM.md** - полная документация
- **INTEGRATION_GUIDE.md** - примеры интеграции
- **INDEX.md** - навигация по проекту
- **example_usage.py** - 7 практических примеров

---

**Версия**: 1.0.0 | **Statys**: Production Ready ✅
