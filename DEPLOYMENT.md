# 🚀 Развертывание проекта Galina

## 📋 Быстрый старт

### 1. Клонирование репозитория
```bash
git clone https://github.com/RockInMyHead/galina.git
cd galina
```

### 2. Установка зависимостей
```bash
npm install
cd api && npm install && cd ..
```

### 3. Настройка переменных окружения
```bash
# В папке api/ создайте .env файл
cd api
cp .env.production .env

# Отредактируйте переменные:
# OPENAI_API_KEY - ваш API ключ OpenAI
# JWT_SECRET - случайный секрет для JWT (измените!)
# DATABASE_URL - оставьте как есть (file:./prisma/galina.db)
```

### 4. Запуск сервера
```bash
# Из корневой папки проекта
npm start
```

## ✨ Что происходит автоматически

### 🗄️ Инициализация базы данных
При первом запуске сервер **автоматически**:
- ✅ Создает файл базы данных `api/prisma/galina.db`
- ✅ Выполняет миграции (создает таблицы)
- ✅ Создает демо-пользователя

### 👤 Демо-пользователь
```
Email: demo@galina.ai
Пароль: demo123
```

### 🌐 Доступ к приложению
- **Frontend:** `http://localhost:3002`
- **API:** `http://localhost:3004`
- **Voice Chat:** `http://localhost:3002/voice-lawyer`

## 🔧 Ручное управление (если нужно)

### Остановка сервера
```bash
# Найти процесс
ps aux | grep node

# Остановить
kill <PID>
# или
npm stop
```

### Пересоздание базы данных
```bash
cd api
rm prisma/galina.db
npm run db:push
npm run create-demo-user
```

### Просмотр базы данных
```bash
cd api
npm run db:studio
```

## 📦 Production развертывание

### На сервере:
```bash
# 1. Установить Node.js и npm
# 2. Клонировать репозиторий
git clone https://github.com/RockInMyHead/galina.git

# 3. Установить зависимости
cd galina
npm install
cd api && npm install && cd ..

# 4. Настроить переменные окружения
cd api
cp .env.production .env
# Отредактировать OPENAI_API_KEY и JWT_SECRET

# 5. Запустить через PM2 (рекомендуется)
npm install -g pm2
pm2 start npm --name "galina" -- start
pm2 save
pm2 startup
```

### Nginx конфигурация (пример):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API
    location /api {
        proxy_pass http://localhost:3004;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🚨 Возможные проблемы

### База данных не создается
```bash
# Проверить права на запись
ls -la api/prisma/

# Создать вручную
cd api
mkdir -p prisma
npm run db:push
```

### Сервер не запускается
```bash
# Проверить порты
lsof -i :3002
lsof -i :3004

# Проверить логи
npm run direct 2>&1 | head -n 50
```

### API возвращает 500 ошибку
```bash
# Проверить переменные окружения
cd api && cat .env

# Проверить базу данных
npm run db:test

# Проверить API вручную
curl http://localhost:3004/health
```

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи сервера
2. Убедитесь, что все переменные окружения настроены
3. Проверьте права доступа к файлам
4. Попробуйте пересоздать базу данных

**Репозиторий:** `https://github.com/RockInMyHead/galina.git`