# Миграция данных из localStorage в базу данных

Этот документ описывает процесс миграции существующих данных из localStorage в базу данных.

## Подготовка

1. **Экспорт данных из localStorage:**
   ```bash
   # В браузере откройте консоль разработчика и выполните:
   node export-local-data.js
   # Или вручную в браузерной консоли:
   const exportData = { timestamp: new Date().toISOString(), data: {} };
   Object.keys(localStorage).forEach(key => {
     if (key.startsWith('galina-')) {
       try {
         exportData.data[key] = JSON.parse(localStorage.getItem(key));
       } catch(e) {
         exportData.data[key] = localStorage.getItem(key);
       }
     }
   });
   console.log(JSON.stringify(exportData, null, 2));
   ```

2. **Сохраните экспортированные данные в файл `localStorage-export.json`**

## Миграция

1. **Запустите миграционный скрипт:**
   ```bash
   cd api
   node migrate-local-data.js ../localStorage-export.json
   ```

2. **Проверьте результаты:**
   - Скрипт выведет статистику миграции
   - Проверьте логи на наличие ошибок

## Структура данных

Скрипт мигрирует следующие данные:

- **Пользователи**: Создает демо-пользователя если не существует
- **Баланс**: Переносит баланс пользователя
- **Сообщения чата**: Переносит историю чата с файлами
- **Файлы**: Переносит прикрепленные файлы

## Обработка конфликтов

- Если данные уже существуют в БД, они не будут перезаписаны
- Скрипт пропускает существующие записи для избежания дублирования
- Все ошибки логируются и отображаются в конце выполнения

## Проверка после миграции

После успешной миграции:

1. **Проверьте API endpoints:**
   ```bash
   curl http://localhost:3003/user/profile
   curl http://localhost:3003/user/balance
   curl http://localhost:3003/chat/history
   ```

2. **Запустите приложение и проверьте синхронизацию данных**

## Откат миграции

Если необходимо откатить миграцию:

```bash
# Очистить базу данных (осторожно!)
cd api
npx prisma db push --force-reset
```

## Troubleshooting

- **Ошибка подключения к БД**: Проверьте `DATABASE_URL` в `.env`
- **Ошибка создания пользователя**: Проверьте схему Prisma
- **Пустой экспорт**: Убедитесь что приложение запущено и данные есть в localStorage
