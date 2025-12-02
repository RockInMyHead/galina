# 🤖 Галина - AI-Юрист

Профессиональный AI-ассистент для юридической помощи с голосовым интерфейсом и анализом документов.

## ✨ Возможности

### 🤖 AI-Юрист Галина
- Профессиональные юридические консультации
- Генерация планов ответов перед предоставлением информации
- Полноценная юридическая экспертиза
- Работа с российским законодательством

### 🎤 Голосовое общение
- Распознавание речи в реальном времени (русский язык)
- Автоматическая отправка сообщений (2 секунды молчания)
- Непрерывное прослушивание с автоматическим возобновлением
- Синхронизированное видео с речью AI
- Синтез речи (OpenAI TTS) с параллельной обработкой
- Полноценные диалоги без прерываний

### 📄 Анализ документов
- Автоматический анализ PDF документов
- Извлечение текста и юридическая экспертиза
- Генерация подробных отчетов
- Скачивание результатов в PDF

### 🔒 Безопасность
- Система авторизации и регистрации
- Защищенные маршруты
- Persistent sessions в localStorage

### 🎨 Современный интерфейс
- Адаптивный дизайн с Tailwind CSS
- Профессиональная зеленая цветовая схема (#129246)
- Темная тема
- Интуитивно понятная навигация
- Анимированные переходы и визуальная обратная связь

## 🚀 Быстрый старт

### Предварительные требования
- Node.js 18+
- npm или yarn

### Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/RockInMyHead/galina.git
cd galina
```

2. Установите зависимости:
```bash
npm install
cd api && npm install && cd ..
```

3. Настройте переменные окружения:
```bash
# Создайте файл .env в корне проекта (для фронтенда)
# Добавьте Google AI Studio API ключ (опционально, для функции заполнения документов):
VITE_GEMINI_API_KEY=your-gemini-api-key-here

# Настройте API сервер (файл api/.env):
# См. api/env.production.example для примера
```

4. Запустите проект:
```bash
# Frontend (порт 3000)
npm run dev

# Backend (порт 3001) - в отдельном терминале
cd api && ./start-server.sh
```

4. Откройте https://lawyer.windexs.ru

## 🚀 Production развертывание

Проект развернут на https://lawyer.windexs.ru

### Структура production:
- **Frontend**: Vite + React на основном домене
- **Backend**: Node.js API на том же домене (/api/*)
- **SSL**: Полный HTTPS с Let's Encrypt
- **CDN**: Cloudflare для оптимизации загрузки

### Настройка Nginx (важно для корректной работы API):

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

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/lawyer.windexs.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lawyer.windexs.ru/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API proxy to Node.js backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;

        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Static files and frontend
    location / {
        root /var/www/lawyer.windexs.ru/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Security: deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
```

### Запуск сервисов:

```bash
# 1. Backend API (Node.js) - порт 3001
cd /var/www/lawyer.windexs.ru/api
NODE_ENV=production PORT=3001 node index.js &

# 2. Проверить что API работает:
curl http://localhost:3001/api/chat

# 3. Frontend файлы должны быть в /var/www/lawyer.windexs.ru/html/
# Скопировать из dist/ после npm run build

# 4. Nginx конфигурация (nginx.conf в корне проекта)
sudo cp nginx.conf /etc/nginx/sites-available/lawyer.windexs.ru
sudo ln -sf /etc/nginx/sites-available/lawyer.windexs.ru /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Мониторинг production:
Если возникают проблемы, проверьте:
- ✅ Доступность домена
- ✅ SSL сертификат
- ✅ API endpoints (`curl https://lawyer.windexs.ru/api/chat`)
- ✅ Nginx конфигурация (`nginx -t`)
- ✅ Node.js процесс (`ps aux | grep node`)
- ✅ CORS настройки

## 📋 Использование

1. **Регистрация/Вход**: Создайте аккаунт или войдите
2. **Голосовое общение**: Перейдите в раздел "Консультация"
3. **Анализ документов**: Загрузите PDF в раздел "Анализ документов"
4. **Заполнение форм**: Используйте автоматизированное заполнение

## 🛠 Технический стек

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js
- **AI**: OpenAI API (GPT-5.1 с reasoning)
- **Speech**: Web Speech API, OpenAI TTS
- **Документы**: PDF-lib, PDF.js
- **Аутентификация**: React Context API

## 📁 Структура проекта

```
galina/
├── src/
│   ├── components/          # Переиспользуемые компоненты
│   ├── contexts/           # React Context (Auth)
│   ├── pages/             # Страницы приложения
│   ├── utils/             # Утилиты и API
│   └── config/            # Конфигурация
├── api/                   # Backend сервер
├── public/               # Статические файлы
└── README.md
```

## 🤝 Вклад в проект

1. Fork проект
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект лицензирован под MIT License - смотрите файл [LICENSE](LICENSE) для деталей.

## 👨‍💻 Автор

**RockInMyHead** - [GitHub](https://github.com/RockInMyHead)

## 🙏 Благодарности

- OpenAI за мощные AI модели
- React и Vite за отличные инструменты
- Tailwind CSS за прекрасный дизайн
- Всех контрибьюторов и пользователей!

---

⭐ Если проект вам понравился, поставьте звезду!