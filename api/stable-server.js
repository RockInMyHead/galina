const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/chat', (req, res) => {
  try {
    console.log('=== Chat Request Received ===');
    console.log('Messages count:', req.body?.messages?.length || 0);
    
    const mockResponse = {
      id: `mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-5.1',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Привет! Я Галина, AI-юрист. Автоматическая отправка и видео работают!',
          refusal: null
        },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    };
    
    console.log('✅ Sending response');
    res.status(200).json(mockResponse);
  } catch (error) {
    console.error('❌ Chat error:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Health check
app.get('/api/test-proxy', (req, res) => {
  res.json({ message: 'Proxy is working correctly!' });
});

const PORT = process.env.PORT || 3003;

// Graceful error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
  console.log(`🚀 Stable API server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('❌ Server error:', err);
});
