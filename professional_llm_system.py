"""
🎯 ПРОФЕССИОНАЛЬНАЯ СИСТЕМА РАБОТЫ С LLM
Интеграция дедупликации, оптимизации и постобработки ответов
"""

import re
import json
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum
from abc import ABC, abstractmethod
from collections import defaultdict, Counter
import time

# ============================================================================
# 1. ТИПЫ И МОДЕЛИ ДАННЫХ
# ============================================================================

class ContentType(Enum):
    """Типы контента в ответе LLM"""
    DEFINITION = "определение"
    INSTRUCTION = "инструкция"
    WARNING = "предупреждение"
    EXAMPLE = "пример"
    SUMMARY = "резюме"
    RISK = "риск"


@dataclass
class ContentChunk:
    """Структурированный блок контента"""
    type: ContentType
    title: str
    content: str
    importance: float = 0.5  # 0-1, важность блока
    duplicated_from: Optional[int] = None  # индекс исходного блока если дубликат
    similarity_score: float = 0.0

    def to_dict(self):
        return {
            'type': self.type.value,
            'title': self.title,
            'content': self.content,
            'importance': self.importance,
            'duplicated_from': self.duplicated_from,
            'similarity_score': self.similarity_score
        }


@dataclass
class LLMResponse:
    """Структурированный ответ от LLM"""
    original_text: str
    chunks: List[ContentChunk]
    metadata: Dict = None
    processing_time: float = 0.0
    deduplication_ratio: float = 0.0
    quality_score: float = 0.0

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


# ============================================================================
# 2. АНАЛИЗАТОРЫ КОНТЕНТА
# ============================================================================

class ContentAnalyzer(ABC):
    """Базовый класс для анализаторов контента"""
    
    @abstractmethod
    def analyze(self, text: str) -> List[ContentChunk]:
        pass


class SectionAnalyzer(ContentAnalyzer):
    """Анализ ответа по секциям"""
    
    def analyze(self, text: str) -> List[ContentChunk]:
        chunks = []
        
        # Разбить на секции по нумерованным заголовкам
        sections = re.split(r'\n(\d+)\.\s+', text)
        
        for i in range(1, len(sections), 2):
            if i + 1 < len(sections):
                section_num = sections[i]
                section_title = sections[i + 1].split('\n')[0].strip()
                section_content = '\n'.join(sections[i + 1].split('\n')[1:])
                
                chunk = ContentChunk(
                    type=ContentType.DEFINITION,
                    title=f"Раздел {section_num}: {section_title}",
                    content=section_content.strip(),
                    importance=0.8
                )
                chunks.append(chunk)
        
        return chunks


class ParagraphAnalyzer(ContentAnalyzer):
    """Анализ по абзацам и их типам"""
    
    def __init__(self):
        self.patterns = {
            ContentType.WARNING: r'(Внимание|Важно|Предупреждение|Риск)[:!]',
            ContentType.INSTRUCTION: r'(Как|Чтобы|Следует|Нужно|Необходимо)',
            ContentType.EXAMPLE: r'(Например|Пример)',
            ContentType.SUMMARY: r'(Итого|В итоге|Заключение|Вывод)',
        }
    
    def analyze(self, text: str) -> List[ContentChunk]:
        chunks = []
        paragraphs = text.split('\n\n')
        
        for para in paragraphs:
            para = para.strip()
            if not para or len(para) < 10:
                continue
            
            content_type = self._determine_type(para)
            title = self._extract_title(para)
            
            chunk = ContentChunk(
                type=content_type,
                title=title or "Информация",
                content=para,
                importance=self._calculate_importance(content_type)
            )
            chunks.append(chunk)
        
        return chunks
    
    def _determine_type(self, text: str) -> ContentType:
        """Определить тип контента"""
        text_lower = text.lower()
        
        for content_type, pattern in self.patterns.items():
            if re.search(pattern, text_lower):
                return content_type
        
        return ContentType.DEFINITION
    
    def _extract_title(self, text: str) -> Optional[str]:
        """Извлечь заголовок из текста"""
        first_line = text.split('\n')[0]
        
        # Если первая линия заканчивается двоеточием или вопросом
        if first_line.endswith(':') or first_line.endswith('?'):
            return first_line[:-1].strip()
        
        # Если текст коротче 100 символов, это может быть заголовок
        if len(first_line) < 100 and not first_line.endswith('.'):
            return first_line
        
        return None
    
    def _calculate_importance(self, content_type: ContentType) -> float:
        """Рассчитать важность по типу"""
        importance_map = {
            ContentType.WARNING: 1.0,
            ContentType.INSTRUCTION: 0.9,
            ContentType.SUMMARY: 0.85,
            ContentType.EXAMPLE: 0.5,
            ContentType.DEFINITION: 0.7,
            ContentType.RISK: 0.95,
        }
        return importance_map.get(content_type, 0.5)


# ============================================================================
# 3. ДЕТЕКТОР ДУБЛИКАТОВ
# ============================================================================

class DuplicateDetector:
    """Умное обнаружение дублирующегося контента"""
    
    def __init__(self, similarity_threshold: float = 0.75):
        self.similarity_threshold = similarity_threshold
        self.keyword_cache = {}
    
    def detect_duplicates(self, chunks: List[ContentChunk]) -> List[ContentChunk]:
        """Обнаружить и отметить дубликаты в чанках"""
        processed_chunks = []
        
        for i, chunk in enumerate(chunks):
            # Пропустить очень короткие фрагменты
            if len(chunk.content) < 20:
                processed_chunks.append(chunk)
                continue
            
            # Проверить схожесть с предыдущими чанками
            max_similarity = 0.0
            similar_index = None
            
            for j in range(i):
                if chunks[j].duplicated_from is not None:
                    continue  # Пропустить уже найденные дубликаты
                
                similarity = self._calculate_similarity(
                    chunk.content,
                    chunks[j].content
                )
                
                if similarity > max_similarity:
                    max_similarity = similarity
                    similar_index = j
            
            # Если найден похожий контент
            if max_similarity >= self.similarity_threshold:
                chunk.duplicated_from = similar_index
                chunk.similarity_score = max_similarity
            
            processed_chunks.append(chunk)
        
        return processed_chunks
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Рассчитать схожесть текстов (0-1)"""
        # Использовать сложные метрики
        
        # 1. Схожесть ключевых слов
        keywords1 = set(self._extract_keywords(text1))
        keywords2 = set(self._extract_keywords(text2))
        
        if not keywords1 or not keywords2:
            return 0.0
        
        intersection = len(keywords1 & keywords2)
        union = len(keywords1 | keywords2)
        keyword_similarity = intersection / union if union > 0 else 0
        
        # 2. Схожесть по структуре (длина, количество предложений)
        len_ratio = min(len(text1), len(text2)) / max(len(text1), len(text2))
        
        # 3. Схожесть начала текстов (часто дубликаты начинаются одинаково)
        start_similarity = self._sequence_similarity(text1[:100], text2[:100])
        
        # Взвешенная комбинация
        total_similarity = (
            keyword_similarity * 0.5 +
            len_ratio * 0.2 +
            start_similarity * 0.3
        )
        
        return total_similarity
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Извлечь ключевые слова из текста"""
        # Удалить пунктуацию и привести к нижнему регистру
        words = re.findall(r'\b\w{3,}\b', text.lower())
        
        # Убрать стоп-слова
        stopwords = {
            'это', 'это', 'если', 'может', 'нужно', 'нужно', 'что', 'как',
            'где', 'когда', 'который', 'который', 'все', 'всё', 'будет',
            'давайте', 'разберемся', 'давайте', 'разберём', 'для', 'того',
        }
        
        return [w for w in words if w not in stopwords]
    
    def _sequence_similarity(self, s1: str, s2: str) -> float:
        """Рассчитать схожесть последовательностей (Jaro-Winkler-подобное)"""
        if not s1 or not s2:
            return 0.0
        
        # Простой алгоритм: количество совпадающих начальных символов
        matches = sum(1 for a, b in zip(s1, s2) if a == b)
        max_len = max(len(s1), len(s2))
        
        return matches / max_len if max_len > 0 else 0


# ============================================================================
# 4. ОПТИМИЗАТОР И СТРУКТУРИЗАТОР
# ============================================================================

class ResponseOptimizer:
    """Оптимизация и структурирование ответа"""
    
    def __init__(self, max_length: int = 2000, min_importance: float = 0.5):
        self.max_length = max_length
        self.min_importance = min_importance
    
    def optimize(self, chunks: List[ContentChunk]) -> List[ContentChunk]:
        """Оптимизировать и отфильтровать чанки"""
        
        # 1. Убрать чанки, которые являются дубликатами
        unique_chunks = [
            chunk for chunk in chunks
            if chunk.duplicated_from is None
        ]
        
        # 2. Отсортировать по типу и важности
        unique_chunks.sort(
            key=lambda x: (-x.importance, x.type.value)
        )
        
        # 3. Обрезать если слишком длинный ответ
        if self._calculate_total_length(unique_chunks) > self.max_length:
            unique_chunks = self._truncate_smartly(unique_chunks)
        
        # 4. Перегруппировать по типам для лучшей читаемости
        unique_chunks = self._regroup_by_type(unique_chunks)
        
        return unique_chunks
    
    def _calculate_total_length(self, chunks: List[ContentChunk]) -> int:
        """Рассчитать общую длину всех чанков"""
        return sum(len(chunk.content) for chunk in chunks)
    
    def _truncate_smartly(self, chunks: List[ContentChunk]) -> List[ContentChunk]:
        """Умное обрезание с сохранением наиболее важного"""
        result = []
        current_length = 0
        
        for chunk in chunks:
            chunk_length = len(chunk.content)
            
            if current_length + chunk_length <= self.max_length:
                result.append(chunk)
                current_length += chunk_length
            elif current_length < self.max_length * 0.8:
                # Если есть место, добавить сокращенную версию
                remaining = self.max_length - current_length
                if remaining > 100:
                    shortened = chunk.content[:remaining-20] + "..."
                    chunk_copy = ContentChunk(
                        type=chunk.type,
                        title=chunk.title,
                        content=shortened,
                        importance=chunk.importance
                    )
                    result.append(chunk_copy)
                break
            else:
                break
        
        return result
    
    def _regroup_by_type(self, chunks: List[ContentChunk]) -> List[ContentChunk]:
        """Перегруппировать чанки по типам для лучшей структуры"""
        grouped = defaultdict(list)
        
        for chunk in chunks:
            grouped[chunk.type].append(chunk)
        
        # Порядок типов для вывода
        type_order = [
            ContentType.DEFINITION,
            ContentType.INSTRUCTION,
            ContentType.SUMMARY,
            ContentType.EXAMPLE,
            ContentType.RISK,
            ContentType.WARNING,
        ]
        
        result = []
        for content_type in type_order:
            result.extend(grouped.get(content_type, []))
        
        return result


# ============================================================================
# 5. ГЕНЕРАТОР ПРОФЕССИОНАЛЬНОГО ВЫВОДА
# ============================================================================

class ProfessionalOutputGenerator:
    """Генерирует профессионально отформатированный вывод"""
    
    def generate_markdown(self, chunks: List[ContentChunk], title: str = "") -> str:
        """Генерировать Markdown-вывод"""
        lines = []
        
        if title:
            lines.append(f"# {title}\n")
        
        current_type = None
        section_count = defaultdict(int)
        
        for chunk in chunks:
            # Добавить заголовок секции если тип изменился
            if chunk.type != current_type:
                current_type = chunk.type
                
                type_names = {
                    ContentType.DEFINITION: "📋 ОСНОВНАЯ ИНФОРМАЦИЯ",
                    ContentType.INSTRUCTION: "📝 ИНСТРУКЦИИ",
                    ContentType.SUMMARY: "✅ РЕЗЮМЕ",
                    ContentType.EXAMPLE: "💡 ПРИМЕРЫ",
                    ContentType.RISK: "⚠️ РИСКИ",
                    ContentType.WARNING: "🚨 ВНИМАНИЕ",
                }
                
                section_name = type_names.get(chunk.type, chunk.type.value)
                lines.append(f"\n## {section_name}\n")
            
            section_count[chunk.type] += 1
            
            # Добавить чанк
            if chunk.title:
                lines.append(f"### {chunk.title}")
                lines.append("")
            
            lines.append(chunk.content)
            lines.append("")
        
        return "\n".join(lines)
    
    def generate_structured_json(self, chunks: List[ContentChunk], metadata: Dict = None) -> Dict:
        """Генерировать структурированный JSON"""
        return {
            'metadata': metadata or {},
            'chunks_count': len(chunks),
            'chunks': [chunk.to_dict() for chunk in chunks],
            'generated_at': time.time()
        }
    
    def generate_summary(self, chunks: List[ContentChunk]) -> str:
        """Генерировать краткое резюме"""
        lines = []
        
        # Собрать основные пункты
        definition_chunks = [c for c in chunks if c.type == ContentType.DEFINITION]
        
        if definition_chunks:
            lines.append("**Ключевые моменты:**\n")
            for i, chunk in enumerate(definition_chunks[:5], 1):
                # Получить первое предложение
                first_sentence = chunk.content.split('.')[0] + '.'
                lines.append(f"{i}. {first_sentence}")
        
        return "\n".join(lines)


# ============================================================================
# 6. ГЛАВНАЯ СИСТЕМА ОБРАБОТКИ LLM ОТВЕТОВ
# ============================================================================

class ProfessionalLLMProcessor:
    """Главный класс для обработки LLM ответов"""
    
    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.section_analyzer = SectionAnalyzer()
        self.paragraph_analyzer = ParagraphAnalyzer()
        self.duplicate_detector = DuplicateDetector(similarity_threshold=0.70)
        self.optimizer = ResponseOptimizer()
        self.output_generator = ProfessionalOutputGenerator()
    
    def process(self, llm_response: str, title: str = "") -> LLMResponse:
        """Обработать LLM ответ и вернуть оптимизированный результат"""
        start_time = time.time()
        
        self._log("🔄 НАЧАЛО ОБРАБОТКИ LLM ОТВЕТА")
        self._log(f"Длина оригинального ответа: {len(llm_response)} символов")
        
        # 1. Анализ
        self._log("1️⃣  АНАЛИЗ КОНТЕНТА")
        chunks = self._analyze_content(llm_response)
        self._log(f"   ✓ Найдено {len(chunks)} блоков контента")
        
        # 2. Обнаружение дубликатов
        self._log("2️⃣  ОБНАРУЖЕНИЕ ДУБЛИКАТОВ")
        chunks = self.duplicate_detector.detect_duplicates(chunks)
        duplicates_count = sum(1 for c in chunks if c.duplicated_from is not None)
        self._log(f"   ✓ Обнаружено {duplicates_count} дубликатов")
        
        if duplicates_count > 0:
            self._log("   Дубликаты:")
            for i, chunk in enumerate(chunks):
                if chunk.duplicated_from is not None:
                    self._log(f"      - Блок {i} дублирует блок {chunk.duplicated_from} (схожесть: {chunk.similarity_score:.1%})")
        
        # 3. Оптимизация
        self._log("3️⃣  ОПТИМИЗАЦИЯ И СТРУКТУРИРОВАНИЕ")
        optimized_chunks = self.optimizer.optimize(chunks)
        dedup_ratio = 1 - (len(optimized_chunks) / len(chunks)) if chunks else 0
        self._log(f"   ✓ Результат: {len(optimized_chunks)} уникальных блоков")
        self._log(f"   ✓ Коэффициент дедупликации: {dedup_ratio:.1%}")
        
        # 4. Расчет качества
        self._log("4️⃣  РАСЧЕТ КАЧЕСТВА")
        quality_score = self._calculate_quality_score(optimized_chunks)
        self._log(f"   ✓ Оценка качества: {quality_score:.1%}")
        
        processing_time = time.time() - start_time
        self._log(f"✅ ОБРАБОТКА ЗАВЕРШЕНА за {processing_time:.2f}с")
        
        # Создать результат
        result = LLMResponse(
            original_text=llm_response,
            chunks=optimized_chunks,
            processing_time=processing_time,
            deduplication_ratio=dedup_ratio,
            quality_score=quality_score,
            metadata={
                'title': title,
                'original_length': len(llm_response),
                'optimized_length': sum(len(c.content) for c in optimized_chunks),
                'chunks_removed': len(chunks) - len(optimized_chunks),
                'duplicates_found': duplicates_count,
            }
        )
        
        return result
    
    def _analyze_content(self, text: str) -> List[ContentChunk]:
        """Проанализировать контент с использованием разных анализаторов"""
        # Попробовать разные анализаторы
        chunks_by_section = self.section_analyzer.analyze(text)
        chunks_by_paragraph = self.paragraph_analyzer.analyze(text)
        
        # Если есть секции с хорошей структурой, использовать их
        if len(chunks_by_section) > 1:
            return chunks_by_section
        
        # Иначе использовать анализ по абзацам
        return chunks_by_paragraph
    
    def _calculate_quality_score(self, chunks: List[ContentChunk]) -> float:
        """Рассчитать оценку качества ответа"""
        if not chunks:
            return 0.0
        
        # Средняя важность
        avg_importance = sum(c.importance for c in chunks) / len(chunks)
        
        # Разнообразие типов контента
        type_diversity = len(set(c.type for c in chunks)) / len(ContentType)
        
        # Наличие структуры
        has_instructions = any(c.type == ContentType.INSTRUCTION for c in chunks)
        has_warnings = any(c.type == ContentType.WARNING for c in chunks)
        structure_score = 0.7 if (has_instructions and has_warnings) else 0.5
        
        # Общая оценка
        quality = (
            avg_importance * 0.4 +
            type_diversity * 0.3 +
            structure_score * 0.3
        )
        
        return min(quality, 1.0)
    
    def _log(self, message: str):
        """Логирование"""
        if self.verbose:
            print(message)
    
    def get_markdown(self, llm_response_obj: LLMResponse) -> str:
        """Получить Markdown-вывод"""
        return self.output_generator.generate_markdown(
            llm_response_obj.chunks,
            title=llm_response_obj.metadata.get('title', '')
        )
    
    def get_json(self, llm_response_obj: LLMResponse) -> Dict:
        """Получить JSON-вывод"""
        return self.output_generator.generate_structured_json(
            llm_response_obj.chunks,
            metadata=llm_response_obj.metadata
        )
    
    def get_summary(self, llm_response_obj: LLMResponse) -> str:
        """Получить резюме"""
        return self.output_generator.generate_summary(llm_response_obj.chunks)


# ============================================================================
# 7. ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
# ============================================================================

def demo_professional_processing():
    """Демонстрация профессиональной обработки"""
    
    # LLM ответ (из вашего примера)
    llm_response = """Какие документы нужны для регистрации ООО?

1. Подготовка учредительных документов и устава ООО

Здравствуйте! Давайте разберемся, какие документы нужны для регистрации ООО (Общества с ограниченной ответственностью) и как их подготовить.

Какие документы нужны?

Заявление о регистрации: Это специальная форма, которую нужно заполнить. Она называется "Форма Р11001". В ней указываются основные сведения об ООО, такие как название, адрес и данные учредителей.

Устав ООО: Это главный документ компании, где прописаны все правила её работы. Устав должен содержать информацию о целях компании, размерах уставного капитала и правах участников.

Протокол собрания учредителей: Если в ООО несколько учредителей, они должны провести собрание и принять решение о создании компании. Итоги оформляются в протоколе.

Квитанция об оплате госпошлины: За регистрацию ООО нужно заплатить госпошлину. Её размер можно узнать на сайте налоговой службы.

Гарантийное письмо от владельца помещения: Если вы арендуете офис или другое помещение, вам нужно получить письмо от арендодателя, что он не против размещения вашей компании по этому адресу.

Почему это важно?

Все эти документы подтверждают законность создания вашего бизнеса и дают ему право действовать. Без них вы не сможете официально работать, открывать счета в банке или заключать контракты.

Как подготовить документы?

Заполните форму Р11001: Образец и инструкции можно найти на сайте налоговой службы. Будьте внимательны при заполнении данных.

Составьте устав: Используйте шаблоны из интернета или обратитесь к юристу для помощи в составлении документа с учетом специфики вашего бизнеса.

Проведите собрание учредителей: Если учредителей несколько, обязательно проведите собрание и оформите протокол с подписями всех участников.

Оплатите госпошлину: Сделать это можно через банк или онлайн-сервис, сохраните квитанцию для налоговой.

Получите гарантийное письмо: Попросите владельца помещения оформить документ с указанием адреса и согласия на размещение ООО.

2. Сбор и оформление заявления о государственной регистрации

Конечно, давайте разберемся, какие документы нужны для регистрации ООО и как их правильно оформить.

Короткий ответ

Для регистрации ООО вам понадобятся несколько ключевых документов: заявление о регистрации, устав компании, решение о создании (или протокол собрания учредителей), квитанция об уплате госпошлины и некоторые другие.

3. Оплата государственной пошлины и подтверждение адреса ООО

Конечно! Давайте разберемся, какие документы вам понадобятся для регистрации ООО, и как правильно оплатить государственную пошлину и подтвердить адрес вашего общества.

Риски

Если не оплатить пошлину или неправильно указать реквизиты, регистрация может быть отклонена. Также без подтверждения юридического адреса вашу компанию не зарегистрируют. Поэтому внимательно проверяйте все данные и документы перед подачей!
"""
    
    # Создать процессор
    processor = ProfessionalLLMProcessor(verbose=True)
    
    print("\n" + "="*70)
    print("🎯 ПРОФЕССИОНАЛЬНАЯ СИСТЕМА ОБРАБОТКИ LLM ОТВЕТОВ")
    print("="*70 + "\n")
    
    # Обработать ответ
    result = processor.process(
        llm_response,
        title="Документы для регистрации ООО"
    )
    
    # Вывести результаты
    print("\n" + "="*70)
    print("📊 СТАТИСТИКА ОБРАБОТКИ")
    print("="*70)
    print(f"Оригинальная длина: {result.metadata['original_length']} символов")
    print(f"Оптимизированная длина: {result.metadata['optimized_length']} символов")
    print(f"Количество блоков: {len(result.chunks)}")
    print(f"Сжатие: {result.deduplication_ratio:.1%}")
    print(f"Время обработки: {result.processing_time:.2f}с")
    print(f"Оценка качества: {result.quality_score:.1%}")
    
    print("\n" + "="*70)
    print("✨ ОПТИМИЗИРОВАННЫЙ MARKDOWN ВЫВОД")
    print("="*70 + "\n")
    print(processor.get_markdown(result))
    
    print("\n" + "="*70)
    print("📌 РЕЗЮМЕ")
    print("="*70 + "\n")
    print(processor.get_summary(result))
    
    print("\n" + "="*70)
    print("💾 JSON СТРУКТУРА")
    print("="*70 + "\n")
    json_output = processor.get_json(result)
    print(json.dumps(json_output, ensure_ascii=False, indent=2)[:500] + "...")
    
    return result


if __name__ == "__main__":
    result = demo_professional_processing()

