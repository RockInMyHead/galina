/**
 * MCP (Model Context Protocol) клиент для работы с инструментами поиска
 * Реализует интеграцию с Tavily Search через HTTP API
 */

export interface MCPSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface MCPSearchResponse {
  query: string;
  results: MCPSearchResult[];
  totalResults: number;
}

export class MCPClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = 'http://localhost:8002', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Выполняет поиск через MCP-сервер Tavily
   */
  async search(query: string, maxResults: number = 5): Promise<MCPSearchResponse> {
    try {
      console.log('🔍 MCP Search:', query);

      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({
          query,
          maxResults,
          includeAnswer: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP search failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ MCP Search results:', data.results?.length || 0, 'items');

      return {
        query,
        results: data.results || [],
        totalResults: data.totalResults || data.results?.length || 0,
      };
    } catch (error) {
      console.error('❌ MCP Search error:', error);
      // Fallback: возвращаем пустые результаты
      return {
        query,
        results: [],
        totalResults: 0,
      };
    }
  }

  /**
   * Проверяет доступность MCP-сервера
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      console.error('❌ MCP Health check failed:', error);
      return false;
    }
  }
}

// Глобальный экземпляр MCP клиента
export const mcpClient = new MCPClient(
  process.env.VITE_MCP_BASE_URL || 'http://localhost:8002',
  process.env.VITE_TAVILY_API_KEY
);
