"""
🌐 API ДЛЯ ПРОФЕССИОНАЛЬНОЙ ОБРАБОТКИ LLM ОТВЕТОВ
Простая интеграция в существующие системы
"""

from typing import Optional, Dict, List, Callable
import json
from professional_llm_system import (
    ProfessionalLLMProcessor,
    LLMResponse,
    ContentType
)


class LLMAPIClient:
    """
    Простой клиент для интеграции профессиональной обработки LLM
    
    Примеры использования:
    
    # 1. Базовое использование
    client = LLMAPIClient()
    result = client.process("Ваш LLM ответ")
    print(result.markdown)
    
    # 2. С кастомными настройками
    client = LLMAPIClient(
        max_length=3000,
        similarity_threshold=0.8,
        verbose=False
    )
    
    # 3. С кастомным обработчиком
    def my_handler(response):
        # Ваша кастомная логика
        return response
    
    result = client.process(
        "LLM ответ",
        custom_handler=my_handler
    )
    """
    
    def __init__(
        self,
        max_length: int = 2000,
        similarity_threshold: float = 0.70,
        verbose: bool = False
    ):
        """
        Инициализация API клиента
        
        Args:
            max_length: Максимальная длина оптимизированного ответа
            similarity_threshold: Порог для обнаружения дубликатов (0-1)
            verbose: Выводить логи обработки
        """
        self.processor = ProfessionalLLMProcessor(verbose=verbose)
        self.processor.optimizer.max_length = max_length
        self.processor.duplicate_detector.similarity_threshold = similarity_threshold
        self.verbose = verbose
    
    def process(
        self,
        llm_response: str,
        title: str = "",
        custom_handler: Optional[Callable] = None
    ) -> 'ProcessedResponse':
        """
        Обработать LLM ответ
        
        Args:
            llm_response: Оригинальный ответ от LLM
            title: Заголовок документа
            custom_handler: Функция для кастомной обработки
        
        Returns:
            ProcessedResponse объект с результатами
        """
        # Обработать через основной процессор
        llm_response_obj = self.processor.process(llm_response, title)
        
        # Применить кастомный обработчик если указан
        if custom_handler:
            llm_response_obj = custom_handler(llm_response_obj)
        
        # Создать удобный объект для вывода
        processed = ProcessedResponse(
            llm_response_obj,
            self.processor
        )
        
        return processed
    
    def process_batch(
        self,
        llm_responses: List[Dict[str, str]],
        title_key: str = 'title',
        content_key: str = 'content'
    ) -> List['ProcessedResponse']:
        """
        Обработать несколько LLM ответов
        
        Args:
            llm_responses: Список словарей с LLM ответами
            title_key: Ключ для заголовка
            content_key: Ключ для контента
        
        Returns:
            Список ProcessedResponse объектов
        """
        results = []
        
        for item in llm_responses:
            title = item.get(title_key, '')
            content = item.get(content_key, '')
            
            result = self.process(content, title)
            results.append(result)
        
        return results


class ProcessedResponse:
    """
    Удобный интерфейс для работы с обработанным ответом LLM
    """
    
    def __init__(self, llm_response_obj: LLMResponse, processor: ProfessionalLLMProcessor):
        self._response = llm_response_obj
        self._processor = processor
    
    @property
    def markdown(self) -> str:
        """Получить Markdown вывод"""
        return self._processor.get_markdown(self._response)
    
    @property
    def json(self) -> Dict:
        """Получить JSON структуру"""
        return self._processor.get_json(self._response)
    
    @property
    def summary(self) -> str:
        """Получить краткое резюме"""
        return self._processor.get_summary(self._response)
    
    @property
    def html(self) -> str:
        """Получить HTML вывод (преобразование из Markdown)"""
        return self._markdown_to_html(self.markdown)
    
    @property
    def plaintext(self) -> str:
        """Получить plain text"""
        return "\n\n".join([
            f"{chunk.title}\n{chunk.content}"
            for chunk in self._response.chunks
            if chunk.title or chunk.content
        ])
    
    @property
    def statistics(self) -> Dict:
        """Получить статистику обработки"""
        return {
            'original_length': self._response.metadata['original_length'],
            'optimized_length': self._response.metadata['optimized_length'],
            'compression_ratio': self._response.deduplication_ratio,
            'chunks_count': len(self._response.chunks),
            'chunks_removed': self._response.metadata['chunks_removed'],
            'duplicates_found': self._response.metadata['duplicates_found'],
            'quality_score': self._response.quality_score,
            'processing_time': self._response.processing_time,
        }
    
    @property
    def chunks(self):
        """Получить оригинальные чанки"""
        return self._response.chunks
    
    def get_by_type(self, content_type: ContentType) -> List:
        """Получить чанки определенного типа"""
        return [c for c in self._response.chunks if c.type == content_type]
    
    def save_markdown(self, filepath: str) -> None:
        """Сохранить в Markdown файл"""
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(self.markdown)
    
    def save_json(self, filepath: str) -> None:
        """Сохранить в JSON файл"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(self.json, f, ensure_ascii=False, indent=2)
    
    def print_statistics(self) -> None:
        """Вывести статистику обработки"""
        stats = self.statistics
        
        print("\n" + "="*60)
        print("📊 СТАТИСТИКА ОБРАБОТКИ")
        print("="*60)
        print(f"Оригинальная длина:    {stats['original_length']:,} символов")
        print(f"Оптимизированная длина: {stats['optimized_length']:,} символов")
        print(f"Сжатие:                 {stats['compression_ratio']:.1%}")
        print(f"Блоков контента:       {stats['chunks_count']}")
        print(f"Удалено блоков:        {stats['chunks_removed']}")
        print(f"Обнаружено дубликатов:  {stats['duplicates_found']}")
        print(f"Оценка качества:       {stats['quality_score']:.1%}")
        print(f"Время обработки:       {stats['processing_time']:.2f}с")
    
    def _markdown_to_html(self, markdown: str) -> str:
        """Простое преобразование Markdown в HTML"""
        import re
        
        html = markdown
        
        # Заголовки
        html = re.sub(r'^### (.*?)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
        html = re.sub(r'^## (.*?)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
        html = re.sub(r'^# (.*?)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
        
        # Жирный текст
        html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
        
        # Курсив
        html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)
        
        # Переносы строк
        html = html.replace('\n\n', '</p><p>')
        html = f'<p>{html}</p>'
        
        return html
    
    def __str__(self) -> str:
        """Строковое представление"""
        return self.markdown
    
    def __repr__(self) -> str:
        """Представление для отладки"""
        return (
            f"ProcessedResponse(chunks={len(self.chunks)}, "
            f"quality={self.statistics['quality_score']:.1%}, "
            f"compression={self.statistics['compression_ratio']:.1%})"
        )


# ============================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================================================

def quick_process(llm_response: str, title: str = "") -> ProcessedResponse:
    """
    Быстрая обработка LLM ответа с дефолтными настройками
    
    Example:
        result = quick_process("Мой LLM ответ")
        print(result.markdown)
    """
    client = LLMAPIClient()
    return client.process(llm_response, title)


def compare_responses(
    original: str,
    processed_response: ProcessedResponse
) -> None:
    """
    Сравнить оригинальный и обработанный ответы
    """
    print("\n" + "="*70)
    print("🔍 СРАВНЕНИЕ ОРИГИНАЛЬНОГО И ОБРАБОТАННОГО ОТВЕТОВ")
    print("="*70)
    
    print(f"\n📏 РАЗМЕР:")
    print(f"   Оригинал: {len(original):,} символов")
    print(f"   Обработанный: {processed_response.statistics['optimized_length']:,} символов")
    print(f"   Сжатие: {processed_response.statistics['compression_ratio']:.1%}")
    
    print(f"\n📊 КАЧЕСТВО:")
    print(f"   Блоков: {processed_response.statistics['chunks_count']}")
    print(f"   Удалено блоков: {processed_response.statistics['chunks_removed']}")
    print(f"   Дубликатов: {processed_response.statistics['duplicates_found']}")
    print(f"   Оценка качества: {processed_response.statistics['quality_score']:.1%}")
    
    print(f"\n⚡ ПРОИЗВОДИТЕЛЬНОСТЬ:")
    print(f"   Время обработки: {processed_response.statistics['processing_time']:.2f}с")


def create_integration_example():
    """
    Пример интеграции в существующую систему
    """
    
    example_code = '''
# Пример 1: Базовое использование
from llm_api import quick_process

llm_response = "Ваш ответ от LLM..."
result = quick_process(llm_response, title="Мой документ")
print(result.markdown)


# Пример 2: С кастомными настройками
from llm_api import LLMAPIClient

client = LLMAPIClient(
    max_length=3000,
    similarity_threshold=0.75,
    verbose=True
)

result = client.process(llm_response, title="Документ")

# Получить разные форматы
print(result.markdown)
print(result.json)
print(result.summary)
print(result.html)

# Сохранить результаты
result.save_markdown("output.md")
result.save_json("output.json")

# Статистика
result.print_statistics()


# Пример 3: Обработка нескольких ответов
responses = [
    {'title': 'Документ 1', 'content': 'LLM ответ 1'},
    {'title': 'Документ 2', 'content': 'LLM ответ 2'},
]

results = client.process_batch(responses)

for result in results:
    print(result.markdown)
    result.print_statistics()


# Пример 4: Кастомный обработчик
def my_custom_handler(response):
    # Добавить кастомную логику
    for chunk in response.chunks:
        if chunk.type.value == 'warning':
            chunk.importance = 1.0  # Сделать предупреждения более важными
    return response

result = client.process(
    llm_response,
    custom_handler=my_custom_handler
)
    '''
    
    return example_code


# ============================================================================
# ИНТЕГРАЦИЯ С ПОПУЛЯРНЫМИ LLM СЕРВИСАМИ
# ============================================================================

class LLMIntegration:
    """Интеграция с различными LLM сервисами"""
    
    @staticmethod
    def process_openai_response(response: Dict) -> ProcessedResponse:
        """
        Обработать ответ от OpenAI API
        
        Example:
            import openai
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[{"role": "user", "content": "..."}]
            )
            result = LLMIntegration.process_openai_response(response)
        """
        client = LLMAPIClient()
        content = response['choices'][0]['message']['content']
        return client.process(content)
    
    @staticmethod
    def process_anthropic_response(response: Dict) -> ProcessedResponse:
        """Обработать ответ от Anthropic Claude"""
        client = LLMAPIClient()
        content = response['content'][0]['text']
        return client.process(content)
    
    @staticmethod
    def process_huggingface_response(response: str) -> ProcessedResponse:
        """Обработать ответ от HuggingFace"""
        client = LLMAPIClient()
        return client.process(response)


if __name__ == "__main__":
    # Демонстрация
    print("\n" + "="*70)
    print("🚀 ДЕМОНСТРАЦИЯ LLM API")
    print("="*70)
    
    print("\n📝 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ:")
    print(create_integration_example())

