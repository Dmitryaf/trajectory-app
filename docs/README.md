# Документация проекта

Эта страница — единая точка входа во внутреннюю документацию. Документы сгруппированы по назначению, чтобы правила продукта, текущие планы, эксплуатационные инструкции и исторические аудиты не смешивались в одном списке.

## С чего начать

- [OWNER_GUIDE.md](./OWNER_GUIDE.md) — подробная карта экранов, каталогов, потоков данных, архитектурных решений и выпуска для владельца.
- [BACKLOG.md](./planning/BACKLOG.md) — текущие приоритеты и незавершённая работа.
- [PRODUCT_RULES.md](./product/PRODUCT_RULES.md) — обязательные продуктовые ограничения и язык выводов.
- [ARCHITECTURE.md](./development/ARCHITECTURE.md) — границы модулей и устройство приложения.
- [DELIVERY.md](./operations/DELIVERY.md) — ветки, проверки, окружения и выпуск релизов.
- [AGENTS.md](./AGENTS.md) — правила работы AI-агента в репозитории.

## Разделы

### `product/` — продукт и данные

- [PRODUCT_RULES.md](./product/PRODUCT_RULES.md) — назначение продукта и ограничения развития.
- [ANALYTICS_DATA_CONTRACT.md](./product/ANALYTICS_DATA_CONTRACT.md) — семантика данных и аналитических состояний.
- [CONTEXT_FACTORS.md](./product/CONTEXT_FACTORS.md) — модель контекстных факторов.
- [BLOCK_CONSTRUCTOR.md](./product/BLOCK_CONSTRUCTOR.md) — ограничения будущего конструктора блоков.

### `development/` — устройство кода

- [ARCHITECTURE.md](./development/ARCHITECTURE.md) — архитектурные границы и зависимости.

### `operations/` — эксплуатация и выпуск

- [DELIVERY.md](./operations/DELIVERY.md) — Git-процесс, CI, staging, production и hotfix.
- [BETA_RELEASE.md](./operations/BETA_RELEASE.md) — проверка готовности закрытой беты.
- [PWA_INSTALLATION.md](./operations/PWA_INSTALLATION.md) — установка и ручная матрица мобильной PWA на staging.
- [MANUAL_REGRESSION.md](./operations/MANUAL_REGRESSION.md) — сквозной ручной regression-чеклист для компьютера, мобильных браузеров и установленной PWA.
- [BACKEND_AUTH_CI.md](./operations/BACKEND_AUTH_CI.md) — настройка backend, авторизации и CI.
- [DATA_GOVERNANCE.md](./operations/DATA_GOVERNANCE.md) — работа с пользовательскими данными.
- [HOSTING_MIGRATION.md](./operations/HOSTING_MIGRATION.md) — перенос хостинга.
- [PUBLIC_REPOSITORY.md](./operations/PUBLIC_REPOSITORY.md) — граница между внутренними и публичными материалами.

### `planning/` — текущая работа

- [BACKLOG.md](./planning/BACKLOG.md) — единый актуальный бэклог.
- [BETA_NOTES_2026-07-30.md](./planning/BETA_NOTES_2026-07-30.md) — разбор заметок первой недели беты.
- [FIRST_USE_STRATEGY.md](./planning/FIRST_USE_STRATEGY.md) — подтверждённая аудитория, обещание и сценарий первого полезного результата.

### `audits/` — датированные снимки состояния

- [2026-08-08-new-user-review.md](./audits/2026-08-08-new-user-review.md) — независимое ревью первого пользовательского сценария.
- [2026-07-30-git-state.md](./audits/2026-07-30-git-state.md) — датированный аудит Git на момент переработки документации.
- [SYSTEM_AUDIT_2026-07-22.md](./audits/SYSTEM_AUDIT_2026-07-22.md) — системный аудит на указанную дату.
- [DAILY_ENTRY_AUDIT.md](./audits/DAILY_ENTRY_AUDIT.md) — аудит ежедневной записи.
- [DESIGN_AUDIT.md](./audits/DESIGN_AUDIT.md) — аудит интерфейса.
- [UI_COPY_AUDIT.md](./audits/UI_COPY_AUDIT.md) — аудит текстов интерфейса.

### `agent/` — рабочие инструкции AI-агенту

Начальная страница раздела — [agent/README.md](./agent/README.md). Эти документы задают процесс изменений и критерии качества, но не заменяют продуктовые правила и архитектурные ограничения.

## Правила размещения

- В корне `docs/` остаются эта навигация, `AGENTS.md` и устойчивое руководство владельца.
- Долгоживущие правила относятся к `product/`, `development/` или `operations/`.
- Текущие планы и разборы незавершённой работы относятся к `planning/`.
- Датированный аудит фиксирует прошлое состояние и после исправлений не превращается в актуальный бэклог.
- Новый документ добавляется в этот индекс, только если он остаётся полезным как самостоятельный источник.
