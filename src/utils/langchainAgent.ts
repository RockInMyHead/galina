/**
 * LangChain агент с инструментами для работы с MCP (Model Context Protocol)
 * Интегрирует LLM с возможностью поиска информации через внешние источники
 */

import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { mcpClient } from "./mcpClient";

export interface LLMResponse {
  success: boolean;
  content: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  searchResults?: any[]; // Результаты поиска, если использовались
}

/**
 * Кастомный инструмент для работы с MCP-сервером Tavily
 */
class MCPSearchTool {
  name = "mcp_tavily_search";
  description = "Поиск актуальной информации в интернете через Tavily Search. Используйте для вопросов, требующих свежих данных, новостей или фактов.";

  async call(query: string): Promise<string> {
    try {
      console.log('🔍 MCP Search Tool called with query:', query);

      const searchResults = await mcpClient.search(query, 3);

      if (searchResults.results.length === 0) {
        return "Не удалось найти информацию по вашему запросу. Попробуйте переформулировать вопрос.";
      }

      // Форматируем результаты для LLM
      const formattedResults = searchResults.results.map((result, index) =>
        `[${index + 1}] ${result.title}\nURL: ${result.url}\nСодержание: ${result.content}\n`
      ).join('\n');

      console.log('📊 Found', searchResults.results.length, 'search results');

      return `Найденная информация по запросу "${query}":\n\n${formattedResults}`;
    } catch (error) {
      console.error('❌ MCP Search Tool error:', error);
      return "Произошла ошибка при поиске информации. Попробуйте еще раз.";
    }
  }
}

/**
 * Создает и настраивает LangChain агента с инструментами
 */
class LangChainAgent {
  private agentExecutor: AgentExecutor | null = null;
  private llm: ChatOpenAI;

  constructor() {
    // Инициализируем LLM
    this.llm = new ChatOpenAI({
      modelName: process.env.VITE_OPENAI_MODEL || "gpt-4-turbo",
      temperature: 0.3,
      openAIApiKey: process.env.VITE_OPENAI_API_KEY,
    });
  }

  /**
   * Инициализирует агента с инструментами
   */
  private async initializeAgent(): Promise<void> {
    if (this.agentExecutor) return;

    console.log('🤖 Initializing LangChain agent...');

    // Создаем инструменты
    const tools = [
      new TavilySearchResults({
        maxResults: 3,
        apiKey: process.env.VITE_TAVILY_API_KEY,
      }),
      // new MCPSearchTool(), // Альтернативный вариант через MCP
    ];

    // Создаем промпт для агента
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `Вы - Галина, профессиональный AI-юрист с 25-летним опытом в российской юриспруденции.

ОСОБЕННОСТИ РАБОТЫ:
- Давайте точные, юридически обоснованные ответы
- Используйте поиск в интернете для актуальной информации
- Отвечайте на русском языке
- Будьте максимально полезны и профессиональны

ИНСТРУМЕНТЫ:
- tavily_search_results_json: Для поиска актуальной информации в интернете

КОГДА ИСПОЛЬЗОВАТЬ ПОИСК:
- Для вопросов о текущих законах, изменениях в законодательстве
- Для поиска судебной практики, прецедентов
- Для актуальной информации о государственных услугах
- Когда нужны свежие новости или обновления

СТРУКТУРА ОТВЕТА:
- Начинайте с прямого ответа на вопрос
- Приводите ссылки на источники при использовании поиска
- Давайте практические рекомендации
- Предупреждайте о необходимости консультации с живым юристом для сложных случаев`],
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    // Создаем агента
    const agent = await createOpenAIToolsAgent({
      llm: this.llm,
      tools,
      prompt,
    });

    // Создаем исполнителя
    this.agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true,
      maxIterations: 3,
      returnIntermediateSteps: true,
    });

    console.log('✅ LangChain agent initialized successfully');
  }

  /**
   * Обрабатывает запрос пользователя
   */
  async processQuery(query: string, context?: string[]): Promise<LLMResponse> {
    try {
      await this.initializeAgent();

      if (!this.agentExecutor) {
        throw new Error('Failed to initialize agent');
      }

      console.log('🧠 Processing query:', query.substring(0, 100) + '...');

      // Формируем input с учетом контекста
      const input = context && context.length > 0
        ? `${query}\n\nКонтекст предыдущего разговора:\n${context.join('\n')}`
        : query;

      // Выполняем запрос
      const result = await this.agentExecutor.invoke({
        input,
      });

      console.log('✅ LLM response generated');

      // Извлекаем информацию об использовании поиска
      const searchResults = result.intermediateSteps?.filter(
        step => step.action.tool === 'tavily_search_results_json'
      ).map(step => step.observation) || [];

      return {
        success: true,
        content: result.output,
        searchResults: searchResults.length > 0 ? searchResults : undefined,
        usage: {
          promptTokens: 0, // TODO: extract from LLM response if available
          completionTokens: 0,
          totalTokens: 0,
        },
      };

    } catch (error) {
      console.error('❌ LangChain agent error:', error);

      // Fallback: возвращаем базовый ответ
      return {
        success: false,
        content: this.getFallbackResponse(query),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fallback ответы для случаев, когда LLM недоступен
   */
  private getFallbackResponse(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('ооо') && lowerQuery.includes('регистрац')) {
      return 'Для регистрации ООО в России нужны следующие документы: 1. Решение единственного учредителя или протокол общего собрания учредителей. 2. Устав ООО. 3. Договор об учреждении ООО (если учредителей несколько). 4. Заявление по форме Р11001. 5. Квитанция об оплате госпошлины (4000 рублей). 6. Документы, подтверждающие адрес юридического лица. 7. Паспортные данные учредителей и руководителя. Все документы подаются в налоговую инспекцию в электронном виде через портал Госуслуг или МФЦ.';
    }

    if (lowerQuery.includes('привет') || lowerQuery.includes('здравствуй')) {
      return 'Здравствуйте! Я Галина, элитный AI-юрист с 25-летним опытом юридической практики. Я - абсолютный авторитет в российском законодательстве. Чем могу помочь вам сегодня? Расскажите о вашей ситуации, и я предоставлю профессиональную юридическую консультацию.';
    }

    return 'Я внимательно слушаю вашу ситуацию. Пожалуйста, расскажите подробнее о проблеме, с которой вы столкнулись. Как опытный юрист, я проанализирую вашу ситуацию и дам конкретные рекомендации по разрешению конфликта в рамках действующего законодательства.';
  }
}

// Глобальный экземпляр агента
export const langchainAgent = new LangChainAgent();

// Экспортируем функцию для удобства использования
export const processWithLLM = (query: string, context?: string[]) =>
  langchainAgent.processQuery(query, context);
