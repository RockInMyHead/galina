# ВРЕМЕННОЕ РЕШЕНИЕ ПРОБЛЕМЫ 403 Forbidden

## Проблема:
Production API сервер https://lawyer.windexs.ru/api/chat возвращает 403 Forbidden

## Временное решение:
1. Переключиться на локальный API для тестирования
2. Исправить OPENAI_API_KEY на production сервере
3. Вернуться к production API

## Шаг 1: Временное переключение на локальный API
# Изменить в .env.production:
VITE_API_BASE_URL=http://localhost:3003/api

# Или запустить в development режиме:
npm run dev

## Шаг 2: Исправление на production сервере
# Подключиться к production серверу:
ssh user@production-server

# Проверить OPENAI_API_KEY:
echo $OPENAI_API_KEY

# Если пусто, установить:
export OPENAI_API_KEY='sk-proj-your-actual-key-here'

# Перезапустить API сервер

## Шаг 3: Вернуться к production API
# После исправления на сервере, вернуть в .env.production:
VITE_API_BASE_URL=https://lawyer.windexs.ru/api

# Для временного использования локального API:
# Измените в .env.production:
# VITE_API_BASE_URL=http://localhost:3003/api
# 
# И запустите локальный сервер:
# ./start-dev.sh
