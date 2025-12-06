/**
 * API Integration Tests
 * Tests all endpoints and data synchronization
 */

const { PrismaClient } = require('@prisma/client');
const { migrateData } = require('../migrate-local-data');

const API_BASE_URL = 'https://lawyer.windexs.ru';

class ApiTester {
  constructor() {
    this.prisma = new PrismaClient();
  }

  async testHealthEndpoint() {
    console.log('🏥 Testing /health endpoint...');
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();

      if (response.ok && data.status === 'ok') {
        console.log('✅ Health check passed');
        return true;
      } else {
        console.log('❌ Health check failed:', data);
        return false;
      }
    } catch (error) {
      console.log('❌ Health check error:', error.message);
      return false;
    }
  }

  async testUserProfileEndpoint() {
    console.log('👤 Testing /user/profile endpoint...');
    try {
      const response = await fetch(`${API_BASE_URL}/user/profile`);
      const data = await response.json();

      if (response.ok && data.user) {
        console.log('✅ User profile fetched:', data.user.email);
        return true;
      } else {
        console.log('❌ User profile fetch failed:', data);
        return false;
      }
    } catch (error) {
      console.log('❌ User profile error:', error.message);
      return false;
    }
  }

  async testBalanceEndpoints() {
    console.log('💰 Testing balance endpoints...');
    let success = true;

    try {
      // Test GET balance
      const getResponse = await fetch(`${API_BASE_URL}/user/balance`);
      const getData = await getResponse.json();

      if (!getResponse.ok) {
        console.log('❌ GET balance failed:', getData);
        success = false;
      } else {
        console.log('✅ GET balance:', getData.balance, getData.currency);
      }

      // Test PUT balance (add operation)
      const putResponse = await fetch(`${API_BASE_URL}/user/balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100, operation: 'add' })
      });
      const putData = await putResponse.json();

      if (!putResponse.ok) {
        console.log('❌ PUT balance failed:', putData);
        success = false;
      } else {
        console.log('✅ PUT balance (add):', putData.balance, 'RUB');
      }

      // Test PUT balance (set operation)
      const setResponse = await fetch(`${API_BASE_URL}/user/balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1500, operation: 'set' })
      });
      const setData = await setResponse.json();

      if (!setResponse.ok) {
        console.log('❌ PUT balance (set) failed:', setData);
        success = false;
      } else {
        console.log('✅ PUT balance (set):', setData.balance, 'RUB');
      }

    } catch (error) {
      console.log('❌ Balance endpoints error:', error.message);
      success = false;
    }

    return success;
  }

  async testChatEndpoints() {
    console.log('💬 Testing chat endpoints...');
    let success = true;

    try {
      // Test POST message
      const testMessage = {
        content: 'Test message from API test',
        role: 'user',
        files: []
      };

      const postResponse = await fetch(`${API_BASE_URL}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testMessage)
      });
      const postData = await postResponse.json();

      if (!postResponse.ok) {
        console.log('❌ POST message failed:', postData);
        success = false;
      } else {
        console.log('✅ POST message:', postData.message.content);
      }

      // Test GET history
      const getResponse = await fetch(`${API_BASE_URL}/chat/history`);
      const getData = await getResponse.json();

      if (!getResponse.ok) {
        console.log('❌ GET history failed:', getData);
        success = false;
      } else {
        console.log('✅ GET history:', getData.messages.length, 'messages');
      }

    } catch (error) {
      console.log('❌ Chat endpoints error:', error.message);
      success = false;
    }

    return success;
  }

  async testTTSEndpoint() {
    console.log('🔊 Testing TTS endpoint...');
    try {
      const response = await fetch(`${API_BASE_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Привет, это тест синтеза речи' })
      });

      if (response.ok) {
        const blob = await response.blob();
        console.log('✅ TTS response:', {
          size: blob.size,
          type: blob.type,
          isValid: blob.size > 1000
        });
        return blob.size > 1000; // Valid audio should be > 1KB
      } else {
        const errorData = await response.json();
        console.log('❌ TTS failed:', errorData);
        return false;
      }
    } catch (error) {
      console.log('❌ TTS error:', error.message);
      return false;
    }
  }

  async testMigration() {
    console.log('🔄 Testing data migration...');
    try {
      // Create test data
      const testData = {
        balance: 2000,
        messages: [
          {
            id: 'test-msg-1',
            content: 'Test migration message',
            role: 'user',
            timestamp: new Date().toISOString()
          }
        ],
        user: {
          id: 'test-user',
          email: 'test@example.com',
          name: 'Test User'
        }
      };

      // Run migration
      await migrateData(testData);

      // Verify migration
      const user = await this.prisma.user.findFirst({
        where: { email: 'demo@galina.ai' },
        include: { balance: true, messages: true }
      });

      if (user && user.balance && user.messages.length > 0) {
        console.log('✅ Migration successful:', {
          user: user.email,
          balance: user.balance.amount,
          messages: user.messages.length
        });
        return true;
      } else {
        console.log('❌ Migration verification failed');
        return false;
      }
    } catch (error) {
      console.log('❌ Migration test error:', error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting API integration tests...\n');

    const results = {
      health: await this.testHealthEndpoint(),
      userProfile: await this.testUserProfileEndpoint(),
      balance: await this.testBalanceEndpoints(),
      chat: await this.testChatEndpoints(),
      tts: await this.testTTSEndpoint(),
      migration: await this.testMigration()
    };

    console.log('\n📊 Test Results:');
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`   ${test}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    });

    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;

    console.log(`\n🏁 Overall: ${passedCount}/${totalCount} tests passed`);

    if (passedCount === totalCount) {
      console.log('🎉 All tests passed!');
      return true;
    } else {
      console.log('⚠️ Some tests failed. Check logs above.');
      return false;
    }
  }

  async cleanup() {
    await this.prisma.$disconnect();
  }
}

// Run tests if called directly
async function main() {
  const tester = new ApiTester();

  try {
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Test runner error:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = { ApiTester };
