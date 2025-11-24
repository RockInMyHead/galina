// Test script for Chat API
import fetch from 'node-fetch';

async function testChat() {
  try {
    console.log('🧪 Testing Chat API with LLC registration question...');

    const response = await fetch('http://localhost:3001/api/chat', {
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
        model: 'gpt-5.1',
        reasoning: 'medium',
        stream: false
      })
    });

    console.log('📡 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ API Response:');
    console.log('Content:', data.choices[0].message.content);
    console.log('Model:', data.model);
    console.log('Usage:', data.usage);

  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }
}

async function testStreamingChat() {
  try {
    console.log('🧪 Testing Streaming Chat API...');

    const response = await fetch('http://localhost:3001/api/chat', {
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
        model: 'gpt-5.1',
        reasoning: 'medium',
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
  await testChat();
  console.log('\n' + '='.repeat(50) + '\n');
  await testStreamingChat();
}

runTests();

