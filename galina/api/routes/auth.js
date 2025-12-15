// Authentication routes
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const prisma = require('../db/prisma');
const config = require('../config');

// Регистрация пользователя
router.post('/register', async (req, res) => {
  try {
    console.log('🔐 Registration request:', { email: req.body.email, name: req.body.name });

    const { email, password, name } = req.body;

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      console.log('❌ Password too short');
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Проверяем, существует ли пользователь
    console.log('🔍 Checking if user exists...');
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('❌ User already exists');
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Хэшируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0]
      }
    });

    // Создаем баланс для пользователя
    await prisma.userBalance.create({
      data: {
        userId: user.id,
        amount: 1500 // Initial balance
      }
    });

    // Создаем JWT токен
    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Вход пользователя
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Ищем пользователя
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Создаем JWT токен
    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

module.exports = router;
