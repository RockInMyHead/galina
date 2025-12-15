// Search service - handles court case search functionality
const { fetchWithProxy } = require('../config/proxy');

// Поиск судебных дел через DuckDuckGo API (бесплатно, без API ключей)
const searchDuckDuckGo = async (query) => {
  try {
    const searchQuery = `${query} судебное дело решение`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

    console.log('🔍 DuckDuckGo search URL:', url);

    const response = await fetchWithProxy(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.warn('⚠️ DuckDuckGo search failed:', response.status, response.statusText);
      return [];
    }

    const html = await response.text();
    console.log('📄 DuckDuckGo HTML length:', html.length);
    console.log('📄 DuckDuckGo HTML preview:', html.substring(0, 500));

    const cases = [];
    const seenUrls = new Set();

    // Ищем все ссылки в HTML
    const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    const allLinks = [];
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();

      if (url && title && title.length > 10) {
        allLinks.push({ url, title });
      }
    }

    console.log(`📊 Total links found in HTML: ${allLinks.length}`);

    // Ключевые слова для поиска судебных дел
    const courtKeywords = [
      'sudrf', 'sudact', 'rospravosudie', 'kad.arbitr',
      'суд', 'судебн', 'решение', 'дело', 'арбитраж',
      'court', 'judicial', 'verdict', 'case'
    ];

    // Ищем ссылки, которые содержат ключевые слова
    for (const link of allLinks) {
      if (cases.length >= 10) break;

      const urlLower = link.url.toLowerCase();
      const titleLower = link.title.toLowerCase();

      // Проверяем, содержит ли URL или заголовок ключевые слова
      const hasCourtKeyword = courtKeywords.some(keyword =>
        urlLower.includes(keyword) || titleLower.includes(keyword)
      );

      if (hasCourtKeyword && !seenUrls.has(link.url)) {
        seenUrls.add(link.url);

        // Определяем источник по URL
        let source = 'unknown';
        if (urlLower.includes('sudrf')) source = 'sudrf.ru';
        else if (urlLower.includes('sudact')) source = 'sudact.ru';
        else if (urlLower.includes('rospravosudie')) source = 'rospravosudie.com';
        else if (urlLower.includes('kad.arbitr')) source = 'kad.arbitr.ru';
        else if (urlLower.includes('суд') || urlLower.includes('court')) source = 'court.ru';

        // Извлекаем название суда из URL или заголовка
        let court = source;
        const courtMatch = link.url.match(/([^\/]+\.(ru|com|org))/i);
        if (courtMatch) {
          court = courtMatch[1];
        }

              cases.push({
          title: link.title.substring(0, 200),
                court: court,
          date: new Date().toLocaleDateString('ru-RU'),
          source: source,
          url: link.url.startsWith('http') ? link.url : `https://${link.url}`
        });
      }
    }

    console.log(`⚖️ Total court cases found: ${cases.length}`);

    // Если не нашли через ключевые слова, возвращаем первые несколько ссылок как примеры
    if (cases.length === 0 && allLinks.length > 0) {
      console.log('⚠️ No court-specific links found, returning general legal links');
      for (let i = 0; i < Math.min(3, allLinks.length); i++) {
        const link = allLinks[i];
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          cases.push({
            title: link.title.substring(0, 200),
            court: 'general',
            date: new Date().toLocaleDateString('ru-RU'),
            source: 'search',
            url: link.url.startsWith('http') ? link.url : `https://${link.url}`
          });
        }
      }
    }

    return cases;
  } catch (error) {
    console.error('❌ DuckDuckGo search error:', error);
    return [];
  }
};

class SearchService {
  async searchCourtCases(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query string is required');
    }

    console.log('🔍 Searching court cases for query:', query);

    // Вариант 1: DuckDuckGo API (бесплатно, без API ключей)
    let courtCases = await searchDuckDuckGo(query);

    // Если результатов мало, можно добавить другие источники:
    // - Парсинг sudrf.ru напрямую
    // - Парсинг sudact.ru напрямую
    // - Использование других бесплатных API

    console.log(`⚖️ Found ${courtCases.length} court cases for query: "${query}"`);

    return {
      success: true,
      query,
      cases: courtCases,
      count: courtCases.length
    };
  }
}

module.exports = new SearchService();
