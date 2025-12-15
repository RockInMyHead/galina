// Chat routes
const express = require('express');
const router = express.Router();
const chatService = require('../services/chat');
const { authenticateToken } = require('../middlewares/auth');

// POST /chat - Send a message to the AI chatbot
router.post('/', async (req, res) => {
  try {
    const { messages, model, max_completion_tokens, temperature, stream } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const result = await chatService.processChatRequest({
      messages,
      model,
      max_completion_tokens,
      temperature,
      stream
    });

    // Handle streaming response
    if (stream && result instanceof Response) {
      // Forward the streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const reader = result.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          res.write(chunk);
        }
      } finally {
        reader.releaseLock();
        res.end();
      }
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Chat route error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /chat/history - Get user's chat history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const prisma = require('../db/prisma');
    const userId = req.user.id;

    const { since } = req.query;
    const whereClause = { userId };

    // Add since filter for incremental sync
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        whereClause.timestamp = {
          gt: sinceDate
        };
      }
    }

    const messages = await prisma.chatMessage.findMany({
      where: whereClause,
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

// POST /chat/message - Save a new chat message
router.post('/message', async (req, res) => {
  try {
    const prisma = require('../db/prisma');
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

// DELETE /chat/history - Clear all chat history for the current user
router.delete('/history', async (req, res) => {
  try {
    const prisma = require('../db/prisma');
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

module.exports = router;
