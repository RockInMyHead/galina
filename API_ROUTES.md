# 🔗 API Routes Configuration

## Архитектура

```
Frontend (lawyer.windexs.ru)
    ↓
    /api/* запросы
    ↓
Nginx (lawyer.windexs.ru:80)
    ↓
    Проксирует на localhost:1041
    ↓
API Server (localhost:1041)
```

## Маршрутизация

### Production (lawyer.windexs.ru)
- **Frontend**: `https://lawyer.windexs.ru/` → Статические файлы из `/home/sve/galina/frontend/`
- **API**: `https://lawyer.windexs.ru/api/*` → Проксируется на `http://localhost:1041/*`

### Development (localhost:3001)
- **Frontend**: `http://localhost:3001/` → Vite dev server
- **API**: `http://localhost:3001/api/*` → Vite proxy → `http://localhost:1041/*`

## API Endpoints

Все запросы к API должны начинаться с `/api/`:

### Chat
- `POST /api/chat` → `localhost:1041/chat`

### Text-to-Speech
- `POST /api/tts` → `localhost:1041/tts`

### Speech-to-Text
- `POST /api/stt` → `localhost:1041/stt`
- `POST /api/stt/raw` → `localhost:1041/stt/raw`

### Health Check
- `GET /api/health` → `localhost:1041/health`

### User
- `GET /api/user/profile` → `localhost:1041/user/profile`

### Files
- `GET /api/files` → `localhost:1041/files`
- `POST /api/files/upload` → `localhost:1041/files/upload`
- `DELETE /api/files/:fileId` → `localhost:1041/files/:fileId`

### Chat History
- `GET /api/chat/history` → `localhost:1041/chat/history`
- `POST /api/chat/message` → `localhost:1041/chat/message`
- `DELETE /api/chat/history` → `localhost:1041/chat/history`

### Statistics
- `GET /api/stats` → `localhost:1041/stats`

### Court Cases Search
- `POST /api/search-court-cases` → `localhost:1041/search-court-cases`

## Примеры запросов

### Development
```javascript
// Frontend код автоматически добавит /api префикс
fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [...] })
})
// Реальный запрос: http://localhost:3001/api/chat
// Vite proxy: http://localhost:1041/chat
```

### Production
```javascript
// Frontend код автоматически добавит /api префикс
fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [...] })
})
// Реальный запрос: https://lawyer.windexs.ru/api/chat
// Nginx proxy: http://localhost:1041/chat
```

## Конфигурация

### Vite (vite.config.ts)
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:1041',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}
```

### Nginx (nginx.conf)
```nginx
location /api/ {
    rewrite ^/api/(.*) /$1 break;
    proxy_pass http://localhost:1041;
    # ... другие настройки proxy
}
```

### Frontend (src/config/constants.ts)
```typescript
const getAPIBaseURL = (): string => {
  if (import.meta.env.DEV) {
    return '/api'; // Development: Vite proxy
  }
  if (import.meta.env.PROD) {
    return '/api'; // Production: Nginx proxy
  }
  return '/api';
};
```

## Проверка работы

### Development
```bash
# Проверка API напрямую
curl http://localhost:1041/health

# Проверка через Vite proxy
curl http://localhost:3001/api/health
```

### Production
```bash
# Проверка API напрямую (на сервере)
curl http://localhost:1041/health

# Проверка через Nginx
curl https://lawyer.windexs.ru/api/health
```

## Troubleshooting

### API не отвечает
1. Проверьте, что API сервер запущен:
   ```bash
   pm2 status
   pm2 logs galina-api
   ```

2. Проверьте порт 1041:
   ```bash
   netstat -tlnp | grep 1041
   ```

3. Проверьте Nginx конфигурацию:
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

### CORS ошибки
- В development: Vite proxy автоматически обрабатывает CORS
- В production: API сервер настроен на разрешение запросов с lawyer.windexs.ru

### 404 на API запросы
- Убедитесь, что Nginx конфигурация применена:
  ```bash
  sudo systemctl reload nginx
  ```
- Проверьте логи Nginx:
  ```bash
  sudo tail -f /var/log/nginx/lawyer.windexs.ru.error.log
  ```
