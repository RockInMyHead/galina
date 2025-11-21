const fetch = require('node-fetch');
const HttpsProxyAgent = require('https-proxy-agent');

const proxyUrl = 'http://rBD9e6:jZdUnJ@185.68.187.20:8000';
const proxyAgent = new HttpsProxyAgent.HttpsProxyAgent(proxyUrl);

const apiKey = process.env.OPENAI_API_KEY;

async function testGPT51() {
  console.log('🧪 Testing GPT-5.1 responses API directly...');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5.1',
        input: [{ role: 'user', content: 'Write a short bedtime story about a unicorn.' }],
        reasoning: { effort: 'medium' }
      }),
      agent: proxyAgent
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API Error:', errorData);
      return;
    }

    const data = await response.json();
    console.log('✅ GPT-5.1 Response:');
    console.log(JSON.stringify(data, null, 2));

    // Check different ways to extract text
    console.log('\n🔍 Content extraction attempts:');

    if (data.output_text) {
      console.log('✅ output_text:', data.output_text);
    }

    if (data.output && Array.isArray(data.output)) {
      console.log('✅ output array length:', data.output.length);
      if (data.output[0]) {
        console.log('✅ first output item:', JSON.stringify(data.output[0], null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testGPT51();
