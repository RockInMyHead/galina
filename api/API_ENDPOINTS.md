# API Endpoints Documentation

## Base URL
- Public Gateway: `https://lawyer.windexs.ru:1041/api`
- Internal API: `https://lawyer.windexs.ru:1042`

## Important Note
**All endpoints are without `/api/` prefix.** This ensures consistent routing without duplication (e.g., `/api/api/*`).

---

## Health Check

### GET /health
Check server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-11T10:00:00.000Z",
  "database": "configured",
  "openai": "configured"
}
```

---

## AI Chat Endpoints

### POST /chat
Send a message to the AI chatbot.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful legal assistant."
    },
    {
      "role": "user",
      "content": "What is a contract?"
    }
  ],
  "model": "gpt-3.5-turbo",
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": false
}
```

**Response (non-streaming):**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1699000000,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "A contract is a legally binding agreement..."
      },
      "finish_reason": "stop"
    }
  ]
}
```

**Streaming Response:**
If `stream: true`, returns Server-Sent Events (SSE):
```
data: {"content":"A contract is"}
data: {"content":"A contract is a"}
data: {"content":"A contract is a legally"}
data: [DONE]
```

---

## Text-to-Speech

### POST /tts
Convert text to speech audio.

**Request Body:**
```json
{
  "text": "Hello, I am Galina, your AI legal assistant.",
  "voice": "alloy",
  "model": "tts-1"
}
```

**Response:** Audio file (audio/mpeg)

---

## Speech-to-Text

### POST /stt
Convert speech audio to text (multipart/form-data).

**Request (multipart/form-data):**
- `audio`: Audio file (WAV, MP3, etc.)

**Response:**
```json
{
  "success": true,
  "text": "Hello, what is a contract?"
}
```

### POST /stt/raw
Convert speech audio to text (raw binary).

**Request:** Raw audio binary data

**Response:**
```json
{
  "success": true,
  "text": "Hello, what is a contract?"
}
```

---

## Chat History

### GET /chat/history
Get user's chat history.

**Response:**
```json
{
  "messages": [
    {
      "id": "msg-123",
      "content": "Hello",
      "role": "user",
      "timestamp": "2025-11-11T10:00:00.000Z",
      "userId": "user-123",
      "files": []
    }
  ]
}
```

### POST /chat/message
Save a new chat message.

**Request Body:**
```json
{
  "content": "What is a contract?",
  "role": "user",
  "files": []
}
```

**Response:**
```json
{
  "message": {
    "id": "msg-456",
    "content": "What is a contract?",
    "role": "user",
    "timestamp": "2025-11-11T10:00:00.000Z"
  }
}
```

### DELETE /chat/history
Clear all chat history for the current user.

**Response:**
```json
{
  "success": true,
  "message": "Chat history cleared",
  "welcomeMessage": {
    "id": "msg-789",
    "content": "Здравствуйте! Я Галина...",
    "role": "assistant"
  }
}
```

---

## User Profile

### GET /user/profile
Get user profile information.

**Response:**
```json
{
  "user": {
    "id": "user-123",
    "email": "demo@galina.ai",
    "name": "Demo User",
    "balance": {
      "amount": 1000
    },
    "messages": [],
    "files": []
  }
}
```

---

## File Management

### GET /files
Get list of user's files.

**Response:**
```json
{
  "files": [
    {
      "id": "file-123",
      "name": "contract.pdf",
      "type": "application/pdf",
      "size": 102400,
      "createdAt": "2025-11-11T10:00:00.000Z"
    }
  ]
}
```

### POST /files/upload
Upload a new file.

**Request Body:**
```json
{
  "name": "contract.pdf",
  "type": "application/pdf",
  "size": 102400,
  "content": "base64-encoded-content"
}
```

**Response:**
```json
{
  "file": {
    "id": "file-456",
    "name": "contract.pdf",
    "type": "application/pdf",
    "size": 102400,
    "createdAt": "2025-11-11T10:00:00.000Z"
  }
}
```

### DELETE /files/:fileId
Delete a file.

**Response:**
```json
{
  "success": true
}
```

---

## Statistics

### GET /stats
Get user statistics.

**Response:**
```json
{
  "stats": {
    "messages": 42,
    "files": 10,
    "balance": 1000
  }
}
```

---

## Court Cases Search

### POST /search-court-cases
Search for court cases using DuckDuckGo.

**Request Body:**
```json
{
  "query": "договор купли-продажи"
}
```

**Response:**
```json
{
  "success": true,
  "query": "договор купли-продажи",
  "cases": [
    {
      "title": "Решение по делу №...",
      "court": "sudrf.ru",
      "date": "11.11.2025",
      "source": "sudrf.ru",
      "url": "https://sudrf.ru/..."
    }
  ],
  "count": 1
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

---

## Authentication

Currently, all endpoints use demo user (`demo@galina.ai`) for testing. 
Authentication will be implemented in future versions.

---

## CORS Configuration

Allowed origins:
- `https://lawyer.windexs.ru`
- `http://lawyer.windexs.ru`
- `https://lawyer.windexs.ru:1041`
- `http://lawyer.windexs.ru:1041`

---

## Rate Limiting

Not implemented yet.

---

## Deployment Notes

When deploying to platforms like Vercel:
1. Ensure environment variables are set (`DATABASE_URL`, `OPENAI_API_KEY`)
2. Configure routing to point to the API server without adding `/api/` prefix
3. Update `API_CONFIG.BASE_URL` in frontend config

Example vercel.json:
```json
{
  "rewrites": [
    {
      "source": "/chat",
      "destination": "https://your-api-server.com/chat"
    },
    {
      "source": "/tts",
      "destination": "https://your-api-server.com/tts"
    }
  ]
}
```

