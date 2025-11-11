# Development & Deployment Setup

## API Base URL Configuration

### Production URL
- **Domain:** lawyer.windexs.ru
- **Port:** 1041
- **Full URL:** https://lawyer.windexs.ru:1041

### Auto-Detection Logic

The application automatically detects the API base URL based on the environment:

1. **Environment Variable** (highest priority)
   - Set `VITE_API_BASE_URL` in `.env.production` or `.env.local`
   ```env
   VITE_API_BASE_URL=https://lawyer.windexs.ru:1041
   ```

2. **Production Mode** (if no env var)
   - Falls back to: `https://lawyer.windexs.ru:1041`

3. **Development Mode** (if no env var)
   - Falls back to: `http://localhost:1041`

## Development Setup

### 1. Install Dependencies

Frontend:
```bash
cd /Users/artembutko/Desktop/Galina
npm install
```

Backend:
```bash
cd /Users/artembutko/Desktop/Galina/api
npm install
```

### 2. Create Environment Files

**Frontend** - `.env.local`:
```env
# Optional - auto-detected for local dev
VITE_API_BASE_URL=http://localhost:1041
```

**Backend** - `api/.env`:
```env
DATABASE_URL="sqlite:./prisma/galina.db"
OPENAI_API_KEY=sk-your-key-here
PORT=1041
NODE_ENV=development
```

### 3. Run Development Servers

Backend:
```bash
cd api
npm start
# Server runs on http://localhost:1041
```

Frontend (in another terminal):
```bash
npm run dev
# Frontend runs on http://localhost:5173
# Automatically proxies API calls to http://localhost:1041
```

## Production Build

### 1. Build Frontend

```bash
npm run build
# Output: dist/
```

### 2. Build Check

```bash
# Preview production build locally
npm run preview
# Runs on http://localhost:4173
```

### 3. Environment for Production

Create `.env.production` in frontend root:

```env
VITE_API_BASE_URL=https://lawyer.windexs.ru:1041
```

Or set it during build:

```bash
VITE_API_BASE_URL=https://lawyer.windexs.ru:1041 npm run build
```

## Docker Deployment (Optional)

### Backend Dockerfile

Create `api/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 1041

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t galina-api ./api
docker run -p 1041:1041 \
  -e DATABASE_URL="sqlite:./prisma/galina.db" \
  -e OPENAI_API_KEY="sk-your-key" \
  galina-api
```

### Frontend Dockerfile

Create `Dockerfile` (root):

```dockerfile
FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_API_BASE_URL=https://lawyer.windexs.ru:1041
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install simple HTTP server to serve static files
RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
```

Build and run:

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://lawyer.windexs.ru:1041 \
  -t galina-frontend .

docker run -p 3000:3000 galina-frontend
```

## Vercel Deployment

### 1. Configure Vercel Project

In project root, create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "env": {
    "VITE_API_BASE_URL": "@api-base-url"
  }
}
```

### 2. Set Environment Variable

In Vercel Dashboard:

```
VITE_API_BASE_URL = https://lawyer.windexs.ru:1041
```

### 3. Deploy

```bash
vercel
```

## GitHub Actions CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install frontend dependencies
      run: npm install
    
    - name: Build frontend
      run: npm run build
      env:
        VITE_API_BASE_URL: https://lawyer.windexs.ru:1041
    
    - name: Deploy to server
      uses: appleboy/scp-action@master
      with:
        host: ${{ secrets.HOST }}
        port: ${{ secrets.SSH_PORT }}
        username: ${{ secrets.SSH_USER }}
        key: ${{ secrets.SSH_KEY }}
        source: "dist/*"
        target: "/home/sve/galina/frontend/dist"

    - name: Deploy backend
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.HOST }}
        port: ${{ secrets.SSH_PORT }}
        username: ${{ secrets.SSH_USER }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /home/sve/galina/api
          git pull origin main
          npm install --production
          npm run migrate
          pm2 restart galina-api
```

Add secrets to GitHub:
- `HOST`: 77.37.146.116
- `SSH_PORT`: 1040
- `SSH_USER`: sve
- `SSH_KEY`: Your private SSH key

## Testing

### 1. Health Check

```bash
# Local
curl http://localhost:1041/health

# Production
curl https://lawyer.windexs.ru:1041/health
```

### 2. API Test

```bash
# Local
curl -X POST http://localhost:1041/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"model":"gpt-3.5-turbo"}'

# Production
curl -X POST https://lawyer.windexs.ru:1041/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"model":"gpt-3.5-turbo"}'
```

### 3. Frontend Test

```bash
# Test with production API
VITE_API_BASE_URL=https://lawyer.windexs.ru:1041 npm run preview
```

## Environment Variables Reference

### Frontend (`VITE_` prefix required)

- `VITE_API_BASE_URL` - API server base URL (optional, auto-detected)

### Backend

- `DATABASE_URL` - Database connection string (default: sqlite:./prisma/galina.db)
- `OPENAI_API_KEY` - OpenAI API key (optional, demo mode works without)
- `PORT` - Server port (default: 1041)
- `NODE_ENV` - Environment (development/production)

## Troubleshooting

### "Cannot find module" errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### "Port already in use"

```bash
# Find what's using port 1041
lsof -i :1041

# Kill process
kill -9 <PID>
```

### "CORS error in production"

Check that:
1. Frontend is calling the correct API URL
2. Backend has CORS configured properly
3. Browser allows cross-origin requests

### API calls fail with "localhost:1041"

This means the environment variable `VITE_API_BASE_URL` is not set for production build.

Solution:
```bash
VITE_API_BASE_URL=https://lawyer.windexs.ru:1041 npm run build
```

## Quick Start Checklist

- [ ] Clone repository
- [ ] Install npm dependencies (frontend & backend)
- [ ] Create `.env` files with required variables
- [ ] Start backend: `cd api && npm start`
- [ ] Start frontend: `npm run dev`
- [ ] Test API: `curl http://localhost:1041/health`
- [ ] Test frontend: Open http://localhost:5173
- [ ] Build for production: `npm run build`
- [ ] Deploy to lawyer.windexs.ru

## Additional Resources

- [DEPLOY.md](./DEPLOY.md) - Full deployment guide
- [api/API_ENDPOINTS.md](./api/API_ENDPOINTS.md) - API documentation
- [api/README-API.md](./api/README-API.md) - API server setup

