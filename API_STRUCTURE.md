# 🔗 API URL структура проекта Galina

## Обзор
Проект использует единый домен `lawyer.windexs.ru` для frontend и API. Все API запросы идут через префикс `/api/`, который проксируется на внутренний порт 1041.

## 🌐 Production (на сервере)

### Frontend
```
https://lawyer.windexs.ru
```
- Статические файлы из `/home/sve/galina/frontend/`
- Обслуживается Nginx напрямую

### API
```
https://lawyer.windexs.ru/api/*
```
- Nginx проксирует на `localhost:1041/*`
- API сервер работает на порту 1041 (недоступен извне)

### Примеры endpoints:

| Frontend URL | Проксируется на | API сервер |
|--------------|-----------------|------------|
| `https://lawyer.windexs.ru/api/chat` | → | `localhost:1041/chat` |
| `https://lawyer.windexs.ru/api/health` | → | `localhost:1041/health` |
| `https://lawyer.windexs.ru/api/tts` | → | `localhost:1041/tts` |
| `https://lawyer.windexs.ru/api/stt` | → | `localhost:1041/stt` |
| `https://lawyer.windexs.ru/api/files` | → | `localhost:1041/files` |
| `https://lawyer.windexs.ru/api/user/profile` | → | `localhost:1041/user/profile` |
| `https://lawyer.windexs.ru/api/search-court-cases` | → | `localhost:1041/search-court-cases` |

## 💻 Development (локальная разработка)

### Frontend
```
http://localhost:3001
```
- Vite dev server

### API
```
http://localhost:3001/api/*
```
- Vite proxy проксирует на `localhost:1041/*`
- API сервер работает на порту 1041

### Примеры endpoints:

| Frontend URL | Vite proxy | API сервер |
|--------------|------------|------------|
| `http://localhost:3001/api/chat` | → | `localhost:1041/chat` |
| `http://localhost:3001/api/health` | → | `localhost:1041/health` |
| `http://localhost:3001/api/tts` | → | `localhost:1041/tts` |

## ⚙️ Конфигурация

### 1. Vite (Development)
**Файл:** `vite.config.ts`

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:1041',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api/, ''), // Убираем /api префикс
  },
}
```

### 2. Frontend API Config
**Файл:** `src/config/constants.ts`

```typescript
const getAPIBaseURL = (): string => {
  // Development и Production используют /api префикс
  return '/api';
};
```

### 3. Nginx (Production)
**Файл:** `nginx.conf`

```nginx
# API прокси (должен быть ПЕРЕД location /)
location /api/ {
    # Убираем /api/ префикс при проксировании
    rewrite ^/api/(.*) /$1 break;
    
    proxy_pass http://localhost:1041;
    proxy_http_version 1.1;
    # ... остальные настройки
}

# Frontend статика
location / {
    root /home/sve/galina/frontend;
    try_files $uri $uri/ /index.html;
}
```

## 🔍 Как это работает

### Development:
1. Frontend делает запрос: `fetch('/api/chat', ...)`
2. Vite proxy перехватывает `/api/*`
3. Убирает префикс `/api` и проксирует на `localhost:1041/chat`
4. API сервер обрабатывает запрос на порту 1041

### Production:
1. Frontend делает запрос: `fetch('/api/chat', ...)`
2. Браузер отправляет: `https://lawyer.windexs.ru/api/chat`
3. Nginx перехватывает `/api/*`
4. Убирает префикс `/api` и проксирует на `localhost:1041/chat`
5. API сервер обрабатывает запрос на порту 1041

## 🚀 Преимущества такой структуры

1. **Единый домен** - нет проблем с CORS
2. **Безопасность** - API порт 1041 не доступен извне
3. **SSL** - один сертификат для frontend и API
4. **Простота** - одинаковая структура URL в dev и prod
5. **Кэширование** - можно настроить разное кэширование для `/api` и статики

## 📝 Примеры использования в коде

### Отправка сообщения в чат:
```typescript
// В любом окружении (dev/prod)
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages, model: 'gpt-3.5-turbo' })
});
```

### Проверка здоровья API:
```typescript
const response = await fetch('/api/health');
const data = await response.json();
console.log(data); // { status: 'ok', ... }
```

## 🔧 Тестирование

### Development:
```bash
# Запустить API
cd api && npm run dev

# Запустить Frontend (в другом терминале)
npm run dev

# Тест
curl http://localhost:3001/api/health
```

### Production:
```bash
# На сервере
curl http://localhost:1041/health  # Прямой доступ к API
curl https://lawyer.windexs.ru/api/health  # Через Nginx
```

## ⚠️ Важные замечания

1. **Порт 1041** - используется только внутри сервера, недоступен извне
2. **Префикс /api** - обязателен для всех API запросов
3. **Nginx location** - `/api/` должен быть ПЕРЕД `location /`
4. **Rewrite правило** - убирает `/api` префикс при проксировании
