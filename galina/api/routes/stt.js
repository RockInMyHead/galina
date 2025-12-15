// Speech-to-Text routes
const express = require('express');
const multer = require('multer');
const router = express.Router();
const openaiAdapter = require('../services/openai/adapter');
const config = require('../config');

// Настройка multer для обработки больших файлов
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
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

    const apiKey = config.OPENAI_API_KEY;
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
    const result = await openaiAdapter.createTranscription(audioBuffer, {
      language: 'ru',
      response_format: 'json'
    });

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
router.post('/', upload.single('audio'), sttHandler); // multipart/form-data
// Raw binary route will be handled in main server with express.raw middleware

module.exports = { router, sttHandler };
