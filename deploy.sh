#!/bin/bash

# Скрипт развертывания проекта Galina на сервер
# Использование: ./deploy.sh

set -e

echo "🚀 Начинаем развертывание проекта Galina..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Конфигурация
SERVER_USER="sve"
SERVER_HOST="77.37.146.116"
SSH_PORT="1040"
REMOTE_PATH="/home/sve/galina"
DOMAIN="lawyer.windexs.ru"
API_PORT="1041"

echo -e "${YELLOW}📋 Конфигурация развертывания:${NC}"
echo "Сервер: $SERVER_USER@$SERVER_HOST:$SSH_PORT"
echo "Путь на сервере: $REMOTE_PATH"
echo "Домен: $DOMAIN"
echo "API порт: $API_PORT"
echo ""

# Функция для выполнения команд на сервере
remote_exec() {
    ssh -p $SSH_PORT $SERVER_USER@$SERVER_HOST "$1"
}

echo -e "${GREEN}🔧 Шаг 1: Создание директорий на сервере${NC}"
remote_exec "mkdir -p $REMOTE_PATH/{frontend,api,logs,backups}"

echo -e "${GREEN}📦 Шаг 2: Копирование frontend${NC}"
echo "Копируем собранный frontend..."
rsync -avz -e "ssh -p $SSH_PORT" ./dist/ $SERVER_USER@$SERVER_HOST:$REMOTE_PATH/frontend/

echo -e "${GREEN}📦 Шаг 3: Копирование API${NC}"
echo "Копируем API сервер..."
rsync -avz -e "ssh -p $SSH_PORT" ./api/ $SERVER_USER@$SERVER_HOST:$REMOTE_PATH/api/

echo -e "${GREEN}📦 Шаг 4: Копирование конфигурационных файлов${NC}"
echo "Копируем package.json и другие конфиги..."
rsync -avz -e "ssh -p $SSH_PORT" ./package*.json $SERVER_USER@$SERVER_HOST:$REMOTE_PATH/
rsync -avz -e "ssh -p $SSH_PORT" ./.env* $SERVER_USER@$SERVER_HOST:$REMOTE_PATH/ 2>/dev/null || echo "Файлы .env не найдены, пропускаем"

echo -e "${GREEN}⚙️ Шаг 5: Установка зависимостей на сервере${NC}"
remote_exec "cd $REMOTE_PATH && npm install --production"

echo -e "${GREEN}⚙️ Шаг 6: Установка зависимостей API${NC}"
remote_exec "cd $REMOTE_PATH/api && npm install --production"

echo -e "${GREEN}🔧 Шаг 7: Настройка PM2${NC}"
echo "Создаем PM2 конфигурацию..."

# Создаем PM2 ecosystem файл
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'galina-api',
      script: './api/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: $API_PORT
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api.log'
    }
  ]
};
EOF

echo "Копируем PM2 конфигурацию на сервер..."
rsync -avz -e "ssh -p $SSH_PORT" ./ecosystem.config.js $SERVER_USER@$SERVER_HOST:$REMOTE_PATH/

echo -e "${GREEN}🌐 Шаг 8: Настройка Nginx${NC}"
echo "Создаем Nginx конфигурацию..."

# Создаем Nginx конфигурацию
cat > nginx.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Логи
    access_log /var/log/nginx/$DOMAIN.access.log;
    error_log /var/log/nginx/$DOMAIN.error.log;

    # API прокси на порт $API_PORT (должен быть первым!)
    location /api/ {
        # Убираем /api/ из пути при проксировании
        rewrite ^/api/(.*) /\$1 break;
        
        proxy_pass https://lawyer.windexs.ru:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Увеличиваем таймауты для длинных запросов
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Статические файлы frontend
    location / {
        root $REMOTE_PATH/frontend;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;

        # Кэширование статических ресурсов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Безопасность
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF

echo "Копируем Nginx конфигурацию на сервер..."
rsync -avz -e "ssh -p $SSH_PORT" ./nginx.conf $SERVER_USER@$SERVER_HOST:$REMOTE_PATH/

echo -e "${GREEN}🚀 Шаг 9: Запуск сервисов${NC}"

echo "Останавливаем старые процессы..."
remote_exec "cd $REMOTE_PATH && pm2 stop all || true"
remote_exec "cd $REMOTE_PATH && pm2 delete all || true"

echo "Запускаем API сервер..."
remote_exec "cd $REMOTE_PATH && pm2 start ecosystem.config.js"

echo "Проверяем статус..."
remote_exec "cd $REMOTE_PATH && pm2 status"

echo -e "${GREEN}✅ Развертывание завершено!${NC}"
echo ""
echo -e "${YELLOW}📋 Следующие шаги:${NC}"
echo "1. На сервере настройте Nginx:"
echo "   sudo cp $REMOTE_PATH/nginx.conf /etc/nginx/sites-available/$DOMAIN"
echo "   sudo ln -s /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "2. Проверьте работу:"
echo "   curl http://$DOMAIN"
echo "   curl http://$DOMAIN/api/health"
echo ""
echo "3. Настройте SSL (Let's Encrypt):"
echo "   sudo certbot --nginx -d $DOMAIN"
echo ""
echo -e "${GREEN}🌐 Приложение будет доступно по адресу: http://$DOMAIN${NC}"
