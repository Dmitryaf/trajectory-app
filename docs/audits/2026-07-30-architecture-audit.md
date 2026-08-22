# Архитектурный аудит

Дата проверки: 30 июля 2026 года.

Аудит описывает состояние commit `d9ee30e` в ветке `fix/beta-readiness`. На этом этапе код, публичные интерфейсы, данные, конфигурация и зависимости не изменялись.

## 1. Итог

**Архитектурный рефакторинг не требуется.**
**Кодовая база достаточно понятна и пригодна для дальнейшей разработки.**

Проект не следует одному строгому шаблону, но его фактическая структура предсказуема:

- страницы собирают пользовательские сценарии;
- чистые расчёты постепенно выделены в `features`;
- единственный app store владеет runtime-состоянием и локальным persistence;
- IndexedDB доступна только через store;
- Supabase изолирован клиентским service и серверной Edge Function;
- backup нормализуется до начала транзакции замены данных;
- аналитика в основном отделена от Vue, браузера и сети;
- статических циклов импортов не найдено.

Широкое перемещение файлов, дробление `types.ts`, новый repository-слой или переход на формальную feature-sliced architecture не дадут соразмерной пользы.

Подтверждены две архитектурные проблемы категории A:

1. фоновая облачная сверка может заменить store при уже смонтированных локальных draft-формах;
2. один API `syncCloudSnapshot()` одновременно обслуживает фоновую и явную синхронизацию, но скрывает ошибку от ручного действия.

Обе проблемы локализованы в облачном сценарии. Их следует исправлять узко, не перестраивая приложение целиком.

Сильные стороны:

- опасные границы данных имеют нормализаторы и миграционные тесты;
- ежедневная запись разделена на чистую модель и Vue-composable;
- аналитические вычисления тестируются без компонентов и ECharts;
- startup sync допускает подмену сервисов в тестах;
- browser-specific экспорт отделён от построения пакета;
- auth store не содержит service role и не удаляет локальные данные до подтверждённого серверного успеха;
- имена основных функций отражают пользовательские действия.

## 2. Фактическая архитектура

### 2.1. Верхнеуровневая схема

Фактическая схема является графом, а не строгой линейной цепочкой:

```text
src/main.ts
  → src/App.vue
  → lazy views

views
  → reusable components
  → scenario features/composables
  → app/auth stores
  → shared services
  → runtime types

features
  → other feature modules внутри одного сценария
  → shared services and types
  → store только в координирующих composable/sync-модулях

app store
  → Dexie database
  → backup normalizer
  → cloud service
  → auth store для текущего user id

auth store
  → cloud/auth service

db
  → runtime types

browser boundary
  → main/App, export/browser, cloudSync, UI components

server boundary
  → api/feedback.ts
  → supabase/functions/delete-account/index.ts
```

Проверка статических относительных импортов дала:

- циклические зависимости: `0`;
- неразрешённые относительные импорты: `0`;
- прямые импорты `src/db.ts`: только `src/stores/app.ts`;
- прямой импорт `src/services/cloudSync.ts` из UI: только `src/views/SettingsView.vue`;
- нижние уровни не импортируют views или components.

### 2.2. Ответственность директорий

#### `views`

Страницы собирают данные store, feature-функции и компоненты. Большие `TodayView.vue`, `MonthView.vue`, `TrendsView.vue` и `SettingsView.vue` сами по себе не доказывают проблему: первые три преимущественно собирают один экран и делегируют расчёты. `SettingsView.vue` содержит несколько сценариев, но подтверждённый ущерб относится только к облачным действиям и единообразию записи, а не ко всему файлу.

#### `components`

Переиспользуемые компоненты в основном не содержат продуктовой логики. Исключения оправданы ролью адаптера интерфейса: `AuthGate.vue` вызывает auth store, `FeedbackDialog.vue` вызывает feedback service, а `DurationInput.vue` использует чистый formatter.

#### `features`

В каталоге находятся как чистые доменные вычисления, так и Vue-composables законченных сценариев. Это два понятных вида feature-модулей, а не случайная свалка:

- чистые: analytics, backup normalization, daily-entry model, experiment model, export report;
- координирующие: daily-entry composable, journal composable, startup/resume sync;
- browser adapter: export/browser.

Чистые analytics-модули не зависят от Vue, IndexedDB, браузера или Supabase.

#### `stores`

`app.ts` хранит runtime-состояние, выполняет IndexedDB-операции и запускает cloud snapshot. Для одного локального агрегата это допустимо. Проблема возникает не из-за количества обязанностей, а в одной конкретной неоднозначности API ручной и фоновой синхронизации.

`auth.ts` координирует auth lifecycle и переводит ошибки service в пользовательское состояние. Он не владеет IndexedDB и не использует административные ключи.

#### `services`

В каталоге находятся общие utilities и внешние адаптеры. Названия различают роли достаточно явно. `services/analytics.ts` является документированным compatibility-фасадом над выделенными feature-модулями; это временная неоднородность импортов, но не текущая архитектурная поломка.

#### Модель и база

`types.ts` содержит связанные runtime-типы, defaults, options и нормализаторы. Разделы велики, но изменение данных действительно требует видеть их совместно. `db.ts` остаётся маленькой изолированной границей Dexie.

#### Browser и server-side код

- browser-only операции экспорта находятся в `features/export/browser.ts`;
- lifecycle браузера находится в `main.ts`, `App.vue` и composables;
- Supabase browser client находится в `services/cloudSync.ts`;
- Vercel feedback handler не импортируется клиентским bundle;
- service role используется только в Supabase Edge Function удаления аккаунта.

### 2.3. Основные источники истины

| Данные | Источник истины во время работы | Постоянное хранение |
|---|---|---|
| Записи, итоги, события, обзоры, настройки | `useAppStore()` | IndexedDB через `src/db.ts` |
| Текущая auth session | `useAuthStore()` | Supabase auth client storage |
| Облачная копия | полный `ExportPayload` | `trajectory_snapshots.payload` |
| Метаданные sync/conflict | `cloudSyncStatus` и per-user meta | Pinia + `localStorage` |
| Draft дневной записи | `useDailyEntryForm()` | не хранится до save |
| Draft настроек | reactive copy в `SettingsView.vue` | не хранится до save |

Последние два локальных draft являются сознательными временными источниками состояния. Именно отсутствие договора между ними и фоновым импортом создаёт главную проблему аудита.

### 2.4. Прослеженные пользовательские сценарии

| Сценарий | Основная цепочка | Оценка понятности | Проверки |
|---|---|---|---|
| Запуск | `main.ts` → `App.vue` → auth store → app store/load → startup sync → router view | Названия и порядок ясны; проблема только в повторном использовании startup reconcile после монтирования | `auth-store`, `sync-startup`, `sync-resume`, deployment |
| Дневная запись | `TodayView` → `useDailyEntryForm` → daily model → app store → Dexie → background sync | Хорошая вертикальная граница, локальная ошибка и dirty-state видимы | daily model, view scenarios, backup import, E2E |
| Настройки | `SettingsView` → settings/experiment helpers → app store → Dexie → background sync | Основные действия находятся по тексту экрана; файл смешивает несколько настроечных сценариев, но локальная работа остаётся возможной | settings migration, view scenarios |
| Недельная/месячная аналитика | view → `services/analytics`/analytics features → store arrays → computed UI | Чистые расчёты хорошо отделены; compatibility-фасад добавляет один переход | analytics, experiment, weight, view scenarios |
| Экспорт/импорт | view → export browser/report или backup snapshot → app store → Dexie/cloud | Чётко разделены построение пакета, browser API и нормализация внешнего JSON | analytics, backup import, export E2E |
| Cloud sync | App/settings → resume/startup feature → app store → cloud service → Supabase | На старте понятен и тестируем; при resume и ручном push контракт неоднозначен | startup/resume/store tests, но два риска не покрыты |
| Вход/выход/удаление | AuthGate/Settings/App → auth store → cloud service → Edge Function → app store cleanup | Клиентская цепочка ясна и fail-closed; server handler тестируется слабее остальных границ | auth store, view scenarios, deployment source checks |

## 3. Подтверждённые архитектурные проблемы

### A1. Resume-сверка может заменить store за спиной смонтированного draft

- **Уровень:** высокий.
- **Затронутые файлы:** `src/App.vue`, `src/features/sync/resume.ts`, `src/features/sync/startup.ts`, `src/stores/app.ts`, `src/features/daily-entry/useDailyEntryForm.ts`, `src/views/SettingsView.vue`, `tests/sync-resume.test.ts`, `tests/sync-startup.test.ts`, `tests/view-scenarios.test.ts`.

#### Фактическое поведение

`App.vue` вызывает один и тот же `reconcileCloudSnapshotOnStartup()` как до первого показа `RouterView`, так и после `focus`, `visibilitychange` или `online`. Если известная cloud revision изменилась и локальная meta не содержит pending/conflict, функция вызывает `store.importData()` и полностью заменяет IndexedDB и массивы store.

При первом запуске это безопасно: страницы ещё не показаны. При resume страницы уже смонтированы:

- `useDailyEntryForm()` загружает `form` только при изменении `selectedDate` и не наблюдает замену `store.dailyEntries`;
- `SettingsView.vue` создаёт `settings = reactive(plainCopy(store.settings))` один раз и не наблюдает внешнюю замену `store.settings`.

История подтверждает происхождение: startup reconciliation была выделена раньше, а commit `2043b61` позже повторно использовал её для resume без отдельного контракта для активных draft.

#### Почему это проблема

Store и IndexedDB уже содержат более свежую облачную копию, а экран продолжает показывать старый draft. Следующее сохранение может записать старые значения поверх свежих данных и отправить их обратно в облако. Даже без сохранения пользователь видит устаревшие данные до повторного открытия страницы или перезагрузки.

#### Страдающий сценарий

1. Пользователь оставляет «Сегодня» открытым на устройстве A.
2. На устройстве B изменяет запись за тот же день.
3. Возвращается во вкладку A.
4. Resume-сверка импортирует cloud snapshot в store.
5. Форма A остаётся со старой локальной копией.
6. Пользователь сохраняет форму и перезаписывает более свежую запись.

Аналогичный риск существует для открытых настроек.

#### Минимальное исправление

Разделить режимы reconcile:

- startup до монтирования может автоматически импортировать безопасно более свежую cloud revision;
- resume при изменившейся remote revision не импортирует автоматически, а переводит sync в `conflict`/`remote-update-available` и предлагает явное действие.

Это сохраняет текущие draft и не требует глобального реестра форм. После явного подтверждения уже существующий manual restore обновляет локальную копию настроек.

Более крупный вариант с общей revision-системой draft нужен только если позже появятся автоматические live-обновления или несколько одновременно редактируемых экранов.

#### Риски исправления

- нельзя превратить каждое обычное возвращение во вкладку в ложный conflict;
- pending local changes должны по-прежнему отправляться, если cloud revision известна и не менялась;
- `online` retry должен сохранять текущую throttle/coalescing-семантику.

#### Необходимые тесты

- resume с новой cloud revision не вызывает `store.importData()`;
- startup с теми же метаданными продолжает импортировать до монтирования;
- открытый dirty daily draft не заменяется при resume;
- pending local revision отправляется при совпадающем cloud timestamp;
- явное восстановление cloud snapshot по-прежнему обновляет store и локальный settings draft.

#### Документация и размер

- Обновить `OWNER_GUIDE.md` и `ARCHITECTURE.md`: startup и resume имеют разные правила auto-import.
- Ожидаемый diff минимального решения: примерно 50–100 строк кода и тестов.

### A2. API синхронизации не различает фоновое сохранение и явную команду пользователя

- **Уровень:** высокий.
- **Затронутые файлы:** `src/stores/app.ts`, `src/views/SettingsView.vue`, `src/features/sync/startup.ts`, `tests/cloud-sync-store.test.ts`, `tests/view-scenarios.test.ts`.

#### Фактическое поведение

`syncCloudSnapshot()` специально перехватывает сетевую ошибку, переводит store в `pending` и завершает Promise без исключения. Это правильно для фонового `void this.syncCloudSnapshot()` после локального save: локальное действие уже успешно и не должно становиться ошибкой из-за сети.

Та же функция используется кнопкой `saveBackupToCloud()` как явная команда. `SettingsView.vue` ждёт Promise, затем без проверки статуса показывает `Локальная версия сохранена в облако`. При сетевой ошибке Promise успешно завершается, поэтому `runCloudAction()` не попадает в `catch`, хотя cloud snapshot не сохранён.

#### Почему это проблема

Публичный API store имеет разные ожидаемые семантики для двух вызывающих сторон, но не выражает их типом, результатом или именем. Пользователь получает ложное подтверждение существования резервной копии. Это уже фактический дефект, вызванный архитектурной неоднозначностью побочного эффекта.

#### Страдающий сценарий

Пользователь перед очисткой данных нажимает «Сохранить в облако» при недоступной сети, видит сообщение об успехе и продолжает удаление, полагая, что backup создан.

#### Минимальное исправление

Сохранить фоновые вызовы без исключения, но сделать результат явным, например:

```text
syncCloudSnapshot() → { status: 'synced' | 'pending' | 'disabled', updatedAt?, error? }
```

`saveBackupToCloud()` показывает success только для `synced`; `pending` и `disabled` дают соответствующее предупреждение. Альтернатива — отдельная explicit-команда, которая выбрасывает ошибку, но общий структурированный результат меньше дублирует sync-логику.

Больший слой repository или event bus для этого не нужен.

#### Риски исправления

- нельзя сделать фоновые local saves ошибочными из-за сети;
- очередь повторной синхронизации должна сохранить поведение;
- startup upload и manual push должны одинаково обновлять meta и store status.

#### Необходимые тесты

- store возвращает `synced` после успешного upload;
- store возвращает `pending` после сетевой ошибки и не теряет local data;
- ручная кнопка не показывает success при `pending` или `disabled`;
- два вызова во время `syncing` по-прежнему отправляют актуальный последний snapshot.

#### Документация и размер

- В `OWNER_GUIDE.md` уточнить различие local save и подтверждённого cloud backup.
- Ожидаемый diff: примерно 60–120 строк кода и тестов.

## 4. Локальные проблемы качества

### B1. Правило внешнего карьерного действия продублировано в пяти потребителях

- **Уровень:** средний.
- **Затронутые файлы:** `TodayView.vue`, `WeekView.vue`, `MonthView.vue`, `TrendsView.vue`, `features/export/report.ts`, `types.ts` или новый узкий analytics helper, связанные analytics-тесты.
- **Текущее поведение:** каждый потребитель самостоятельно объединяет built-in `external`, `interview`, `result` и custom options с `countsAsExternal`.
- **Почему проблема:** одно доменное определение имеет пять точек изменения. Сейчас реализации совпадают, но новый built-in тип или изменение правила может разойтись между экраном и экспортом.
- **Пример:** недельная сводка может считать новую категорию внешней, а AI-пакет — нет.
- **Минимальное исправление:** одна чистая функция `externalCareerIdsForOptions/settings`, используемая всеми потребителями.
- **Более крупный вариант:** не нужен; перенос всех option helpers в отдельный registry не обоснован.
- **Риски:** сохранить legacy/custom ids и не изменить текущие показатели.
- **Тесты:** built-in ids, custom `countsAsExternal`, одинаковый результат summary и export.
- **Документация:** архитектурное описание не требует изменения; при желании указать helper в аналитическом срезе.
- **Размер diff:** 30–70 строк.

### B2. Состояния записи и обработка ошибок непоследовательны между экранами

- **Уровень:** средний.
- **Затронутые файлы:** `SettingsView.vue`, `WeekView.vue`, `MonthView.vue`, частично remove-действия `ResultsView.vue` и `EventsView.vue`, `tests/view-scenarios.test.ts`.
- **Текущее поведение:** дневная запись, результаты и события используют `saving`, `try/catch/finally` и понятное уведомление. Сохранение настроек и обзоров не блокирует повторный вызов и не ловит ошибку IndexedDB. Некоторые удаления также не показывают ошибку.
- **Почему проблема:** последствия одинакового вида write-команд зависят от страницы. Двойной клик может создать лишние sync-запросы, а ошибка IndexedDB превращается в необработанный rejection без понятного состояния.
- **Пример:** `saveSettings()` отклоняет Promise; локальный draft остаётся изменённым, store не обновлён, а пользователь не получает объяснения и может считать настройки сохранёнными.
- **Минимальное исправление:** добавить локальные `saving`/`try-catch-finally` в конкретные write-сценарии. Общий composable создавать только если после двух реализаций действительно останется одинаковый контракт.
- **Более крупный вариант:** единая command framework не нужна.
- **Риски:** не блокировать независимые кнопки всей страницы одним глобальным loading.
- **Тесты:** rejection persistence, повторный клик во время save, retry после ошибки.
- **Документация:** не требуется, если публичные контракты не меняются.
- **Размер diff:** 80–160 строк по нескольким локальным блокам.

### B3. Ручное применение cloud snapshot дублирует переход состояния startup sync

- **Уровень:** средний.
- **Затронутые файлы:** `SettingsView.vue`, `features/sync/startup.ts`, возможный `features/sync/snapshot.ts`, `tests/sync-startup.test.ts`, `tests/view-scenarios.test.ts`.
- **Текущее поведение:** private `importCloudSnapshot()` и `restoreBackupFromCloud()` оба выполняют `store.importData(..., syncCloud: false)`, отмечают cloud revision как synced и выставляют сообщение store. Вторая реализация напрямую импортирует `loadCloudSnapshot` и `markCloudSyncSynced` в view.
- **Почему проблема:** один переход данных и meta имеет две реализации; manual restore не имеет сценарного теста. При следующем изменении sync meta они могут разойтись.
- **Пример:** добавление нового поля sync meta будет легко внести в startup и забыть в Settings.
- **Минимальное исправление:** выделить одну функцию применения уже загруженного cloud snapshot; подтверждение и UI-уведомление оставить в view.
- **Более крупный вариант:** перенос всей Settings page в feature не нужен.
- **Риски:** не убрать пользовательское подтверждение и обновление локального settings draft после явного restore.
- **Тесты:** manual restore success, cancel, invalid snapshot, meta update.
- **Документация:** уточнить единую границу cloud snapshot в `ARCHITECTURE.md`.
- **Размер diff:** 50–100 строк.

### B4. Destructive server handler защищён главным образом тестом текста исходника

- **Уровень:** средний.
- **Затронутые файлы:** `supabase/functions/delete-account/index.ts`, `tests/deployment.test.ts`, новый тест server handler.
- **Текущее поведение:** клиентский lifecycle удаления тестируется через mocks, а deployment test проверяет наличие строк `auth.getUser(accessToken)` и `auth.admin.deleteUser(user.id)`. Сам handler с ответами `401/400/503/500/200` не выполняется в unit-тесте.
- **Почему проблема:** строковая проверка может пройти при нарушенном control flow. Это security-sensitive и destructive граница, для которой текущий тест слабее теста Vercel feedback handler.
- **Пример:** рефакторинг оставляет ожидаемые строки в недостижимой ветке, но меняет идентификатор или последовательность проверки и удаления.
- **Минимальное исправление:** отделить handler с инъекцией auth/admin clients от тонкого `Deno.serve` adapter и тестировать HTTP-ветки без реального Supabase.
- **Более крупный вариант:** общий server framework не нужен.
- **Риски:** сохранить Deno/npm imports и фактическую конфигурацию Supabase Edge Function.
- **Тесты:** missing token, invalid confirmation, invalid JWT, missing env, admin failure, удаление только `user.id` из проверенного token.
- **Документация:** при неизменном API обновление не требуется.
- **Размер diff:** 100–180 строк, в основном тесты.

## 5. Допустимые компромиссы

### C1. Один app store для локального агрегата

Store сочетает состояние, Dexie persistence и запуск snapshot sync. Для текущего объёма и одного полного cloud snapshot это уменьшает число переходов и оставляет единый write-path. Выделять repositories по каждой таблице сейчас не нужно. Исправить следует только контракт явной синхронизации из A2.

### C2. Общий `types.ts`

Файл велик, но типы, defaults и нормализаторы образуют один контракт совместимости. Тесты миграций защищают его лучше, чем механическое дробление на много файлов. Разделение оправдано только вместе с реальным новым data aggregate, а не по числу строк.

### C3. Прямые импорты stores и services из views

Views являются composition boundary. Они не обращаются к Dexie напрямую, а чистая логика вынесена из наиболее рискованных сценариев. Дополнительный controller для каждого экрана увеличил бы навигацию без подтверждённой пользы.

### C4. Compatibility-фасад `services/analytics.ts`

Фасад создаёт два допустимых import path, но его временная роль явно описана, циклов нет, файл добавляет общие подписи и старые экраны остаются стабильны. Удалять его отдельным массовым рефакторингом не нужно; импорты можно переводить при содержательном изменении конкретного экрана.

### C5. История экспериментов внутри `AppSettings`

При одном активном эксперименте и небольшом массиве завершённых записей отдельная таблица добавит migration, backup и sync-сложность без текущей пользы. Документация правильно задаёт условие пересмотра: параллельные эксперименты или самостоятельное редактирование большой истории.

## 6. Неподтверждённые улучшения

### D1. Разделить все крупные views

Количество строк показывает стоимость чтения, но не доказывает смешанную ответственность. `MonthView` и `TrendsView` собирают один экран, а расчёты вынесены. `SettingsView` следует дробить только по мере исправления подтверждённых cloud/write-сценариев, не массово.

### D2. Ввести строгие слои, repositories и dependency injection повсюду

Нет циклов, UI не обходит store к базе, а внешние границы уже подменяются там, где риск это оправдывает. Универсальный DI/container увеличит число файлов и переходов без текущего сценария.

### D3. Добавить ESLint как архитектурную меру

ESLint-конфигурации и script сейчас нет. Это может быть отдельным улучшением quality tooling, но аудит не обнаружил архитектурный дефект, который lint гарантированно предотвратит. Не включать в архитектурный план без конкретного набора нужных правил.

## 7. Проверка документации

### Что соответствует коду

- `ARCHITECTURE.md` правдиво описывает постепенные вертикальные срезы, а не обещает завершённую миграцию.
- Границы daily-entry model/composable, backup normalization, export browser/report и analytics features совпадают с импортами.
- Утверждение о единственной Dexie-границе через store подтверждено.
- Модель experiment history внутри settings соответствует коду и backup.
- `OWNER_GUIDE.md` правильно описывает startup, daily save, import и weekly summary.

### Что требует уточнения после исправлений

1. Линейная схема `views/components → features → stores` в `OWNER_GUIDE.md` выглядит как строгая зависимость, хотя фактически views также напрямую используют stores, services и types. Следует назвать её потоком данных, а не картой импортов.
2. `ARCHITECTURE.md` описывает startup sync, но не фиксирует, что тот же reconcile вызывается при resume. После A1 нужно документировать разные правила автоматического применения cloud snapshot.
3. Документация говорит, что файл пользователя и облачная копия проходят единый путь нормализации — это верно, но переход `import + markSynced + UI status` сейчас продублирован. После B3 следует указать единый feature API.

Эти расхождения не требуют немедленного отдельного документационного рефакторинга: документацию нужно обновлять вместе с соответствующим исправлением поведения.

## 8. Рекомендуемый план

План содержит только подтверждённые задачи.

1. **Безопасность данных:** разделить startup и resume policy применения более свежего cloud snapshot; на resume не заменять смонтированные draft автоматически.
2. **Корректность backup:** вернуть явный результат `syncCloudSnapshot()` и прекратить показывать success при `pending`/`disabled`.
3. **Единая cloud-граница:** использовать одну функцию применения cloud snapshot для startup и ручного restore.
4. **Тестируемость destructive boundary:** сделать delete-account handler исполняемым с подменными зависимостями и проверить HTTP/control-flow.
5. **Понятность write-сценариев:** локально выровнять loading/error/retry для настроек и обзоров.
6. **Локальная навигация:** централизовать правило `externalCareerIds` без расширения общего architecture layer.
7. **Документация:** обновить `OWNER_GUIDE.md` и `ARCHITECTURE.md` только после изменения фактических контрактов.

Каждый пункт должен быть отдельным изменением с собственными тестами. Пункты 1–3 относятся к одному cloud-направлению, но их не следует смешивать с UI-полировкой, моделью данных или Supabase migration.

## 9. Что не нужно рефакторить

- общую структуру `views/components/features/stores/services`;
- `src/types.ts` только из-за размера;
- `src/stores/app.ts` на repositories по каждой таблице;
- чистые analytics-модули;
- разделение export report и browser adapter;
- daily-entry model/composable;
- backup snapshot normalizer и транзакцию import;
- auth store и client cloud service;
- модель IndexedDB и версии backup;
- cloud snapshot schema, Supabase table и RLS;
- экспериментальную историю внутри settings;
- reusable UI components;
- все большие страницы одновременно;
- compatibility analytics facade отдельным массовым commit.

## 10. Проверенные файлы и команды

### Документация и конфигурация

- `docs/AGENTS.md`;
- `docs/OWNER_GUIDE.md`;
- `docs/development/ARCHITECTURE.md`;
- `docs/product/PRODUCT_RULES.md`;
- `docs/product/ANALYTICS_DATA_CONTRACT.md`;
- `docs/operations/DATA_GOVERNANCE.md`;
- `docs/agent/WORKFLOW.md`;
- `docs/agent/QUALITY.md`;
- `package.json`;
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`;
- `vite.config.ts`, `playwright.config.ts`, `vercel.json`;
- `.github/workflows/ci.yml` и PR template.

Отдельной ESLint-конфигурации в репозитории нет. Vitest использует Vite-конфигурацию и настройки в тестовых файлах; отдельного `vitest.config.*` нет.

### Код

Проверены все файлы `src/` на размер и относительные импорты. Детально прочитаны границы запуска, stores, types/normalization, Dexie, daily entry, settings, analytics, export/backup, sync, auth, feedback и delete-account Edge Function.

### Тесты

Просмотрены unit/integration/component/E2E-сценарии в `tests/` и `e2e/`. Выполнено:

```text
npm.cmd test
```

Результат: `18` test files, `122` tests passed.

### Диагностические команды

```text
rg --files
rg -n <imports, functions and usages>
git log --oneline -- <sync and draft files>
git blame <startup and resume ranges>
git status --short
```

Дополнительно построен read-only граф относительных импортов TypeScript/Vue с разрешением `.ts`, `.vue` и `index` modules. Результат: `0` cycles и `0` unresolved relative imports.
