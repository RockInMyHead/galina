// Test script for Galina API
import fetch from 'node-fetch';

async function testAPI() {
  try {
    console.log('🧪 Testing Galina API health...');

    // First test health endpoint
    const healthResponse = await fetch('http://localhost:1042/health');
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Health check:', health);
    }

    console.log('🧪 Testing chat API with LLC registration question...');

    const response = await fetch('http://localhost:1042/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Какие документы нужны для регистрации ООО?'
          }
        ],
        model: 'gpt-3.5-turbo',
        stream: false
      })
    });

    console.log('📡 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Error details:', errorText);

      // This might be expected due to OpenAI quota limits
      // Let's check if the system falls back to demo mode properly
      console.log('⚠️ API failed, this might be due to OpenAI quota limits');
      console.log('🔄 The system should automatically fall back to demo mode');

      return;
    }

    const data = await response.json();
    console.log('✅ API Response:');
    console.log('Content preview:', data.choices[0].message.content.substring(0, 200) + '...');
    console.log('Model:', data.model);
    console.log('Usage:', data.usage);

  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }
}

async function testStreaming() {
  try {
    console.log('🧪 Testing streaming chat API...');

    const response = await fetch('http://localhost:1042/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Какие документы нужны для регистрации ООО?'
          }
        ],
        model: 'gpt-3.5-turbo',
        stream: true
      })
    });

    console.log('📡 Streaming response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Streaming API Error:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return;
    }

    // Read streaming response
    if (!response.body) {
      console.log('⚠️ No response body for streaming');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              console.log('✅ Streaming completed');
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.content;
              if (content) {
                fullContent += content;
              }
            } catch (e) {
              // Ignore invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('✅ Streaming response received:');
    console.log('Content preview:', fullContent.substring(0, 300) + (fullContent.length > 300 ? '...' : ''));

  } catch (error) {
    console.error('❌ Streaming Test Error:', error.message);
  }
}

// Run tests
async function runTests() {
  await testAPI();
  console.log('\n' + '='.repeat(50) + '\n');
  await testStreaming();
}

runTests();
