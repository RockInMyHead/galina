require('dotenv').config({ path: '.env.local' });
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('🔍 Тестирую подключение к базе данных...');

    // Создаем демо-пользователя
    const user = await prisma.user.upsert({
      where: { email: 'demo@galina.ai' },
      update: {},
      create: {
        email: 'demo@galina.ai',
        name: 'Demo User',
      },
    });
    console.log('✅ Создан пользователь:', user);

    // Создаем баланс для пользователя
    const balance = await prisma.userBalance.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        amount: 1000,
      },
    });
    console.log('✅ Создан баланс:', balance);

    // Создаем демо-сообщения
    const messages = [
      {
        content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос, и я постараюсь помочь вам с профессиональной консультацией.',
        role: 'assistant',
        userId: user.id,
      },
      {
        content: 'Как правильно расторгнуть трудовой договор?',
        role: 'user',
        userId: user.id,
      },
      {
        content: 'Для расторжения трудового договора существуют следующие основания согласно Трудовому кодексу РФ...',
        role: 'assistant',
        userId: user.id,
      },
    ];

    for (const msgData of messages) {
      const message = await prisma.chatMessage.create({
        data: msgData,
      });
      console.log('✅ Создано сообщение:', message.id);
    }

    // Проверяем созданные данные
    const userWithData = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        messages: true,
        balance: true,
      },
    });

    console.log('🎯 Финальный результат:');
    console.log('- Пользователь:', userWithData.name);
    console.log('- Сообщений:', userWithData.messages.length);
    console.log('- Баланс:', userWithData.balance?.amount);

    console.log('🎉 База данных успешно настроена и протестирована!');

  } catch (error) {
    console.error('❌ Ошибка при работе с базой данных:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
