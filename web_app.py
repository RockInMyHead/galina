#!/usr/bin/env python3
"""
🌐 ПРОСТОЙ ВЕБ-ИНТЕРФЕЙС ДЛЯ ПРОФЕССИОНАЛЬНОЙ LLM СИСТЕМЫ

Запуск: python web_app.py
Открыть: http://localhost:5000
"""

from flask import Flask, request, render_template_string, jsonify
from llm_api import LLMAPIClient, quick_process
import time

app = Flask(__name__)
client = LLMAPIClient(verbose=False)

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>🎯 Профессиональная LLM система</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; text-align: center; }
        textarea { width: 100%; height: 150px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; resize: vertical; }
        button { background: #3498db; color: white; border: none; padding: 12px 30px; border-radius: 5px; cursor: pointer; font-size: 16px; }
        button:hover { background: #2980b9; }
        .result { margin-top: 30px; padding: 20px; background: #ecf0f1; border-radius: 5px; white-space: pre-wrap; font-family: monospace; }
        .stats { margin-top: 20px; padding: 15px; background: #e8f4f8; border-radius: 5px; }
        .stat { display: inline-block; margin-right: 20px; }
        .loading { display: none; text-align: center; margin-top: 20px; }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; display: inline-block; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Профессиональная LLM система</h1>
        <p>Вставьте текст ответа от LLM и получите оптимизированный результат</p>

        <form id="processForm">
            <textarea name="text" placeholder="Вставьте сюда ответ от LLM (ChatGPT, Claude, Gemini и т.д.)" required></textarea>
            <br><br>
            <button type="submit">🚀 Обработать</button>
        </form>

        <div class="loading" id="loading">
            <div class="spinner"></div>
            <p>Обработка...</p>
        </div>

        <div id="result" style="display: none;">
            <h3>✅ Результат:</h3>
            <div class="result" id="output"></div>

            <div class="stats" id="stats"></div>
        </div>
    </div>

    <script>
        document.getElementById('processForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const text = this.text.value;
            if (!text.trim()) return;

            // Показать загрузку
            document.getElementById('loading').style.display = 'block';
            document.getElementById('result').style.display = 'none';

            try {
                const response = await fetch('/api/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text })
                });

                const result = await response.json();

                if (result.success) {
                    document.getElementById('output').textContent = result.markdown;
                    document.getElementById('stats').innerHTML = `
                        <div class="stat"><strong>Оригинальная длина:</strong> ${result.stats.original_length} символов</div>
                        <div class="stat"><strong>Оптимизированная:</strong> ${result.stats.optimized_length} символов</div>
                        <div class="stat"><strong>Сжатие:</strong> ${result.stats.compression_ratio}%</div>
                        <div class="stat"><strong>Качество:</strong> ${result.stats.quality_score}%</div>
                        <div class="stat"><strong>Время:</strong> ${result.stats.processing_time.toFixed(2)}с</div>
                    `;
                    document.getElementById('result').style.display = 'block';
                } else {
                    alert('Ошибка: ' + result.error);
                }
            } catch (error) {
                alert('Ошибка: ' + error.message);
            } finally {
                document.getElementById('loading').style.display = 'none';
            }
        });
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/process', methods=['POST'])
def process_text():
    try:
        data = request.get_json()
        text = data.get('text', '')

        if not text.strip():
            return jsonify({'success': False, 'error': 'Текст не может быть пустым'})

        start_time = time.time()
        result = client.process(text)
        processing_time = time.time() - start_time

        # Расширенная статистика
        stats = result.statistics
        stats['processing_time'] = processing_time

        return jsonify({
            'success': True,
            'markdown': result.markdown,
            'json': result.json,
            'summary': result.summary,
            'stats': stats
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quick', methods=['POST'])
def quick_process_endpoint():
    """Быстрая обработка через API"""
    try:
        data = request.get_json()
        text = data.get('text', '')

        if not text.strip():
            return jsonify({'success': False, 'error': 'Текст не может быть пустым'})

        result = quick_process(text)

        return jsonify({
            'success': True,
            'markdown': result.markdown,
            'stats': result.statistics
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/batch', methods=['POST'])
def batch_process():
    """Пакетная обработка"""
    try:
        data = request.get_json()
        items = data.get('items', [])

        if not items:
            return jsonify({'success': False, 'error': 'Список не может быть пустым'})

        results = client.process_batch(items)

        return jsonify({
            'success': True,
            'results': [
                {
                    'markdown': r.markdown,
                    'stats': r.statistics
                }
                for r in results
            ]
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    print("🌐 Запуск веб-приложения...")
    print("📱 Откройте в браузере: http://localhost:5000")
    print("❌ Для выхода нажмите Ctrl+C")
    print()

    try:
        app.run(debug=True, host='0.0.0.0', port=5000)
    except KeyboardInterrupt:
        print("\n👋 Веб-приложение остановлено")

