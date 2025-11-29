# 🚀 Production режим для Галины AI-Юриста

## 📋 Обзор

Production режим настроен для развертывания приложения на сервере с использованием внешнего API сервера `https://lawyer.windexs.ru`.

## 🔧 Конфигурация Production

### Основные файлы:
- `.env.production` - Переменные окружения для production
- `api/.env.production` - Переменные окружения для API сервера
- `start-prod.sh` - Скрипт запуска production сервера
- `stop-prod.sh` - Скрипт остановки production сервера

### Переменные окружения:

#### Frontend (`.env.production`):
```bash
# API Configuration - Production mode uses external API
VITE_API_BASE_URL=https://lawyer.windexs.ru/api

# Application Configuration
VITE_APP_NAME=Galina AI Lawyer
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_VOICE_CHAT=true
VITE_ENABLE_DOCUMENT_ANALYSIS=true
VITE_ENABLE_DEBUG_LOGS=false
```

#### Backend (`api/.env.production`):
```bash
# OpenAI API Configuration
OPENAI_API_KEY=sk-proj-your-actual-key-here

# Server Configuration
NODE_ENV=production
PORT=1041

# Database Configuration
DATABASE_URL="file:./prisma/galina.db"

# CORS Configuration
CORS_ORIGIN=https://lawyer.windexs.ru
```

## 🏗️ Сборка Production

### 1. Сборка приложения:
```bash
npm run build:prod
```

### 2. Проверка сборки:
```bash
ls -la dist/
# dist/index.html
# dist/assets/
```

## 🚀 Запуск Production

### Способ 1: Production скрипт
```bash
./start-prod.sh
```

### Способ 2: Ручной запуск
```bash
# Собрать
npm run build:prod

# Запустить
npm run serve:prod
```

## 📊 Мониторинг Production

### Проверка работы:
```bash
# Проверить сервер
curl -s http://localhost:3002 | head -10

# Проверить API
curl -s https://lawyer.windexs.ru/api/health
```

### Логи приложения:
- Откройте браузер: `http://localhost:3002`
- Откройте DevTools (F12) → Console
- Ищите логи: `🔧 API URL Configuration`

### Ожидаемые логи:
```
🔧 API URL Configuration: {
  VITE_API_BASE_URL: "https://lawyer.windexs.ru/api",
  DEV: false,
  PROD: true,
  MODE: "production"
}
✅ Using VITE_API_BASE_URL: https://lawyer.windexs.ru/api
```

## 🔄 API Endpoints

### Production API: `https://lawyer.windexs.ru/api`
- `POST /chat` - Отправка сообщений в чат
- `POST /tts` - Генерация речи
- `POST /stt` - Распознавание речи
- `GET /health` - Проверка здоровья сервера

### Локальный сервер: `http://localhost:3002`
- Статические файлы React приложения
- Проксирование на production API

## 🛑 Остановка Production

```bash
./stop-prod.sh
```

## 🚀 Развертывание на сервере

### 1. Скопировать файлы:
```bash
scp -r dist/ user@server:/var/www/galina/
```

### 2. Настроить веб-сервер (Nginx):
```nginx
server {
    listen 80;
    server_name lawyer.windexs.ru;

    root /var/www/galina/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass https://lawyer.windexs.ru;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. Запустить Nginx:
```bash
sudo systemctl restart nginx
```

## 🔍 Диагностика проблем

### Проблема: Приложение не загружается
```bash
# Проверить логи Nginx
sudo tail -f /var/log/nginx/error.log

# Проверить файлы
ls -la /var/www/galina/dist/
```

### Проблема: API не отвечает
```bash
# Проверить статус API сервера
curl -s https://lawyer.windexs.ru/api/health

# Проверить логи API сервера
ssh user@api-server
tail -f /var/log/galina/api.log
```

### Проблема: Неправильный API URL
```bash
# Проверить переменные окружения в браузере
# Открыть DevTools → Console
# Найти логи API URL Configuration
```

## 📈 Производительность

### Оптимизации:
- ✅ Минификация и сжатие
- ✅ Code splitting
- ✅ Lazy loading компонентов
- ✅ Оптимизированные изображения

### Размеры бандлов:
- `index.html`: 1.33 kB (gzip: 0.73 kB)
- `index.css`: 116.06 kB (gzip: 18.08 kB)
- `index.js`: 150.45 kB (gzip: 51.41 kB)
- `vendor.js`: 2,388.22 kB (gzip: 664.24 kB)

## 🔐 Безопасность

- ✅ Переменные окружения не коммитятся
- ✅ API ключи хранятся на сервере
- ✅ CORS настроен для домена
- ✅ HTTPS обязательен

## 📞 Поддержка

При проблемах с production:
1. Проверьте логи браузера
2. Проверьте статус API сервера
3. Проверьте конфигурацию Nginx
4. Проверьте переменные окружения
