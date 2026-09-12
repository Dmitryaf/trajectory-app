## Что изменено

Кратко опиши пользовательский или технический результат.

## Как проверено

- [ ] `npm run check` для кода, конфигурации и зависимостей; для Markdown-only — формат и ссылки по [PROJECT_RULES](https://github.com/Dmitryaf/trajectory-app/blob/develop/.ai-rules/PROJECT_RULES.md)
- [ ] `npm run test:e2e`, если менялись браузерные действия, маршруты, вход или облачная сверка
- [ ] `git diff --check`
- [ ] Изменённый сценарий проверен вручную
- [ ] Для маршрутов, PWA или Vercel выполнена SPA/PWA-проверка из [DELIVERY](https://github.com/Dmitryaf/trajectory-app/blob/develop/docs/operations/DELIVERY.md)
- [ ] Миграция старых данных проверена, если менялась модель
- [ ] В diff нет секретов, личных данных и случайных файлов

## Поставка

- [ ] Обычная задача направлена в `develop`
- [ ] Release PR направлен из `develop` в `main`
- [ ] Срочный `fix/*` после production будет возвращён в `develop`
