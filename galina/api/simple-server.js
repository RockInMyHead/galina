const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/chat', (req, res) => {
  try {
    console.log('=== New Chat Request ===');
    console.log('Request body keys:', Object.keys(req.body || {}));
    
    const mockResponse = {
      id: `mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-5.1',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Привет! Я Галина, AI-юрист. Автоматическая отправка работает!',
          refusal: null
        },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    };
    
    res.status(200).json(mockResponse);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`🚀 Simple API server running on port ${PORT}`);
});
