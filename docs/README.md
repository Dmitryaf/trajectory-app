# Документация проекта

Маршрут для разработчиков и операторов. Читайте источник по вопросу; код и тесты уточняют реализованное поведение. При изменении контракта обновляется его документ.

| Вопрос                                                                | Источник                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| Назначение продукта, необязательность ввода, язык интерфейса          | [PRODUCT_RULES](product/PRODUCT_RULES.md)                     |
| Пропуски, знаменатели, выборка, восстановленная неделя, совместимость | [ANALYTICS_DATA_CONTRACT](product/ANALYTICS_DATA_CONTRACT.md) |
| Продуктовые события, opt-in и операторские когорты                    | [OBSERVABILITY_CONTRACT](product/OBSERVABILITY_CONTRACT.md)   |
| Устройство кода, владельцы и синхронизация                            | [ARCHITECTURE](development/ARCHITECTURE.md)                   |
| Регрессии компоновки и измерение производительности                   | [QUALITY](development/QUALITY.md)                             |
| Ветки, среды и допуск к выпуску                                       | [DELIVERY](operations/DELIVERY.md)                            |
| Настройка Supabase, регистрации и почтовых API                        | [BACKEND_AUTH_CI](operations/BACKEND_AUTH_CI.md)              |
| Хранение, доступ, удаление и восстановление данных                    | [DATA_GOVERNANCE](operations/DATA_GOVERNANCE.md)              |
| Технические ошибки и инциденты                                        | [INCIDENT_RESPONSE](operations/INCIDENT_RESPONSE.md)          |
| Сквозная ручная проверка                                              | [MANUAL_REGRESSION](operations/MANUAL_REGRESSION.md)          |
| Установка и проверка PWA на устройствах                               | [PWA_INSTALLATION](operations/PWA_INSTALLATION.md)            |
| Браузерные источники и приёмка CSP                                    | [SECURITY_HEADERS](operations/SECURITY_HEADERS.md)            |

Текущая стратегия, приоритеты и исполнимая работа находятся в [GitHub Project](https://github.com/users/Dmitryaf/projects/1) и [Issues](https://github.com/Dmitryaf/trajectory-app/issues). Project доступен его участникам. Результаты проверок сохраняются в Issue, PR или CI; прежние решения и документы доступны через Git history. Отдельный Markdown-backlog не ведётся.

Вход для coding agents — корневой [AGENTS.md](../AGENTS.md), затем AI Rules Hub и карта в [PROJECT_RULES](../.ai-rules/PROJECT_RULES.md). Общие правила разработки здесь не дублируются.
