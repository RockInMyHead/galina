# 🚀 Развертывание проекта Galina на сервере

## 📋 Обзор
Проект состоит из:
- **Frontend**: React + TypeScript приложение (собирается в статические файлы)
- **API**: Node.js Express сервер для обработки запросов к OpenAI
- **База данных**: SQLite (включается в API)

## 🔧 Подготовка сервера

### Системные требования
- Ubuntu/Debian сервер
- Node.js 16+
- PM2 для управления процессами
- Nginx для проксирования
- Git

### Установка зависимостей
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PM2 глобально
sudo npm install -g pm2

# Установка Nginx
sudo apt install nginx -y

# Установка Git
sudo apt install git -y
```

## 📦 Развертывание

### Способ 1: Автоматический (рекомендуется)

```bash
# На локальной машине
./deploy.sh
```

### Способ 2: Ручное развертывание

#### 1. Сборка проекта локально
```bash
npm run build
```

#### 2. Копирование на сервер
```bash
# Создание директорий на сервере
ssh -p 1040 sve@77.37.146.116 "mkdir -p ~/galina/{frontend,api,logs}"

# Копирование файлов
rsync -avz -e "ssh -p 1040" ./dist/ sve@77.37.146.116:~/galina/frontend/
rsync -avz -e "ssh -p 1040" ./api/ sve@77.37.146.116:~/galina/api/
rsync -avz -e "ssh -p 1040" ./package*.json sve@77.37.146.116:~/galina/
rsync -avz -e "ssh -p 1040" ./.env sve@77.37.146.116:~/galina/ 2>/dev/null || true
```

#### 3. Настройка на сервере
```bash
# Подключение к серверу
ssh -p 1040 sve@77.37.146.116

# Установка зависимостей
cd ~/galina
npm install --production
cd api && npm install --production

# Копирование конфигурационных файлов
cp ~/galina/ecosystem.config.js ~/galina/
cp ~/galina/nginx.conf ~/galina/
```

## ⚙️ Настройка сервисов

### PM2 (управление API сервером)
```bash
# На сервере
cd ~/galina
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx (веб-сервер)
```bash
# На сервере от root
sudo cp ~/galina/nginx.conf /etc/nginx/sites-available/lawyer.windexs.ru
sudo ln -s /etc/nginx/sites-available/lawyer.windexs.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔐 SSL сертификат (Let's Encrypt)

```bash
# Установка certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение сертификата
sudo certbot --nginx -d lawyer.windexs.ru

# Проверка обновления сертификатов
sudo certbot renew --dry-run
```

## 🔍 Проверка развертывания

### Проверка API
```bash
curl http://localhost:1041/health
curl https://lawyer.windexs.ru/health
```

### Проверка frontend
```bash
curl https://lawyer.windexs.ru
```

### Проверка PM2
```bash
pm2 status
pm2 logs galina-api
```

## 📊 Мониторинг

### Просмотр логов
```bash
# PM2 логи
pm2 logs galina-api

# Nginx логи
sudo tail -f /var/log/nginx/lawyer.windexs.ru.access.log
sudo tail -f /var/log/nginx/lawyer.windexs.ru.error.log
```

### Управление процессами
```bash
# Перезапуск API
pm2 restart galina-api

# Остановка всех процессов
pm2 stop all

# Просмотр статуса
pm2 monit
```

## 🔧 Обновление проекта

### Автоматическое обновление
```bash
# На локальной машине
./deploy.sh
```

### Ручное обновление
```bash
# Остановка сервисов
ssh -p 1040 sve@77.37.146.116 "pm2 stop all"

# Сборка и копирование
npm run build
rsync -avz -e "ssh -p 1040" ./dist/ sve@77.37.146.116:~/galina/frontend/
rsync -avz -e "ssh -p 1040" ./api/ sve@77.37.146.116:~/galina/api/

# Запуск сервисов
ssh -p 1040 sve@77.37.146.116 "cd ~/galina && pm2 start ecosystem.config.js"
```

## 🚨 Устранение неисправностей

### API не отвечает
```bash
# Проверка порта
netstat -tlnp | grep 1041

# Проверка PM2
pm2 status
pm2 logs galina-api --lines 50
```

### Frontend не загружается
```bash
# Проверка Nginx
sudo nginx -t
sudo systemctl status nginx

# Проверка файлов
ls -la ~/galina/frontend/
```

### Проблемы с SSL
```bash
# Проверка сертификата
sudo certbot certificates

# Обновление сертификатов
sudo certbot renew
```

## 📞 Контакты
При возникновении проблем проверьте логи и обратитесь к администратору сервера.

## ✅ Финальная проверка
После развертывания приложение будет доступно по адресу:
- **Frontend**: https://lawyer.windexs.ru
- **API**: https://lawyer.windexs.ru (проксируется на порт 1041)
