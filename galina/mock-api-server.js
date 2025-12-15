import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';

const app = express();
const PORT = 8000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());

// Mock responses
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mock API server is running' });
});

app.post('/chat', (req, res) => {
  console.log('Mock API: Received chat request', req.body);

  // Simulate processing delay
  setTimeout(() => {
    res.json({
      success: true,
      data: {
        content: `Это тестовый ответ от mock API сервера. Вы сказали: "${req.body.messages?.[req.body.messages.length - 1]?.content || 'ничего'}"`
      }
    });
  }, 1000);
});

app.post('/stt', (req, res) => {
  console.log('Mock API: Received STT request');

  setTimeout(() => {
    res.json({
      text: "Это тестовый текст распознанный из аудио через mock API."
    });
  }, 500);
});

app.post('/tts', (req, res) => {
  console.log('Mock API: Received TTS request');

  // Return empty audio blob for testing
  const audioBuffer = Buffer.alloc(1024); // Empty audio
  res.setHeader('Content-Type', 'audio/wav');
  res.send(audioBuffer);
});

app.get('/config', (req, res) => {
  res.json({
    transcription: { ready: true },
    llm: { ready: true },
    tts: { ready: true },
    auth: { enabled: false },
    system: { websocket_host: 'localhost', websocket_port: 8000 }
  });
});

// WebSocket mock (basic echo)
const wss = new WebSocketServer({ port: 8001 });

wss.on('connection', (ws) => {
  console.log('Mock WebSocket: Client connected');

  ws.on('message', (message) => {
    console.log('Mock WebSocket: Received message');
    // Echo back
    ws.send(JSON.stringify({
      type: 'response',
      content: 'Mock WebSocket response',
      messageId: Date.now().toString()
    }));
  });

  ws.on('close', () => {
    console.log('Mock WebSocket: Client disconnected');
  });
});

// Start server
app.listen(PORT, 'localhost', () => {
  console.log(`🚀 Mock API server running on http://localhost:${PORT}`);
  console.log(`🔌 Mock WebSocket server running on ws://localhost:8001`);
  console.log(`🌐 Frontend should be available at http://localhost:3000`);
});