# 🔌 Руководство интеграции профессиональной LLM системы

Практическое руководство по интеграции системы обработки LLM в ваши проекты.

## 📋 Содержание

1. [Базовая интеграция](#базовая-интеграция)
2. [Интеграция с веб-приложениями](#интеграция-с-веб-приложениями)
3. [Интеграция с чатботами](#интеграция-с-чатботами)
4. [Интеграция с системами документации](#интеграция-с-системами-документации)
5. [Примеры для популярных LLM](#примеры-для-популярных-llm)
6. [Кэширование и оптимизация](#кэширование-и-оптимизация)

## 🚀 Базовая интеграция

### Вариант 1: Минимальный код

```python
from llm_api import quick_process

# Ваш LLM ответ
response = get_llm_response(user_query)

# Обработать в одну строку
result = quick_process(response)

# Вывести
print(result.markdown)
```

### Вариант 2: С контролем параметров

```python
from llm_api import LLMAPIClient

# Инициализация один раз
client = LLMAPIClient(
    max_length=3000,
    similarity_threshold=0.70,
    verbose=False
)

# Использование повторяется
result = client.process(response_text, title="My Document")
return result.markdown
```

### Вариант 3: Полный контроль

```python
from professional_llm_system import (
    ProfessionalLLMProcessor,
    ParagraphAnalyzer,
    DuplicateDetector
)

# Создать процессор с кастомными компонентами
processor = ProfessionalLLMProcessor()
processor.paragraph_analyzer = ParagraphAnalyzer()
processor.duplicate_detector = DuplicateDetector(similarity_threshold=0.80)

# Обработать
llm_response = processor.process(text, title="Document")

# Получить результат
output = processor.get_markdown(llm_response)
```

## 🌐 Интеграция с веб-приложениями

### Flask приложение

```python
from flask import Flask, request, jsonify
from llm_api import LLMAPIClient

app = Flask(__name__)
llm_client = LLMAPIClient(verbose=False)

@app.route('/api/process', methods=['POST'])
def process_llm_response():
    """Обработать LLM ответ и вернуть JSON"""
    data = request.json
    text = data.get('text', '')
    title = data.get('title', '')
    
    try:
        result = llm_client.process(text, title)
        
        return jsonify({
            'success': True,
            'markdown': result.markdown,
            'summary': result.summary,
            'statistics': result.statistics,
            'json': result.json
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/process/markdown', methods=['POST'])
def process_as_markdown():
    """Обработать и вернуть только Markdown"""
    data = request.json
    text = data.get('text', '')
    
    result = llm_client.process(text)
    return jsonify({'markdown': result.markdown})

@app.route('/api/process/batch', methods=['POST'])
def process_batch():
    """Обработать несколько ответов"""
    data = request.json
    responses = data.get('responses', [])
    
    results = llm_client.process_batch(responses)
    
    return jsonify({
        'count': len(results),
        'results': [
            {
                'markdown': r.markdown,
                'statistics': r.statistics
            }
            for r in results
        ]
    })

if __name__ == '__main__':
    app.run(debug=True)
```

### Django приложение

```python
# views.py
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.middleware.csrf import csrf_exempt
from llm_api import LLMAPIClient
import json

llm_client = LLMAPIClient()

@csrf_exempt
@require_POST
def process_response(request):
    """Обработать LLM ответ"""
    try:
        data = json.loads(request.body)
        text = data.get('text', '')
        title = data.get('title', '')
        
        result = llm_client.process(text, title)
        
        return JsonResponse({
            'success': True,
            'markdown': result.markdown,
            'json': result.json,
            'statistics': result.statistics
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)

# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('api/process/', views.process_response, name='process_response'),
]
```

### FastAPI приложение

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from llm_api import LLMAPIClient
from typing import List, Optional

app = FastAPI()
llm_client = LLMAPIClient()

class ProcessRequest(BaseModel):
    text: str
    title: Optional[str] = ""

class ProcessBatchRequest(BaseModel):
    responses: List[dict]

@app.post("/api/process")
async def process(request: ProcessRequest):
    """Обработать LLM ответ"""
    try:
        result = llm_client.process(request.text, request.title)
        
        return {
            "success": True,
            "markdown": result.markdown,
            "json": result.json,
            "statistics": result.statistics,
            "summary": result.summary
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/process/batch")
async def process_batch(request: ProcessBatchRequest):
    """Обработать несколько ответов"""
    try:
        results = llm_client.process_batch(request.responses)
        
        return {
            "success": True,
            "count": len(results),
            "results": [
                {
                    "markdown": r.markdown,
                    "statistics": r.statistics
                }
                for r in results
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

## 🤖 Интеграция с чатботами

### Телеграм-бот (python-telegram-bot)

```python
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters
from llm_api import quick_process

class LLMBot:
    def __init__(self, token: str):
        self.app = Application.builder().token(token).build()
        self.setup_handlers()
    
    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            "Привет! Отправь мне LLM ответ и я его оптимизирую.\n"
            "Используй /help для справки."
        )
    
    async def process_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработать LLM ответ"""
        text = update.message.text
        
        # Показать что обрабатываем
        await update.message.chat.send_action("typing")
        
        try:
            # Обработать
            result = quick_process(text)
            
            # Отправить результат
            response = f"**✅ Обработано**\n\n"
            response += f"📊 Статистика:\n"
            response += f"• Оригинальная длина: {result.statistics['original_length']} символов\n"
            response += f"• Оптимизированная: {result.statistics['optimized_length']} символов\n"
            response += f"• Сжатие: {result.statistics['compression_ratio']:.1%}\n"
            response += f"• Качество: {result.statistics['quality_score']:.1%}\n"
            response += f"\n**Результат:**\n"
            response += result.summary[:500] + "..."
            
            await update.message.reply_text(response, parse_mode="Markdown")
            
            # Отправить файл если нужно
            # await update.message.reply_document(...)
            
        except Exception as e:
            await update.message.reply_text(f"❌ Ошибка: {str(e)}")
    
    def setup_handlers(self):
        self.app.add_handler(CommandHandler("start", self.start))
        self.app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.process_message))
    
    def run(self):
        self.app.run_polling()

# Использование
if __name__ == "__main__":
    bot = LLMBot("YOUR_TELEGRAM_TOKEN")
    bot.run()
```

### Discord-бот

```python
import discord
from discord.ext import commands
from llm_api import quick_process

class LLMBot(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
    
    @commands.Cog.listener()
    async def on_ready(self):
        print(f'{self.bot.user} has connected to Discord!')
    
    @commands.command(name='process', help='Обработать LLM ответ')
    async def process_llm(self, ctx, *, text=None):
        """Обработать LLM ответ"""
        if not text:
            await ctx.send("Пожалуйста, укажите текст для обработки")
            return
        
        async with ctx.typing():
            try:
                result = quick_process(text, title=ctx.author.name)
                
                # Отправить результат
                embed = discord.Embed(
                    title="✅ Обработано",
                    description=result.summary[:1500],
                    color=discord.Color.green()
                )
                
                # Добавить поля со статистикой
                stats = result.statistics
                embed.add_field(
                    name="📊 Статистика",
                    value=f"Оригинальная длина: {stats['original_length']}\n"
                          f"Оптимизированная: {stats['optimized_length']}\n"
                          f"Сжатие: {stats['compression_ratio']:.1%}\n"
                          f"Качество: {stats['quality_score']:.1%}",
                    inline=False
                )
                
                await ctx.send(embed=embed)
                
            except Exception as e:
                await ctx.send(f"❌ Ошибка: {str(e)}")

# Настройка
intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix='!', intents=intents)

async def setup():
    await bot.add_cog(LLMBot(bot))

bot.setup_hook = setup
bot.run("YOUR_DISCORD_TOKEN")
```

## 📚 Интеграция с системами документации

### MkDocs плагин

```python
# plugins/llm_processor.py
from mkdocs.plugins import BasePlugin
from mkdocs.config import config_options
from llm_api import quick_process

class LLMProcessorPlugin(BasePlugin):
    config_scheme = (
        ('max_length', config_options.Type(int, default=2000)),
        ('similarity_threshold', config_options.Type(float, default=0.70)),
        ('enabled_tags', config_options.Type(list, default=['llm-process'])),
    )
    
    def on_page_markdown(self, markdown, page, config, files):
        """Обработать markdown с LLM контентом"""
        
        # Проверить если содержит теги для обработки
        if not any(tag in markdown for tag in self.config['enabled_tags']):
            return markdown
        
        # Найти LLM блоки (например, между <!-- llm-process --> и <!-- /llm-process -->)
        import re
        
        pattern = r'<!-- llm-process -->(.*?)<!-- /llm-process -->'
        matches = re.finditer(pattern, markdown, re.DOTALL)
        
        processed = markdown
        for match in matches:
            content = match.group(1).strip()
            
            # Обработать контент
            result = quick_process(content)
            
            # Заменить оригинальный контент
            processed = processed.replace(match.group(0), result.markdown)
        
        return processed

# mkdocs.yml
plugins:
  - search
  - llm_processor:
      max_length: 3000
      similarity_threshold: 0.75
```

### Sphinx расширение

```python
# source/conf.py
from llm_api import quick_process

# В конфигурацию добавить расширение
extensions = [
    'sphinx.ext.autodoc',
    'llm_processor'
]

# source/llm_processor.py
from docutils import nodes
from docutils.parsers.rst import Directive
from llm_api import quick_process

class LLMProcessDirective(Directive):
    has_content = True
    
    def run(self):
        text = '\n'.join(self.content)
        result = quick_process(text)
        
        # Конвертировать markdown в RST если нужно
        output = result.markdown
        
        raw_node = nodes.raw('', output, format='html')
        return [raw_node]

def setup(app):
    app.add_directive("llm-process", LLMProcessDirective)
    return {
        'version': '1.0',
        'parallel_read_safe': True,
    }
```

## 🔗 Примеры для популярных LLM

### OpenAI ChatGPT

```python
import openai
from llm_api import LLMIntegration

async def process_gpt_response(user_query: str) -> str:
    """Получить и обработать ответ от ChatGPT"""
    
    # Получить ответ от OpenAI
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": user_query}
        ]
    )
    
    # Обработать ответ
    result = LLMIntegration.process_openai_response(response)
    
    return result.markdown
```

### Anthropic Claude

```python
import anthropic
from llm_api import LLMIntegration

def process_claude_response(user_query: str) -> str:
    """Получить и обработать ответ от Claude"""
    
    client = anthropic.Anthropic()
    
    message = client.messages.create(
        model="claude-3-opus-20240229",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": user_query}
        ]
    )
    
    # Обработать ответ
    result = LLMIntegration.process_anthropic_response({
        'content': message.content
    })
    
    return result.markdown
```

### Google Gemini

```python
import google.generativeai as genai
from llm_api import quick_process

def process_gemini_response(user_query: str) -> str:
    """Получить и обработать ответ от Gemini"""
    
    genai.configure(api_key="YOUR_API_KEY")
    model = genai.GenerativeModel('gemini-pro')
    
    response = model.generate_content(user_query)
    
    # Обработать ответ
    result = quick_process(response.text)
    
    return result.markdown
```

### Open Source LLMs (Ollama, LLaMA, и т.д.)

```python
import requests
from llm_api import quick_process

def process_local_llm(user_query: str, model_name: str = "mistral") -> str:
    """Получить и обработать ответ от локальной LLM"""
    
    # Запрос к локальной LLM (например, через Ollama)
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": model_name,
            "prompt": user_query,
            "stream": False
        }
    )
    
    if response.status_code == 200:
        text = response.json()['response']
        
        # Обработать ответ
        result = quick_process(text)
        return result.markdown
    else:
        raise Exception(f"Error: {response.status_code}")
```

## ⚙️ Кэширование и оптимизация

### Кэширование результатов

```python
from functools import lru_cache
from llm_api import LLMAPIClient
import hashlib

class CachedLLMClient:
    def __init__(self):
        self.client = LLMAPIClient()
        self.cache = {}
    
    def process(self, text: str, title: str = "") -> str:
        """Процесс с кэшированием"""
        
        # Создать ключ кэша
        cache_key = hashlib.md5(f"{text}:{title}".encode()).hexdigest()
        
        # Проверить кэш
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Обработать
        result = self.client.process(text, title)
        output = result.markdown
        
        # Сохранить в кэш
        self.cache[cache_key] = output
        
        return output
    
    def clear_cache(self):
        self.cache.clear()
```

### Параллельная обработка

```python
import asyncio
from llm_api import LLMAPIClient
from concurrent.futures import ThreadPoolExecutor

class ParallelLLMClient:
    def __init__(self, max_workers: int = 4):
        self.client = LLMAPIClient()
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
    
    async def process_parallel(self, texts: list) -> list:
        """Обработать несколько текстов параллельно"""
        
        loop = asyncio.get_event_loop()
        
        tasks = [
            loop.run_in_executor(
                self.executor,
                self.client.process,
                text
            )
            for text in texts
        ]
        
        results = await asyncio.gather(*tasks)
        return results
    
    async def process_batch_parallel(self, batch_requests: list) -> list:
        """Обработать пакет запросов параллельно"""
        
        loop = asyncio.get_event_loop()
        
        async def process_item(item):
            return await loop.run_in_executor(
                self.executor,
                lambda: self.client.process(
                    item.get('content'),
                    item.get('title', '')
                )
            )
        
        results = await asyncio.gather(*[
            process_item(item) for item in batch_requests
        ])
        
        return results

# Использование
async def main():
    client = ParallelLLMClient()
    
    texts = ["Text 1", "Text 2", "Text 3"]
    results = await client.process_parallel(texts)
    
    for result in results:
        print(result.markdown)

asyncio.run(main())
```

## 🎯 Практические советы

### 1. Оптимальные настройки для разных сценариев

```python
# Для новостей и статей (много дубликатов)
news_client = LLMAPIClient(
    similarity_threshold=0.65,  # Более чувствительно
    max_length=2000
)

# Для технической документации
tech_client = LLMAPIClient(
    similarity_threshold=0.75,
    max_length=3000
)

# Для юридических документов
legal_client = LLMAPIClient(
    similarity_threshold=0.80,  # Менее чувствительно
    max_length=5000
)
```

### 2. Обработка ошибок

```python
from llm_api import quick_process
import logging

logger = logging.getLogger(__name__)

def safe_process(text: str, title: str = "") -> dict:
    """Безопасная обработка с логированием"""
    
    try:
        result = quick_process(text, title)
        return {
            'success': True,
            'markdown': result.markdown,
            'statistics': result.statistics
        }
    except ValueError as e:
        logger.error(f"Value error: {e}")
        return {'success': False, 'error': f'Invalid input: {e}'}
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        return {'success': False, 'error': 'Processing failed'}
```

### 3. Логирование и мониторинг

```python
import time
from llm_api import LLMAPIClient

class MonitoredLLMClient:
    def __init__(self):
        self.client = LLMAPIClient()
        self.stats = {
            'processed': 0,
            'total_time': 0,
            'errors': 0
        }
    
    def process(self, text: str, title: str = ""):
        start = time.time()
        
        try:
            result = self.client.process(text, title)
            self.stats['processed'] += 1
            self.stats['total_time'] += time.time() - start
            
            print(f"✅ Processed in {time.time() - start:.2f}s")
            print(f"   Compression: {result.statistics['compression_ratio']:.1%}")
            
            return result
        except Exception as e:
            self.stats['errors'] += 1
            print(f"❌ Error: {e}")
            raise
    
    def print_stats(self):
        avg_time = self.stats['total_time'] / self.stats['processed'] if self.stats['processed'] > 0 else 0
        print(f"📊 Statistics:")
        print(f"   Processed: {self.stats['processed']}")
        print(f"   Avg time: {avg_time:.2f}s")
        print(f"   Errors: {self.stats['errors']}")
```

---

**Счастливой интеграции!** 🚀

