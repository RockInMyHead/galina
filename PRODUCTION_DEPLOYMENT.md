# Развертывание на продакшен: Интеграция базы данных

## Предварительные требования

### Системные требования
- Node.js 18+ и npm
- SQLite (для разработки) или PostgreSQL (для продакшена)
- Минимум 512MB RAM
- Минимум 1GB дискового пространства

### Environment Variables
Создайте `.env` файлы:

#### `api/.env` (API сервер)
```bash
# Database
DATABASE_URL="file:./prisma/galina.db"

# OpenAI API
OPENAI_API_KEY="sk-your-actual-openai-api-key"

# Server
NODE_ENV="production"
PORT=3003

# CORS (для продакшена)
ALLOWED_ORIGINS="https://your-domain.com,https://www.your-domain.com"
```

#### `.env` (Frontend - если используется)
```bash
VITE_API_BASE_URL="https://your-domain.com/api"
```

## Шаг 1: Подготовка репозитория

### 1.1 Создать production branch
```bash
git checkout -b production-db-integration
git add .
git commit -m "feat: integrate database with offline-first sync

- Add Prisma ORM integration
- Implement API endpoints for balance and chat
- Create data synchronization service
- Add offline-first functionality
- Create comprehensive tests
- Add migration scripts"
git push origin production-db-integration
```

### 1.2 Создать GitHub Release
1. Перейти в GitHub repository
2. Создать новый Release из branch `production-db-integration`
3. Добавить tag: `v1.1.0-db-integration`
4. Описать изменения в release notes

## Шаг 2: Подготовка сервера

### 2.1 Установка зависимостей
```bash
# Клонировать репозиторий
git clone https://github.com/your-username/galina.git
cd galina

# Установить зависимости
npm install
cd api && npm install && cd ..

# Сгенерировать Prisma client
cd api && npx prisma generate && cd ..
```

### 2.2 Настройка базы данных
```bash
# Для SQLite (простой вариант)
cd api
export DATABASE_URL="file:./prisma/galina.db"
npx prisma db push

# Для PostgreSQL (рекомендуется для продакшена)
export DATABASE_URL="postgresql://username:password@localhost:5432/galina"
npx prisma db push
```

### 2.3 Настройка environment variables
```bash
# Скопировать примеры
cp api/env.production.example api/.env

# Отредактировать реальные значения
nano api/.env
```

## Шаг 3: Миграция данных

### 3.1 Экспорт текущих данных (если есть)
Если у вас уже есть работающее приложение с данными в localStorage:

1. **Открыть приложение в браузере**
2. **Открыть Developer Console (F12)**
3. **Выполнить экспорт:**
```javascript
// Скопировать и выполнить в консоли
const exportData = { timestamp: new Date().toISOString(), data: {} };
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('galina-')) {
    try {
      exportData.data[key] = JSON.parse(localStorage.getItem(key));
    } catch(e) {
      exportData.data[key] = localStorage.getItem(key);
    }
  }
});
console.log(JSON.stringify(exportData, null, 2));
```

4. **Сохранить результат в файл `localStorage-backup.json`**

### 3.2 Запуск миграции
```bash
cd api

# Если есть backup данных
node migrate-local-data.js ../localStorage-backup.json

# Если данных нет - просто инициализация
node -e "require('./migrate-local-data.js').migrateData({})"
```

## Шаг 4: Тестирование перед развертыванием

### 4.1 Запуск интеграционных тестов
```bash
# Запуск полного интеграционного тестирования
./test-full-integration.sh
```

### 4.2 Ручное тестирование API
```bash
cd api

# Запуск сервера для тестирования
PORT=3003 node index.js &
API_PID=$!

# Тестирование endpoints
curl http://localhost:3003/health
curl http://localhost:3003/user/profile
curl http://localhost:3003/user/balance
curl http://localhost:3003/chat/history

# Остановка сервера
kill $API_PID
```

### 4.3 Тестирование frontend
```bash
# Сборка frontend
npm run build

# Превью сборки
npm run preview &
FRONTEND_PID=$!

# Тестирование в браузере
# Открыть http://localhost:4173

# Остановка
kill $FRONTEND_PID
```

## Шаг 5: Развертывание

### 5.1 Вариант 1: PM2 (рекомендуется)
```bash
# Установка PM2
npm install -g pm2

# Создание ecosystem файла
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'galina-api',
    script: 'api/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3003
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3003
    }
  }, {
    name: 'galina-frontend',
    script: 'npm run preview',
    env: {
      PORT: 4173
    }
  }]
}
EOF

# Запуск приложений
pm2 start ecosystem.config.js --env production

# Сохранение конфигурации
pm2 save
pm2 startup
```

### 5.2 Вариант 2: Docker
```dockerfile
# Dockerfile для API
FROM node:18-alpine
WORKDIR /app
COPY api/package*.json ./
RUN npm ci --only=production
COPY api/ .
RUN npx prisma generate
EXPOSE 3003
CMD ["node", "index.js"]

# Dockerfile для Frontend
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Сборка и запуск
docker build -t galina-api ./api
docker build -t galina-frontend .
docker run -d -p 3003:3003 --env-file api/.env galina-api
docker run -d -p 80:80 galina-frontend
```

### 5.3 Вариант 3: Существующий сервер
Если у вас уже настроен сервер с nginx/php:

```bash
# Сборка frontend
npm run build

# Копирование файлов
cp -r dist/* /var/www/html/
cp -r api/* /var/www/api/

# Настройка nginx (добавить в конфиг)
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3003/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Шаг 6: Настройка мониторинга

### 6.1 Health checks
```bash
# Настройка cron для health checks
crontab -e

# Добавить:
*/5 * * * * curl -s http://localhost:3003/health || echo "API unhealthy" | mail -s "Galina API Alert" admin@your-domain.com
```

### 6.2 Логи
```bash
# Настройка ротации логов
cat > /etc/logrotate.d/galina << 'EOF'
/var/log/galina/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
EOF
```

### 6.3 Мониторинг метрик
Ключевые метрики для мониторинга:
- API response time (< 500ms)
- Database connection status
- Sync success rate (> 95%)
- Offline queue size (< 50)
- Error rate (< 5%)

## Шаг 7: Post-deployment проверки

### 7.1 Функциональное тестирование
1. **Открыть приложение в браузере**
2. **Проверить загрузку профиля**
3. **Отправить тестовое сообщение**
4. **Проверить баланс**
5. **Тестировать offline режим** (отключить интернет)

### 7.2 API тестирование
```bash
# Тест основных endpoints
curl -H "Content-Type: application/json" \
     -d '{"content":"Test message","role":"user","files":[]}' \
     https://your-domain.com/api/chat/message

curl https://your-domain.com/api/user/balance
curl https://your-domain.com/api/chat/history
```

### 7.3 Performance testing
```bash
# Load testing с помощью siege
siege -c 10 -t 30s https://your-domain.com/api/health
```

## Шаг 8: Rollback план

### 8.1 Быстрый rollback
Если что-то пойдет не так:

```bash
# Остановка новых версий
pm2 stop galina-api galina-frontend

# Запуск старой версии (если есть backup)
pm2 start ecosystem.config.old.js

# Или полный rollback базы данных
cd api
cp galina.db.backup galina.db
```

### 8.2 Восстановление данных
```bash
# Если нужно восстановить localStorage данные
# В браузере выполнить:
localStorage.clear();
// Вставить backup данные
```

## Шаг 9: Документация для команды

### 9.1 Обновление README
Обновить `README.md` с новой информацией:
- Новые API endpoints
- Процесс миграции данных
- Offline-first возможности
- Troubleshooting guide

### 9.2 Создание runbook
Создать `RUNBOOK.md` с процедурами:
- Ежедневные проверки
- Мониторинг алертов
- Процедуры восстановления
- Контакты поддержки

## Распространенные проблемы и решения

### Проблема: API возвращает 404
**Решение:**
```bash
# Проверить статус API
curl http://localhost:3003/health

# Проверить nginx конфигурацию
nginx -t && nginx -s reload
```

### Проблема: Данные не синхронизируются
**Решение:**
```bash
# Проверить статус синхронизации в браузере
console.log(syncService.getStatus())

# Перезапустить синхронизацию
syncService.forceSync()
```

### Проблема: База данных переполнена
**Решение:**
```bash
# Очистить старые данные
cd api
npx prisma db push --force-reset

# Оптимизировать базу
sqlite3 prisma/galina.db 'VACUUM;'
```

## Финальные проверки

После успешного развертывания:

- [ ] Приложение загружается без ошибок
- [ ] API endpoints отвечают корректно
- [ ] Данные синхронизируются между устройствами
- [ ] Offline режим работает
- [ ] Все тесты проходят
- [ ] Мониторинг настроен
- [ ] Команда знает процедуры поддержки

## Контакты

**Техническая поддержка:**
- Email: admin@your-domain.com
- Slack: #galina-support
- Документация: `INTEGRATION_CHANGES.md`

**Мониторинг:**
- Health checks: каждые 5 минут
- Error alerts: мгновенно
- Performance reports: ежедневно

---

## Заключение

Развертывание интеграции базы данных завершено. Система теперь имеет:

- ✅ Persistent data storage
- ✅ Offline-first functionality
- ✅ Real-time synchronization
- ✅ Comprehensive testing
- ✅ Production monitoring
- ✅ Rollback capabilities

Приложение готово к использованию в продакшен среде!
