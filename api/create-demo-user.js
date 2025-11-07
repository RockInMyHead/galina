require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDemoUser() {
  try {
    console.log('👤 Создание демо-пользователя...');

    const user = await prisma.user.upsert({
      where: { email: 'demo@galina.ai' },
      update: {},
      create: {
        id: 'demo-user-id', // Фиксированный ID для API
        email: 'demo@galina.ai',
        name: 'Demo User',
      },
    });
    console.log('✅ Пользователь создан:', user);

    // Создаем баланс
    const balance = await prisma.userBalance.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        amount: 1000,
      },
    });
    console.log('✅ Баланс создан:', balance.amount);

    // Создаем приветственное сообщение
    const welcomeMessage = await prisma.chatMessage.upsert({
      where: {
        id: 'welcome-message'
      },
      update: {},
      create: {
        id: 'welcome-message',
        content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос, и я постараюсь помочь вам с профессиональной консультацией.',
        role: 'assistant',
        userId: user.id,
      },
    });
    console.log('✅ Приветственное сообщение создано');

    console.log('🎉 Демо-пользователь успешно создан!');
    console.log('📊 User ID:', user.id);
    console.log('📧 Email:', user.email);
    console.log('💰 Баланс:', balance.amount);

  } catch (error) {
    console.error('❌ Ошибка создания демо-пользователя:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDemoUser();
