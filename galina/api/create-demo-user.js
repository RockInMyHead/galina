const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createDemoUser() {
  try {
    console.log('🔍 Проверяем существующего демо-пользователя...');

    const existingUser = await prisma.user.findUnique({
      where: { email: 'demo@example.com' }
    });

    if (existingUser) {
      console.log('✅ Демо-пользователь уже существует:', existingUser.email);
      return;
    }

    console.log('👤 Создаем демо-пользователя...');

    const hashedPassword = await bcrypt.hash('demo123', 10);

    const demoUser = await prisma.user.create({
      data: {
        email: 'demo@example.com',
        name: 'Demo User',
        password: hashedPassword,
      }
    });

    // Создаем баланс для пользователя
    await prisma.userBalance.create({
      data: {
        userId: demoUser.id,
        amount: 1500 // Initial balance
      }
    });

    console.log('✅ Демо-пользователь создан успешно!');
    console.log('📧 Email: demo@example.com');
    console.log('🔑 Password: demo123');
    console.log('💰 Баланс: 1500 RUB');

  } catch (error) {
    console.error('❌ Ошибка создания демо-пользователя:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDemoUser();