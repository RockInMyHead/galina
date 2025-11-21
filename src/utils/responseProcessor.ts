/**
 * Профессиональная система обработки LLM ответов
 * Удаляет дубликаты, оптимизирует и структурирует контент
 */

export enum ContentType {
  DEFINITION = "определение",
  INSTRUCTION = "инструкция",
  WARNING = "предупреждение",
  EXAMPLE = "пример",
  SUMMARY = "резюме",
  RISK = "риск"
}

export interface ContentChunk {
  type: ContentType;
  title: string;
  content: string;
  importance: number;
  duplicated_from?: number;
  similarity_score?: number;
}

export interface ProcessedResponse {
  original_text: string;
  chunks: ContentChunk[];
  markdown: string;
  html: string;
  summary: string;
  statistics: {
    original_length: number;
    optimized_length: number;
    compression_ratio: number;
    chunks_count: number;
    chunks_removed: number;
    duplicates_found: number;
    quality_score: number;
    processing_time: number;
  };
}

/**
 * Класс для анализа и классификации контента
 */
export class ContentAnalyzer {
  private patterns = {
    [ContentType.WARNING]: /(?:Внимание|Важно|Предупреждение|Риск|Осторожно)[:!]/i,
    [ContentType.INSTRUCTION]: /(?:Как|Чтобы|Следует|Нужно|Необходимо|Сделай|Выполни)/i,
    [ContentType.EXAMPLE]: /(?:Например|Пример|К примеру)/i,
    [ContentType.SUMMARY]: /(?:Итого|В итоге|Заключение|Вывод|Резюме)/i,
    [ContentType.RISK]: /(?:Риск|Опасность|Проблема|Трудность)/i,
  };

  analyze(text: string): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    const paragraphs = text.split('\n\n');

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara || trimmedPara.length < 10) continue;

      const contentType = this.determineType(trimmedPara);
      const title = this.extractTitle(trimmedPara);

      const chunk: ContentChunk = {
        type: contentType,
        title: title || "Информация",
        content: trimmedPara,
        importance: this.calculateImportance(contentType)
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  private determineType(text: string): ContentType {
    const textLower = text.toLowerCase();

    for (const [contentType, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(textLower)) {
        return contentType as ContentType;
      }
    }

    return ContentType.DEFINITION;
  }

  private extractTitle(text: string): string | null {
    const firstLine = text.split('\n')[0];

    // Если первая линия заканчивается двоеточием или вопросом
    if (firstLine.endsWith(':') || firstLine.endsWith('?')) {
      return firstLine.slice(0, -1).trim();
    }

    // Если текст короткий и не заканчивается точкой
    if (firstLine.length < 100 && !firstLine.endsWith('.')) {
      return firstLine;
    }

    return null;
  }

  private calculateImportance(contentType: ContentType): number {
    const importanceMap = {
      [ContentType.WARNING]: 1.0,
      [ContentType.INSTRUCTION]: 0.9,
      [ContentType.SUMMARY]: 0.85,
      [ContentType.EXAMPLE]: 0.5,
      [ContentType.DEFINITION]: 0.7,
      [ContentType.RISK]: 0.95,
    };
    return importanceMap[contentType] || 0.5;
  }
}

/**
 * Детектор дубликатов
 */
export class DuplicateDetector {
  private similarityThreshold: number;

  constructor(similarityThreshold: number = 0.75) {
    this.similarityThreshold = similarityThreshold;
  }

  detectDuplicates(chunks: ContentChunk[]): ContentChunk[] {
    const processedChunks = [...chunks];

    for (let i = 0; i < processedChunks.length; i++) {
      const chunk = processedChunks[i];

      // Пропускаем короткие фрагменты
      if (chunk.content.length < 20) continue;

      // Пропускаем уже найденные дубликаты
      if (chunk.duplicated_from !== undefined) continue;

      // Ищем похожие чанки
      let maxSimilarity = 0;
      let similarIndex = -1;

      for (let j = 0; j < i; j++) {
        if (processedChunks[j].duplicated_from !== undefined) continue;

        const similarity = this.calculateSimilarity(chunk.content, processedChunks[j].content);

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          similarIndex = j;
        }
      }

      // Если найден дубликат
      if (maxSimilarity >= this.similarityThreshold) {
        chunk.duplicated_from = similarIndex;
        chunk.similarity_score = maxSimilarity;
      }
    }

    return processedChunks;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // 1. Схожесть ключевых слов
    const keywords1 = this.extractKeywords(text1);
    const keywords2 = this.extractKeywords(text2);

    if (!keywords1.size || !keywords2.size) return 0;

    const intersection = new Set([...keywords1].filter(x => keywords2.has(x))).size;
    const union = new Set([...keywords1, ...keywords2]).size;
    const keywordSimilarity = intersection / union;

    // 2. Схожесть по длине
    const lenRatio = Math.min(text1.length, text2.length) / Math.max(text1.length, text2.length);

    // 3. Схожесть начала текста
    const startSimilarity = this.sequenceSimilarity(text1.substring(0, 100), text2.substring(0, 100));

    // Взвешенная комбинация
    return (
      keywordSimilarity * 0.5 +
      lenRatio * 0.2 +
      startSimilarity * 0.3
    );
  }

  private extractKeywords(text: string): Set<string> {
    const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
    const stopwords = new Set([
      'это', 'что', 'как', 'где', 'когда', 'если', 'может', 'нужно', 'для', 'того',
      'чтобы', 'который', 'все', 'всё', 'будет', 'давайте', 'разберемся'
    ]);

    return new Set(words.filter(word => !stopwords.has(word)));
  }

  private sequenceSimilarity(s1: string, s2: string): number {
    if (!s1 || !s2) return 0;

    let matches = 0;
    const maxLen = Math.max(s1.length, s2.length);

    for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
      if (s1[i] === s2[i]) matches++;
    }

    return matches / maxLen;
  }
}

/**
 * Оптимизатор ответов
 */
export class ResponseOptimizer {
  private maxLength: number;
  private minImportance: number;

  constructor(maxLength: number = 2000, minImportance: number = 0.5) {
    this.maxLength = maxLength;
    this.minImportance = minImportance;
  }

  optimize(chunks: ContentChunk[]): ContentChunk[] {
    // 1. Убираем дубликаты
    const uniqueChunks = chunks.filter(chunk => chunk.duplicated_from === undefined);

    // 2. Сортируем по типу и важности
    uniqueChunks.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return b.importance - a.importance;
    });

    // 3. Обрезаем если слишком длинный ответ
    if (this.calculateTotalLength(uniqueChunks) > this.maxLength) {
      return this.truncateSmartly(uniqueChunks);
    }

    return uniqueChunks;
  }

  private calculateTotalLength(chunks: ContentChunk[]): number {
    return chunks.reduce((total, chunk) => total + chunk.content.length, 0);
  }

  private truncateSmartly(chunks: ContentChunk[]): ContentChunk[] {
    const result: ContentChunk[] = [];
    let currentLength = 0;

    for (const chunk of chunks) {
      const chunkLength = chunk.content.length;

      if (currentLength + chunkLength <= this.maxLength) {
        result.push(chunk);
        currentLength += chunkLength;
      } else if (currentLength < this.maxLength * 0.8) {
        // Если есть место, добавляем сокращенную версию
        const remaining = this.maxLength - currentLength;
        if (remaining > 100) {
          const shortened = `${chunk.content.substring(0, remaining - 20)  }...`;
          const chunkCopy: ContentChunk = {
            ...chunk,
            content: shortened
          };
          result.push(chunkCopy);
        }
        break;
      } else {
        break;
      }
    }

    return result;
  }
}

/**
 * Генератор профессионального вывода
 */
export class ProfessionalOutputGenerator {
  generateMarkdown(chunks: ContentChunk[], title: string = ""): string {
    const lines: string[] = [];

    if (title) {
      lines.push(`# ${title}\n`);
    }

    let currentType: ContentType | null = null;

    for (const chunk of chunks) {
      // Добавляем заголовок секции если тип изменился
      if (chunk.type !== currentType) {
        currentType = chunk.type;

        const typeNames = {
          [ContentType.DEFINITION]: "📋 ОСНОВНАЯ ИНФОРМАЦИЯ",
          [ContentType.INSTRUCTION]: "📝 ИНСТРУКЦИИ",
          [ContentType.SUMMARY]: "✅ РЕЗЮМЕ",
          [ContentType.EXAMPLE]: "💡 ПРИМЕРЫ",
          [ContentType.RISK]: "⚠️ РИСКИ",
          [ContentType.WARNING]: "🚨 ВНИМАНИЕ",
        };

        const sectionName = typeNames[chunk.type] || chunk.type;
        lines.push(`\n## ${sectionName}\n`);
      }

      // Добавляем чанк
      if (chunk.title) {
        lines.push(`### ${chunk.title}`);
        lines.push("");
      }

      lines.push(chunk.content);
      lines.push("");
    }

    return lines.join('\n');
  }

  generateSummary(chunks: ContentChunk[]): string {
    const lines: string[] = [];

    // Собираем основные определения
    const definitionChunks = chunks.filter(c => c.type === ContentType.DEFINITION);

    if (definitionChunks.length > 0) {
      lines.push("**Ключевые моменты:**\n");
      for (let i = 0; i < Math.min(definitionChunks.length, 5); i++) {
        const chunk = definitionChunks[i];
        // Получаем первое предложение
        const firstSentence = `${chunk.content.split('.')[0]  }.`;
        lines.push(`${i + 1}. ${firstSentence}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Главный процессор для обработки LLM ответов
 */
export class ProfessionalLLMProcessor {
  private verbose: boolean;
  private analyzer: ContentAnalyzer;
  private duplicateDetector: DuplicateDetector;
  private optimizer: ResponseOptimizer;
  private outputGenerator: ProfessionalOutputGenerator;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
    this.analyzer = new ContentAnalyzer();
    this.duplicateDetector = new DuplicateDetector(0.70);
    this.optimizer = new ResponseOptimizer();
    this.outputGenerator = new ProfessionalOutputGenerator();
  }

  process(llmResponse: string, title: string = ""): ProcessedResponse {
    const startTime = performance.now();

    this.log("🔄 НАЧАЛО ОБРАБОТКИ LLM ОТВЕТА");
    this.log(`Длина оригинального ответа: ${llmResponse.length} символов`);

    // 1. Анализ контента
    this.log("1️⃣ АНАЛИЗ КОНТЕНТА");
    const chunks = this.analyzer.analyze(llmResponse);
    this.log(`✓ Найдено ${chunks.length} блоков контента`);

    // 2. Обнаружение дубликатов
    this.log("2️⃣ ОБНАРУЖЕНИЕ ДУБЛИКАТОВ");
    const chunksWithDuplicates = this.duplicateDetector.detectDuplicates(chunks);
    const duplicatesCount = chunksWithDuplicates.filter(c => c.duplicated_from !== undefined).length;
    this.log(`✓ Обнаружено ${duplicatesCount} дубликатов`);

    // 3. Оптимизация
    this.log("3️⃣ ОПТИМИЗАЦИЯ И СТРУКТУРИРОВАНИЕ");
    const optimizedChunks = this.optimizer.optimize(chunksWithDuplicates);
    const dedupRatio = chunks.length > 0 ? 1 - (optimizedChunks.length / chunks.length) : 0;
    this.log(`✓ Результат: ${optimizedChunks.length} уникальных блоков`);
    this.log(`✓ Коэффициент дедупликации: ${(dedupRatio * 100).toFixed(1)}%`);

    // 4. Расчет качества
    this.log("4️⃣ РАСЧЕТ КАЧЕСТВА");
    const qualityScore = this.calculateQualityScore(optimizedChunks);
    this.log(`✓ Оценка качества: ${(qualityScore * 100).toFixed(1)}%`);

    const processingTime = performance.now() - startTime;
    this.log(`✅ ОБРАБОТКА ЗАВЕРШЕНА за ${processingTime.toFixed(2)}мс`);

    // Создаем результат
    const result: ProcessedResponse = {
      original_text: llmResponse,
      chunks: optimizedChunks,
      markdown: this.outputGenerator.generateMarkdown(optimizedChunks, title),
      html: this.markdownToHtml(this.outputGenerator.generateMarkdown(optimizedChunks, title)),
      summary: this.outputGenerator.generateSummary(optimizedChunks),
      statistics: {
        original_length: llmResponse.length,
        optimized_length: optimizedChunks.reduce((total, chunk) => total + chunk.content.length, 0),
        compression_ratio: dedupRatio,
        chunks_count: optimizedChunks.length,
        chunks_removed: chunks.length - optimizedChunks.length,
        duplicates_found: duplicatesCount,
        quality_score: qualityScore,
        processing_time: processingTime
      }
    };

    return result;
  }

  private calculateQualityScore(chunks: ContentChunk[]): number {
    if (!chunks.length) return 0;

    // Средняя важность
    const avgImportance = chunks.reduce((sum, c) => sum + c.importance, 0) / chunks.length;

    // Разнообразие типов контента
    const typeDiversity = new Set(chunks.map(c => c.type)).size / Object.keys(ContentType).length;

    // Наличие структуры
    const hasInstructions = chunks.some(c => c.type === ContentType.INSTRUCTION);
    const hasWarnings = chunks.some(c => c.type === ContentType.WARNING);
    const structureScore = (hasInstructions && hasWarnings) ? 0.7 : 0.5;

    // Общая оценка
    return Math.min(
      avgImportance * 0.4 +
      typeDiversity * 0.3 +
      structureScore * 0.3,
      1.0
    );
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  private markdownToHtml(markdown: string): string {
    // Простое преобразование Markdown в HTML
    let html = markdown;

    // Заголовки
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    // Жирный текст
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Курсив
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Переносы строк
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${  html  }</p>`;

    return html;
  }
}

/**
 * Быстрая обработка LLM ответа с дефолтными настройками
 */
export function quickProcess(llmResponse: string, title: string = ""): ProcessedResponse {
  const processor = new ProfessionalLLMProcessor();
  return processor.process(llmResponse, title);
}

/**
 * Интеграция с различными LLM сервисами
 */
export class LLMIntegration {
  static processResponse(response: string): ProcessedResponse {
    return quickProcess(response);
  }
}
