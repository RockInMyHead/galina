# 🔗 API Routes Configuration

## Архитектура

```
Frontend (https://lawyer.windexs.ru:1041)
    ↓
    /api/* запросы
    ↓
Nginx (lawyer.windexs.ru:1041)
    ↓
    Проксирует на https://lawyer.windexs.ru:1042
    ↓
API Server (https://lawyer.windexs.ru:1042)
```

## Маршрутизация

### Production (lawyer.windexs.ru)
- **Frontend**: `https://lawyer.windexs.ru:1041/` → Статические файлы из `/home/sve/galina/frontend/`
- **API**: `https://lawyer.windexs.ru:1041/api/*` → Проксируется на `https://lawyer.windexs.ru:1042/*`

## API Endpoints

Все запросы к API должны начинаться с `/api/`:

### Chat
- `POST /api/chat` → `https://lawyer.windexs.ru:1042/chat`

### Text-to-Speech
- `POST /api/tts` → `https://lawyer.windexs.ru:1042/tts`

### Speech-to-Text
- `POST /api/stt` → `https://lawyer.windexs.ru:1042/stt`
- `POST /api/stt/raw` → `https://lawyer.windexs.ru:1042/stt/raw`

### Health Check
- `GET /api/health` → `https://lawyer.windexs.ru:1042/health`

### User
- `GET /api/user/profile` → `https://lawyer.windexs.ru:1042/user/profile`

### Files
- `GET /api/files` → `https://lawyer.windexs.ru:1042/files`
- `POST /api/files/upload` → `https://lawyer.windexs.ru:1042/files/upload`
- `DELETE /api/files/:fileId` → `https://lawyer.windexs.ru:1042/files/:fileId`

### Chat History
- `GET /api/chat/history` → `https://lawyer.windexs.ru:1042/chat/history`
- `POST /api/chat/message` → `https://lawyer.windexs.ru:1042/chat/message`
- `DELETE /api/chat/history` → `https://lawyer.windexs.ru:1042/chat/history`

### Statistics
- `GET /api/stats` → `https://lawyer.windexs.ru:1042/stats`

### Court Cases Search
- `POST /api/search-court-cases` → `https://lawyer.windexs.ru:1042/search-court-cases`

## Примеры запросов

### Production
```javascript
// Frontend код автоматически добавит /api префикс
fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [...] })
})
// Реальный запрос: https://lawyer.windexs.ru:1041/api/chat
// Nginx proxy: https://lawyer.windexs.ru:1042/chat
```

## Конфигурация

### Vite (vite.config.ts)
```typescript
proxy: {
  '/api': {
    target: 'https://lawyer.windexs.ru:1041',
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}
```

### Nginx (nginx.conf)
```nginx
location /api/ {
    rewrite ^/api/(.*) /$1 break;
    proxy_pass https://lawyer.windexs.ru:1042;
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
# Проверка API напрямую (на сервере)
curl https://lawyer.windexs.ru:1042/health

# Проверка через Nginx
curl https://lawyer.windexs.ru:1041/api/health
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
