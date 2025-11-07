require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateData() {
  try {
    console.log('🚀 Начинаю миграцию данных из localStorage в базу данных...');

    // Создаем демо-пользователя (имитация текущего пользователя)
    const user = await prisma.user.upsert({
      where: { email: 'demo@galina.ai' },
      update: {},
      create: {
        email: 'demo@galina.ai',
        name: 'Demo User',
      },
    });
    console.log('✅ Создан пользователь:', user.email);

    // Создаем баланс пользователя
    const balance = await prisma.userBalance.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        amount: 1000, // Дефолтный баланс
      },
    });
    console.log('✅ Создан баланс:', balance.amount);

    // Имитируем данные из localStorage (сообщения чата)
    const mockChatMessages = [
      {
        id: 'msg-1',
        content: 'Здравствуйте! Я Галина, ваш AI-юрист. Задайте мне любой юридический вопрос, и я постараюсь помочь вам с профессиональной консультацией.',
        role: 'assistant',
        timestamp: new Date(Date.now() - 3600000), // 1 час назад
        userId: user.id,
      },
      {
        id: 'msg-2',
        content: 'Как правильно расторгнуть трудовой договор?',
        role: 'user',
        timestamp: new Date(Date.now() - 1800000), // 30 минут назад
        userId: user.id,
      },
      {
        id: 'msg-3',
        content: 'Для расторжения трудового договора по инициативе работника необходимо письменно уведомить работодателя за две недели (ст. 80 ТК РФ). В уведомлении укажите дату увольнения. Работодатель обязан выдать вам трудовую книжку и произвести окончательный расчет в день увольнения. Если работодатель задерживает выдачу документов, вы имеете право обратиться в суд.',
        role: 'assistant',
        timestamp: new Date(Date.now() - 1700000), // 28 минут назад
        userId: user.id,
      },
      {
        id: 'msg-4',
        content: 'А если работодатель не согласен с увольнением?',
        role: 'user',
        timestamp: new Date(Date.now() - 600000), // 10 минут назад
        userId: user.id,
      },
      {
        id: 'msg-5',
        content: 'Работодатель не имеет права отказать вам в увольнении по собственному желанию (ст. 80 ТК РФ). Однако он может предложить отработать две недели или уволиться раньше по соглашению сторон. Если работодатель чинит препятствия, вы можете обратиться в трудовую инспекцию или суд.',
        role: 'assistant',
        timestamp: new Date(Date.now() - 500000), // 8 минут назад
        userId: user.id,
      },
    ];

    console.log('📝 Миграция сообщений чата...');
    for (const msgData of mockChatMessages) {
      const message = await prisma.chatMessage.create({
        data: {
          content: msgData.content,
          role: msgData.role,
          timestamp: msgData.timestamp,
          userId: user.id,
        },
      });
      console.log('✅ Создано сообщение:', message.id, '-', message.role);
    }

    // Имитируем файлы (если они были в localStorage)
    const mockFiles = [
      {
        name: 'трудовой_договор.pdf',
        type: 'application/pdf',
        size: 245760, // 240 KB
        content: 'PDF_DOCUMENT_CONTENT_PLACEHOLDER',
        userId: user.id,
      },
      {
        name: 'уведомление_об_увольнении.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 15360, // 15 KB
        content: 'WORD_DOCUMENT_CONTENT_PLACEHOLDER',
        userId: user.id,
      },
    ];

    console.log('📎 Миграция файлов...');
    for (const fileData of mockFiles) {
      const file = await prisma.file.create({
        data: {
          name: fileData.name,
          type: fileData.type,
          size: fileData.size,
          content: fileData.content,
          userId: user.id,
        },
      });
      console.log('✅ Создан файл:', file.name, `(${file.size} bytes)`);
    }

    // Проверяем финальный результат
    const migratedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 5,
        },
        balance: true,
        files: true,
      },
    });

    console.log('\n🎯 Резюме миграции:');
    console.log(`👤 Пользователь: ${migratedUser.name} (${migratedUser.email})`);
    console.log(`💬 Сообщений: ${migratedUser.messages.length}`);
    console.log(`📁 Файлов: ${migratedUser.files.length}`);
    console.log(`💰 Баланс: ${migratedUser.balance.amount}`);

    console.log('\n🎉 Миграция данных успешно завершена!');
    console.log('💡 Теперь все данные хранятся в базе данных SQLite вместо localStorage');

  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск миграции
migrateData()
  .then(() => {
    console.log('✅ Скрипт миграции завершен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Скрипт миграции завершился с ошибкой:', error);
    process.exit(1);
  });
