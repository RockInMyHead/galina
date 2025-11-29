// Скрипт для тестирования API эндпоинтов
const https = require('https');

const testEndpoints = [
  { url: 'https://lawyer.windexs.ru/api/health', method: 'GET', expect: 200 },
  { url: 'https://lawyer.windexs.ru/api/chat', method: 'POST', 
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'test' }],
      stream: false
    }), 
    expect: [200, 403] }, // 200 для рабочего, 403 для нерабочего
  { url: 'http://localhost:3003/api/health', method: 'GET', expect: 200 },
  { url: 'http://localhost:3003/api/chat', method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'test' }],
      stream: false
    }),
    expect: 200 }
];

function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.url);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Galina-Test/1.0'
      }
    };

    if (endpoint.body) {
      options.headers['Content-Length'] = Buffer.byteLength(endpoint.body);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const status = res.statusCode;
        const success = Array.isArray(endpoint.expect) 
          ? endpoint.expect.includes(status) 
          : status === endpoint.expect;
        
        resolve({
          url: endpoint.url,
          method: endpoint.method,
          status,
          expected: endpoint.expect,
          success,
          response: data.substring(0, 200) + (data.length > 200 ? '...' : '')
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        url: endpoint.url,
        method: endpoint.method,
        status: 'ERROR',
        expected: endpoint.expect,
        success: false,
        error: err.message
      });
    });

    if (endpoint.body) {
      req.write(endpoint.body);
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Тестирование API эндпоинтов...\n');
  
  for (const endpoint of testEndpoints) {
    const result = await testEndpoint(endpoint);
    
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.method} ${result.url}`);
    console.log(`   Status: ${result.status} (expected: ${result.expected})`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    } else if (result.response) {
      console.log(`   Response: ${result.response}`);
    }
    console.log('');
  }
  
  console.log('💡 Рекомендации:');
  console.log('- Если production API возвращает 403, проверь OPENAI_API_KEY на сервере');
  console.log('- Используй локальный API для тестирования: http://localhost:3003/api');
}

runTests();
