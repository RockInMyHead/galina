const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: './.env.local' });

// Initialize Prisma Client
const prisma = new PrismaClient();

// Environment loaded successfully
console.log('Database URL:', process.env.DATABASE_URL);

const app = express();
const PORT = process.env.PORT || 3001;

// Configure CORS for development
const corsOptions = {
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Увеличиваем лимит для JSON
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Для form data

// Middleware для обработки raw binary data для /stt/raw
app.use('/stt/raw', express.raw({ limit: '50mb', type: 'audio/*' }));

// Настройка multer для обработки больших файлов
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('🎵 Multer file filter:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    cb(null, true);
  }
});

// Middleware для обработки ошибок multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('🚨 Multer error:', error.code, error.message);
    return res.status(400).json({
      error: 'File upload error',
      details: error.message,
      code: error.code
    });
  }
  next(error);
};


app.post('/chat', async (req, res) => {
  try {
    console.log('=== New Chat Request ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    const { messages, model = 'gpt-3.5-turbo', max_tokens = 2000, temperature = 0.7, top_p = 1, presence_penalty = 0, frequency_penalty = 0, stream = false } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // Handle streaming requests
    if (stream) {
      if (!apiKey) {
        // Mock streaming for testing when no API key
        console.log('No API key - using mock streaming for testing');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const mockContent = 'Привет! Я Галина, ваш AI-юрист. Я помогу вам с юридическими вопросами. Задайте мне любой вопрос о законодательстве Российской Федерации.';
        const words = mockContent.split(' ');

        let currentContent = '';
        (async () => {
          for (let i = 0; i < words.length; i++) {
            currentContent += (i > 0 ? ' ' : '') + words[i];
            res.write(`data: ${JSON.stringify({ content: currentContent })}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          res.write('data: [DONE]\n\n');
          res.end();
        })();
        return;
      } else {
        // Real streaming with OpenAI
        console.log('Starting real streaming with OpenAI');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens,
            temperature,
            top_p,
            presence_penalty,
            frequency_penalty,
            stream: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('OpenAI API error:', response.status, errorData);
          return res.status(response.status).json(errorData);
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let streamDone = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || streamDone) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  res.write('data: [DONE]\n\n');
                  streamDone = true;
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices[0]?.delta?.content;
                  if (content) {
                    fullContent += content;
                    res.write(`data: ${JSON.stringify({ content: fullContent })}\n\n`);
                  }
                } catch (e) {
                  // Ignore invalid JSON
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
          res.end();
        }
        return;
      }
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('Making request to OpenAI with model:', model, 'stream:', stream);

    if (stream) {
      console.log('Starting streaming response...');
      // Streaming response
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens,
          temperature,
          stream: true
        })
      });

      console.log('OpenAI response status:', response.status);
      console.log('OpenAI response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenAI API error:', response.status, errorData);
        return res.status(response.status).json(errorData);
      }

      console.log('Starting to stream response...');

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let streamDone = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || streamDone) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                res.write(`data: [DONE]\n\n`);
                streamDone = true;
                break;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                  res.write(`data: ${JSON.stringify({ content: fullContent })}\n\n`);
                }
              } catch (e) {
                // Ignore invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        res.end();
      }
    } else {
      // Regular response
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens,
          temperature,
          top_p,
          presence_penalty,
          frequency_penalty
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenAI API error:', response.status, errorData);
        return res.status(response.status).json(errorData);
      }

      const data = await response.json();
      console.log('OpenAI response received successfully');
      res.status(200).json(data);
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Text to Speech endpoint
app.post('/tts', async (req, res) => {
  try {
    const { text, voice = 'alloy', model = 'tts-1' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('No API key - using mock TTS response');
      // Mock response for testing
      const mockAudio = Buffer.from([0x49, 0x44, 0x33]); // Simple MP3 header mock
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.send(mockAudio);
    }

    console.log('Requesting TTS from OpenAI:', { text: text.substring(0, 50), voice, model });

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => '');
      console.error('OpenAI TTS API error:', response.status, errorData);
      return res.status(response.status).json({ error: 'Failed to generate speech' });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('TTS Server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Speech to Text endpoint - supports both multipart and raw binary
const sttHandler = async (req, res) => {
  try {
    console.log('🎤 STT Request received');
    console.log('📋 Content-Type:', req.headers['content-type']);

    let audioBuffer;
    let mimeType = 'audio/wav';
    let fileName = 'recording.wav';

    // Check if it's multipart/form-data (multer processed)
    if (req.file) {
      console.log('📁 Received as multipart/form-data');
      audioBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
      fileName = req.file.originalname;
    }
    // Check if it's raw body (express raw parser for /stt/raw)
    else if (req.body && Buffer.isBuffer(req.body)) {
      console.log('📁 Received as raw body buffer (express.raw)');
      audioBuffer = req.body;
      mimeType = req.headers['content-type'] || 'audio/wav';
      fileName = req.headers['content-disposition']?.match(/filename="([^"]+)"/)?.[1] || 'recording.wav';
    }
    // Check if it's raw binary data (fallback for manual streaming)
    else if (req.headers['content-type'] && req.headers['content-type'].includes('audio/')) {
      console.log('📁 Received as raw binary data (manual streaming)');
      audioBuffer = Buffer.from(await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      }));
      mimeType = req.headers['content-type'];
      fileName = req.headers['content-disposition']?.match(/filename="([^"]+)"/)?.[1] || 'recording.wav';
    }
    else {
      console.log('❌ No audio data found in request');
      console.log('📋 Request keys:', Object.keys(req));
      console.log('📋 Body type:', typeof req.body);
      return res.status(400).json({ error: 'No audio data received. Expected multipart/form-data with "audio" field or raw binary data.' });
    }

    console.log('🎵 Audio processing info:', {
      bufferSize: audioBuffer.length,
      mimeType,
      fileName,
      sizeMB: (audioBuffer.length / 1024 / 1024).toFixed(2)
    });

    const apiKey = process.env.OPENAI_API_KEY;
    console.log('🔑 API Key check:', {
      exists: !!apiKey,
      length: apiKey?.length,
      isEmpty: !apiKey || apiKey.trim() === '',
      startsWith: apiKey?.substring(0, 15) + '...' || 'undefined',
      envVarSet: 'OPENAI_API_KEY' in process.env,
      rawValue: apiKey ? `"${apiKey}"` : 'null'
    });

    // Дополнительная проверка - если ключ существует, но некорректный, возвращаем демо
    if (apiKey && (apiKey.trim() === '' || apiKey.length < 20 || (!apiKey.startsWith('sk-') && !apiKey.startsWith('sk-proj-') && !apiKey.startsWith('sk-svc-')))) {
      console.log('🚨 API key exists but invalid - returning demo response');
      return res.json({
        success: true,
        text: 'Привет! Я Галина, ваш AI-юрист. API ключ OpenAI некорректен. Для полноценной работы установите правильный OPENAI_API_KEY в файле api/.env'
      });
    }

    // Проверяем на различные случаи отсутствия ключа
    if (!apiKey || apiKey.trim() === '' || apiKey === 'sk-your-actual-openai-api-key-here') {
      console.log('⚠️ No valid API key configured - returning demo response');
      console.log('💡 To enable real STT, create api/.env file with: OPENAI_API_KEY=your_actual_key_here');
      return res.json({
        success: true,
        text: 'Привет! Я Галина, ваш AI-юрист. К сожалению, API ключ OpenAI не настроен, поэтому я работаю в демо-режиме. Для полноценной работы с голосом установите OPENAI_API_KEY в файле api/.env'
      });
    }

    console.log('📤 About to send to OpenAI - final check:');
    console.log('   API Key exists:', !!apiKey);
    console.log('   API Key length:', apiKey?.length);
    console.log('   API Key starts with:', apiKey?.substring(0, 15) + '...');

    // Дополнительная проверка - если ключ некорректный, возвращаем демо
    if (!apiKey || apiKey.length < 20 || (!apiKey.startsWith('sk-') && !apiKey.startsWith('sk-proj-'))) {
      console.log('🚨 API key validation failed - returning demo response');
      return res.json({
        success: true,
        text: 'Привет! Я Галина, ваш AI-юрист. API ключ OpenAI некорректен. Проверьте правильность ключа в файле api/.env'
      });
    }

    // Используем простой подход с fetch и FormData
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', audioBlob, fileName || 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ru');
    formData.append('response_format', 'json');

    console.log('📝 Prepared FormData for OpenAI:');
    console.log('   Audio blob size:', audioBlob.size);
    console.log('   Audio blob type:', audioBlob.type);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    console.log('📥 OpenAI response status:', response.status);
    console.log('📥 OpenAI response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI STT API error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to transcribe audio',
        details: errorText
      });
    }

    const result = await response.json();
    console.log('✅ OpenAI STT successful:', {
      text: result.text,
      language: result.language,
      duration: result.duration
    });

    if (!result.text || result.text.trim().length === 0) {
      console.warn('⚠️ OpenAI returned empty text');
      return res.json({
        success: true,
        text: 'Извините, не удалось распознать речь. Попробуйте говорить четче.'
      });
    }

    res.json({
      success: true,
      text: result.text.trim()
    });

  } catch (error) {
    console.error('STT Server error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

// Routes for STT with different upload methods
app.post('/stt', upload.single('audio'), handleMulterError, sttHandler); // multipart/form-data
app.post('/stt/raw', sttHandler); // raw binary - middleware applied above

// ===== DATABASE API ENDPOINTS =====

// Получить историю чата пользователя
app.get('/api/chat/history', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      include: {
        files: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    // Преобразуем timestamp для совместимости с фронтендом
    const formattedMessages = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    }));

    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Сохранить сообщение в базу данных
app.post('/api/chat/message', async (req, res) => {
  try {
    const { content, role, files = [] } = req.body;
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const message = await prisma.chatMessage.create({
      data: {
        content,
        role,
        userId,
        files: {
          create: files.map(file => ({
            name: file.name,
            type: file.type,
            size: file.size,
            content: file.content,
            userId,
          })),
        },
      },
      include: {
        files: true,
      },
    });

    res.json({ message });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Получить информацию о пользователе
app.get('/api/user/profile', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        balance: true,
        messages: {
          take: 10,
          orderBy: { timestamp: 'desc' },
        },
        files: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: userProfile });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Получить файлы пользователя
app.get('/api/files', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const files = await prisma.file.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Загрузить файл
app.post('/api/files/upload', async (req, res) => {
  try {
    const { name, type, size, content } = req.body;
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const file = await prisma.file.create({
      data: {
        name,
        type,
        size: parseInt(size),
        content,
        userId,
      },
    });

    res.json({ file });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Удалить файл
app.delete('/api/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    await prisma.file.delete({
      where: { id: fileId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Очистить всю историю чата
app.delete('/api/chat/history', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    await prisma.chatMessage.deleteMany({
      where: { userId },
    });

    // Создаем приветственное сообщение заново
    const welcomeMessage = await prisma.chatMessage.create({
      data: {
        content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос, и я постараюсь помочь вам с профессиональной консультацией.',
        role: 'assistant',
        userId,
      },
    });

    res.json({
      success: true,
      message: 'Chat history cleared',
      welcomeMessage
    });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// Получить статистику пользователя
app.get('/api/stats', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const [messageCount, fileCount, balance] = await Promise.all([
      prisma.chatMessage.count({ where: { userId } }),
      prisma.file.count({ where: { userId } }),
      prisma.userBalance.findUnique({ where: { userId } }),
    ]);

    res.json({
      stats: {
        messages: messageCount,
        files: fileCount,
        balance: balance?.amount || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL}`);
});
