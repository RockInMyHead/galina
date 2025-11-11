# Deployment Guide for Галина

Этот документ описывает как задеплоить Галину на продакшн сервер `lawyer.windexs.ru`.

## Окружение

- **Домен:** lawyer.windexs.ru
- **Основной порт:** 1041
- **SSH:** sve@77.37.146.116 -p 1040
- **Доп. порты:** 1041-1049
- **Сервер:** Linux

## Структура проекта на сервере

```
/home/sve/galina/
├── frontend/          # React + Vite app
│   ├── dist/         # Build output (served by nginx)
│   ├── src/
│   ├── package.json
│   └── .env.production
├── api/               # Express backend
│   ├── index.js
│   ├── package.json
│   ├── .env
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── galina.db
│   └── node_modules/
└── nginx/            # Nginx configuration
    └── galina.conf
```

## Деплой Фронтенда

### 1. Подготовка

```bash
# На локальной машине - собрать проект
npm run build

# Результат в папке dist/
```

### 2. Загрузка на сервер

```bash
# На сервере
scp -P 1040 -r ./dist sve@77.37.146.116:/home/sve/galina/frontend/

# Или используй rsync для большых файлов
rsync -av -e "ssh -p 1040" ./dist/ sve@77.37.146.116:/home/sve/galina/frontend/dist/
```

### 3. Обновление .env на фронтенде

На сервере в `/home/sve/galina/frontend/` создать `.env.production`:

```env
# Production API URL
VITE_API_BASE_URL=https://lawyer.windexs.ru:1041
```

## Деплой Бэкенда

### 1. Загрузка на сервер

```bash
# На сервере
scp -P 1040 -r ./api sve@77.37.146.116:/home/sve/galina/

# Или
rsync -av -e "ssh -p 1040" ./api/ sve@77.37.146.116:/home/sve/galina/api/
```

### 2. Установка зависимостей

```bash
ssh -p 1040 sve@77.37.146.116
cd /home/sve/galina/api
npm install --production
```

### 3. Создание .env файла

На сервере в `/home/sve/galina/api/` создать `.env`:

```env
# Database (SQLite by default)
DATABASE_URL="sqlite:./prisma/galina.db"

# OpenAI API Key
OPENAI_API_KEY=sk-your-actual-key-here

# Server Configuration
PORT=1041
NODE_ENV=production

# CORS Configuration
CORS_ORIGIN=https://lawyer.windexs.ru
```

### 4. Создание и миграция БД

```bash
cd /home/sve/galina/api
npm run migrate
npm run seed  # if available
```

### 5. Запуск Бэкенда

Использовать PM2 для управления процессом:

```bash
npm install -g pm2

# Запустить API
pm2 start "npm start" --name "galina-api" --port 1041

# Сохранить конфиг для автозагрузки
pm2 startup
pm2 save

# Проверить статус
pm2 status
pm2 logs galina-api
```

Или использовать systemd сервис:

```bash
# Создать файл /etc/systemd/system/galina-api.service
sudo nano /etc/systemd/system/galina-api.service
```

```ini
[Unit]
Description=Галина API Server
After=network.target

[Service]
Type=simple
User=sve
WorkingDirectory=/home/sve/galina/api
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Запустить сервис
sudo systemctl daemon-reload
sudo systemctl enable galina-api
sudo systemctl start galina-api
sudo systemctl status galina-api
```

## Nginx Конфигурация

Создать `/etc/nginx/sites-available/galina.conf`:

```nginx
server {
    listen 80;
    server_name lawyer.windexs.ru;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name lawyer.windexs.ru;

    # SSL Certificates (используй Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/lawyer.windexs.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lawyer.windexs.ru/privkey.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Serve Frontend
    location / {
        root /home/sve/galina/frontend;
        try_files $uri $uri/ /index.html;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    # Proxy API requests to backend
    location /chat {
        proxy_pass http://localhost:1041;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
    }

    location /tts {
        proxy_pass http://localhost:1041;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /stt {
        proxy_pass http://localhost:1041;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50m;
    }

    location /health {
        proxy_pass http://localhost:1041;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Proxy other API routes
    location ~ ^/(chat/|user/|files|stats|search-court) {
        proxy_pass http://localhost:1041;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активировать конфиг:

```bash
sudo ln -s /etc/nginx/sites-available/galina.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL Сертификат (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --standalone -d lawyer.windexs.ru

# Автообновление
sudo certbot renew --dry-run
```

## Проверка

### 1. API Health Check

```bash
curl -k https://lawyer.windexs.ru/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-11T10:00:00.000Z",
  "database": "configured",
  "openai": "configured"
}
```

### 2. Frontend

Открыть в браузере: `https://lawyer.windexs.ru`

### 3. Логи

```bash
# Бэкенд логи
pm2 logs galina-api

# Nginx логи
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Системные логи
journalctl -u galina-api -f
```

## Обновление на продакшене

### Frontend Update

```bash
# На локальной машине
npm run build

# Загрузить на сервер
rsync -av -e "ssh -p 1040" ./dist/ sve@77.37.146.116:/home/sve/galina/frontend/dist/

# На сервере - перезагрузить Nginx (при необходимости)
ssh -p 1040 sve@77.37.146.116 'sudo systemctl reload nginx'
```

### Backend Update

```bash
# На локальной машине
# Сделать коммит и пушить на GitHub

# На сервере
cd /home/sve/galina/api
git pull origin main
npm install --production
npm run migrate
pm2 restart galina-api
```

## Мониторинг

### 1. PM2 Monitoring

```bash
pm2 monit
pm2 web  # Web dashboard на порту 9615
```

### 2. Логирование

Сохранить логи PM2:

```bash
pm2 logs galina-api --lines 100 > api_logs.txt
```

### 3. Проверка диска

```bash
df -h
du -sh /home/sve/galina/
```

## Проблемы и решения

### Ошибка: "connect ECONNREFUSED"

- Проверить, запущен ли API: `pm2 status`
- Проверить порт: `netstat -tlnp | grep 1041`
- Проверить логи: `pm2 logs galina-api`

### Ошибка: "CORS error"

- Обновить `CORS_ORIGIN` в `.env`
- Перезагрузить API: `pm2 restart galina-api`

### Ошибка: "Database connection failed"

- Проверить `DATABASE_URL` в `.env`
- Убедиться, что папка `prisma/` доступна на запись
- Запустить миграцию: `npm run migrate`

### Ошибка: "SSL certificate error"

- Обновить сертификат: `sudo certbot renew`
- Перезагрузить Nginx: `sudo systemctl reload nginx`

## Backup

### Автоматический backup БД

```bash
# Добавить в crontab
0 2 * * * cp /home/sve/galina/api/prisma/galina.db /home/sve/galina/backups/galina.db.$(date +\%Y\%m\%d)
```

## Завершение

Проект готов к использованию на `https://lawyer.windexs.ru` ✅

Для вопросов и проблем при деплое обратись к этому документу.

