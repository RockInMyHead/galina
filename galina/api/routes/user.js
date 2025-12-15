// User management routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const prisma = require('../db/prisma');

// GET /user/profile - Get user profile information
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

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

    if (!userProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: userProfile });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to fetch user profile',
      message: error.message
    });
  }
});

// Демо-профиль для демо-режима (без аутентификации)
router.get('/profile/demo', async (req, res) => {
  try {
    console.log('📋 Demo profile request');

    // Возвращаем демо-профиль
    const demoProfile = {
      user: {
        id: 'demo-user',
        email: 'demo@galina.ai',
        name: 'Демо Пользователь',
        createdAt: new Date().toISOString(),
      },
      balance: {
        amount: 1500,
        currency: 'RUB'
      },
      preferences: {
        learning_style: 'visual',
        difficulty_level: 'intermediate',
        interests: ['юридические консультации', 'документы', 'права потребителя']
      },
      messages: [],
      files: []
    };

    res.json(demoProfile);
  } catch (error) {
    console.error('❌ Demo profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /user/balance - Get user balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userBalance = await prisma.userBalance.findUnique({
      where: { userId },
    });

    res.json({
      balance: userBalance?.amount || 0,
      currency: 'RUB'
    });
  } catch (error) {
    console.error('Error fetching user balance:', error);
    res.status(500).json({ error: 'Failed to fetch user balance' });
  }
});

// PUT /user/balance - Update user balance
router.put('/balance', authenticateToken, async (req, res) => {
  try {
    const { amount, operation } = req.body; // operation: 'set', 'add', 'subtract'

    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const userId = req.user.id;

    let newAmount;
    const currentBalance = await prisma.userBalance.findUnique({
      where: { userId },
    });

    switch (operation) {
      case 'set':
        newAmount = amount;
        break;
      case 'add':
        newAmount = (currentBalance?.amount || 0) + amount;
        break;
      case 'subtract':
        newAmount = Math.max(0, (currentBalance?.amount || 0) - amount);
        break;
      default:
        return res.status(400).json({ error: 'Invalid operation. Use: set, add, subtract' });
    }

    const updatedBalance = await prisma.userBalance.upsert({
      where: { userId },
      update: { amount: newAmount },
      create: { userId, amount: newAmount },
    });

    res.json({
      balance: updatedBalance.amount,
      currency: 'RUB',
      operation,
      previousAmount: currentBalance?.amount || 0
    });
  } catch (error) {
    console.error('Error updating user balance:', error);
    res.status(500).json({ error: 'Failed to update user balance' });
  }
});

// GET /stats - Get user statistics
router.get('/stats', async (req, res) => {
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

module.exports = router;
