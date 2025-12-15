#!/usr/bin/env node

/**
 * Simple test script to verify chat API is working and not returning empty responses
 */

const API_BASE_URL = 'http://localhost:3004';

async function testChatAPI() {
  console.log('🧪 Testing Chat API for empty response issue...\n');

  // Test cases
  const testMessages = [
    {
      name: 'Simple question',
      messages: [
        { role: 'system', content: 'You are a legal assistant named Galina.' },
        { role: 'user', content: 'What documents are needed to register an LLC in Russia?' }
      ]
    },
    {
      name: 'Empty message',
      messages: [
        { role: 'system', content: 'You are a legal assistant named Galina.' },
        { role: 'user', content: '' }
      ]
    },
    {
      name: 'Plan request',
      messages: [
        { role: 'system', content: 'You are a legal assistant named Galina.' },
        { role: 'user', content: 'Create a plan for LLC registration' }
      ]
    },
    {
      name: 'Employment contract termination',
      messages: [
        { role: 'system', content: 'You are a legal assistant named Galina.' },
        { role: 'user', content: 'Как правильно расторгнуть трудовой договор?' }
      ]
    }
  ];

  for (const testCase of testMessages) {
    console.log(`📝 Testing: ${testCase.name}`);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: testCase.messages,
          model: 'gpt-5.1',
          max_completion_tokens: 1000,
          temperature: 0.7,
          stream: false
        }),
      });

      if (!response.ok) {
        console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }

      const data = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message) {
        const content = data.choices[0].message.content;
        const trimmedContent = content.trim();

        console.log(`📄 Response length: ${content.length} characters`);
        console.log(`📄 Trimmed length: ${trimmedContent.length} characters`);

        if (trimmedContent.length === 0) {
          console.log(`❌ EMPTY RESPONSE!`);
          console.log(`Raw content: "${content}"`);
        } else if (trimmedContent.length < 10) {
          console.log(`⚠️  Very short response: "${trimmedContent}"`);
        } else {
          console.log(`✅ Valid response: "${trimmedContent.substring(0, 100)}${trimmedContent.length > 100 ? '...' : ''}"`);
        }
      } else {
        console.log(`❌ Invalid response structure:`, JSON.stringify(data, null, 2));
      }

    } catch (error) {
      console.log(`❌ Network error: ${error.message}`);
    }

    console.log(''); // Empty line between tests
  }
}

// Test streaming endpoint as well
async function testStreamingChatAPI() {
  console.log('🌊 Testing Streaming Chat API...\n');

  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a legal assistant named Galina.' },
          { role: 'user', content: 'Hello, what documents do I need for LLC registration?' }
        ],
        model: 'gpt-5.1',
        max_completion_tokens: 500,
        temperature: 0.7,
        stream: true
      }),
    });

    if (!response.ok) {
      console.log(`❌ Streaming HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    console.log('✅ Streaming response started');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let chunksReceived = 0;

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
              if (parsed.content) {
                fullContent = parsed.content;
                chunksReceived++;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const trimmedContent = fullContent.trim();
    console.log(`📄 Final content length: ${fullContent.length} characters`);
    console.log(`📄 Trimmed length: ${trimmedContent.length} characters`);
    console.log(`📄 Chunks received: ${chunksReceived}`);

    if (trimmedContent.length === 0) {
      console.log(`❌ EMPTY STREAMING RESPONSE!`);
    } else {
      console.log(`✅ Valid streaming response: "${trimmedContent.substring(0, 100)}${trimmedContent.length > 100 ? '...' : ''}"`);
    }

  } catch (error) {
    console.log(`❌ Streaming network error: ${error.message}`);
  }
}

// Main execution
async function main() {
  console.log('🚀 Chat API Test Runner\n');

  // Check if API server is running
  try {
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    if (!healthResponse.ok) {
      console.log('❌ API server is not running or not healthy');
      console.log('💡 Please start the API server first:');
      console.log('   cd api && PORT=3003 node index.js');
      process.exit(1);
    }
    console.log('✅ API server is healthy\n');
  } catch (error) {
    console.log('❌ Cannot connect to API server');
    console.log('💡 Make sure the API server is running on port 3003');
    process.exit(1);
  }

  // Run tests
  await testChatAPI();
  await testStreamingChatAPI();

  console.log('🏁 Testing completed');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testChatAPI, testStreamingChatAPI };
