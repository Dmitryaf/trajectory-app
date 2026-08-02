<script setup lang="ts">
import { useSettingsForm } from '../features/settings/useSettingsForm';
import type { DailyBlockId, LifeAreaId } from '../types';

const {
  ChipGroup,
  experimentDecisionOptions,
  dailyBlockOptions,
  store,
  settings,
  importInput,
  newCareerLabel,
  newActivityLabel,
  newLifeAreaLabel,
  newContextFactorLabel,
  newPassword,
  newPasswordConfirmation,
  analysisStart,
  analysisEnd,
  analysisMaxDate,
  auth,
  allCareerOptions,
  activeActivityOptions,
  hiddenActivityOptions,
  allLifeAreaOptions,
  activeContextFactorOptions,
  hiddenContextFactorOptions,
  cloudSession,
  cloudUserEmail,
  cloudStatusTitle,
  cloudStatusText,
  experimentCanConclude,
  save,
  saveExperiment,
  completeExperiment,
  addCareerOption,
  addActivityOption,
  removeActivityOption,
  restoreActivityOption,
  removeCareerOption,
  addLifeArea,
  removeLifeArea,
  addContextFactor,
  removeContextFactor,
  restoreContextFactor,
  exportData,
  signOutCloud,
  changePassword,
  saveBackupToCloud,
  restoreBackupFromCloud,
  copyAnalysisPrompt,
  downloadAnalysisData,
  copyCustomAnalysisPrompt,
  downloadCustomAnalysisData,
  importData,
  clearAll,
  deleteAccount,
} = useSettingsForm();
</script>

<template>
  <section class="page page--settings">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Настройка приложения</span>
        <h1>Настройки</h1>
        <p>Выбери, что отмечать каждый день, и управляй экспериментом и копиями данных.</p>
      </div>
    </div>

    <article id="daily-blocks" class="settings-card settings-card--daily-blocks">
      <div class="form-card__heading">
        <span class="section-icon section-icon--blue">☷</span>
        <div>
          <h2>Блоки ежедневной записи</h2>
          <p>Оставьте только то, что хотите видеть каждый день. Прежние записи не пропадут.</p>
        </div>
      </div>
      <ChipGroup v-model="settings.activeDailyBlocks as DailyBlockId[]" :options="dailyBlockOptions" multiple />
      <p v-if="!settings.activeDailyBlocks.length" class="data-note">
        Останутся общие блоки: действия по текущей цели, области жизни и заметка дня.
      </p>
      <button class="primary-button" type="button" @click="save('Блоки ежедневной записи сохранены')">Сохранить блоки</button>
    </article>

    <article id="movement-options" class="settings-card settings-card--movement">
      <div class="form-card__heading">
        <span class="section-icon section-icon--green">△</span>
        <div>
          <h2>Физическая активность</h2>
          <p>Оставь общие варианты или добавь занятия, которые важны именно тебе.</p>
        </div>
      </div>
      <div class="custom-list context-factor-list">
        <div v-for="option in activeActivityOptions" :key="option.id" class="custom-list__item">
          <span
            ><i v-if="option.icon">{{ option.icon }}</i
            >{{ option.label }}</span
          >
          <button
            class="hide-option-button"
            type="button"
            :aria-label="`Убрать ${option.label} из ежедневной записи`"
            title="Убрать из ежедневной записи"
            @click="removeActivityOption(option.id)"
          >
            −
          </button>
        </div>
      </div>
      <div class="custom-options">
        <label class="field-label" for="new-activity-option">Добавить свой вариант</label>
        <div class="inline-add">
          <input
            id="new-activity-option"
            v-model="newActivityLabel"
            type="text"
            maxlength="40"
            placeholder="Например: плавание"
            @keyup.enter="addActivityOption"
          />
          <button class="secondary-button" type="button" :disabled="!newActivityLabel.trim()" @click="addActivityOption">Добавить</button>
        </div>
        <div v-if="hiddenActivityOptions.length" class="hidden-options">
          <span class="field-label">Убраны из ежедневной записи</span>
          <div class="hidden-options__list">
            <button
              v-for="option in hiddenActivityOptions"
              :key="option.id"
              class="restore-option"
              type="button"
              :aria-label="`Вернуть ${option.label} в ежедневную запись`"
              @click="restoreActivityOption(option.id)"
            >
              <span>+</span>{{ option.label }}
            </button>
          </div>
        </div>
        <p class="data-note">Убранные варианты не предлагаются в новых записях. Прежние отметки сохраняются в истории и выгрузке.</p>
      </div>
    </article>

    <article id="life-areas" class="settings-card settings-card--areas">
      <div class="form-card__heading">
        <span class="section-icon section-icon--amber">✦</span>
        <div>
          <h2>Области жизни</h2>
          <p>Выберите важные для вас части жизни или добавьте свою.</p>
        </div>
      </div>
      <ChipGroup v-model="settings.activeLifeAreas as LifeAreaId[]" :options="allLifeAreaOptions" multiple />
      <div class="custom-options">
        <label class="field-label" for="new-life-area">Своя область</label>
        <div class="inline-add">
          <input id="new-life-area" v-model="newLifeAreaLabel" type="text" maxlength="32" placeholder="Учёба" @keyup.enter="addLifeArea" />
          <button class="secondary-button" type="button" :disabled="!newLifeAreaLabel.trim()" @click="addLifeArea">Добавить</button>
        </div>
        <div v-if="settings.customLifeAreaOptions.some((option) => !option.archived)" class="custom-list">
          <div v-for="option in settings.customLifeAreaOptions.filter((item) => !item.archived)" :key="option.id" class="custom-list__item">
            <span
              ><i>{{ option.icon }}</i
              >{{ option.label }}</span
            >
            <button
              class="ghost-button ghost-button--danger"
              type="button"
              :aria-label="`Скрыть ${option.label}`"
              @click="removeLifeArea(option.id)"
            >
              ×
            </button>
          </div>
        </div>
      </div>
      <button class="primary-button" type="button" @click="save('Области сохранены')">Сохранить области</button>
    </article>

    <article id="context-options" class="settings-card settings-card--context">
      <div class="form-card__heading">
        <span class="section-icon section-icon--orange">⌁</span>
        <div>
          <h2>Условия дня</h2>
          <p>Добавьте условия, которые повторяются и которые вы хотите сравнивать между днями.</p>
        </div>
      </div>
      <div class="custom-list context-factor-list">
        <div v-for="option in activeContextFactorOptions" :key="option.id" class="custom-list__item">
          <span
            ><i v-if="option.icon">{{ option.icon }}</i
            >{{ option.label }}</span
          >
          <button
            class="hide-option-button"
            type="button"
            :aria-label="`Убрать ${option.label} из ежедневной записи`"
            title="Убрать из ежедневной записи"
            @click="removeContextFactor(option.id)"
          >
            −
          </button>
        </div>
      </div>
      <div class="custom-options">
        <label class="field-label" for="new-context-factor">Добавить своё условие</label>
        <div class="inline-add">
          <input
            id="new-context-factor"
            v-model="newContextFactorLabel"
            type="text"
            maxlength="40"
            placeholder="Например: долгая дорога"
            @keyup.enter="addContextFactor"
          />
          <button class="secondary-button" type="button" :disabled="!newContextFactorLabel.trim()" @click="addContextFactor">
            Добавить
          </button>
        </div>
        <div v-if="hiddenContextFactorOptions.length" class="hidden-options">
          <span class="field-label">Убраны из ежедневной записи</span>
          <div class="hidden-options__list">
            <button
              v-for="option in hiddenContextFactorOptions"
              :key="option.id"
              class="restore-option"
              type="button"
              :aria-label="`Вернуть ${option.label} в ежедневную запись`"
              @click="restoreContextFactor(option.id)"
            >
              <span>+</span>{{ option.label }}
            </button>
          </div>
        </div>
        <p class="data-note">Минус убирает вариант из ежедневной записи. Прежние отметки остаются в истории, графиках и выгрузке.</p>
      </div>
    </article>

    <article id="goal-settings" class="settings-card settings-card--career">
      <div class="form-card__heading">
        <span class="section-icon section-icon--blue">⌁</span>
        <div>
          <h2>Текущая цель</h2>
          <p>Запишите, что хотите изменить или закончить. Цель может относиться к любой части жизни.</p>
        </div>
      </div>
      <div class="settings-field-stack">
        <label class="field-label" for="active-focus">Над чем ты сейчас работаешь</label>
        <input
          id="active-focus"
          v-model="settings.activeFocusTitle"
          type="text"
          maxlength="100"
          placeholder="Например: восстановить режим сна или закончить обучение"
        />
        <label class="field-label" for="focus-outcome">Как понять, что получилось</label>
        <textarea
          id="focus-outcome"
          v-model="settings.focusOutcomeCriterion"
          rows="2"
          maxlength="220"
          placeholder="Например: пять дней подряд вставать до 08:00 или закончить выбранный курс"
        ></textarea>
        <label class="field-label" for="focus-review-date">Когда проверить цель</label>
        <input id="focus-review-date" v-model="settings.focusReviewDate" type="date" />
        <label class="field-label" for="external-evidence">Что считать шагом к цели</label>
        <textarea
          id="external-evidence"
          v-model="settings.externalEvidenceCriterion"
          rows="2"
          maxlength="220"
          placeholder="Например: выполненное задание, тренировка, разговор или принятое решение"
        ></textarea>
      </div>
      <button class="primary-button" type="button" @click="save('Настройки цели сохранены')">Сохранить цель</button>
    </article>

    <article id="work-settings" class="settings-card settings-card--career">
      <div class="form-card__heading">
        <span class="section-icon section-icon--blue">↗</span>
        <div>
          <h2>Варианты для блока «Работа»</h2>
          <p>Оставьте общие варианты или добавьте то, что имеет смысл именно в вашей работе.</p>
        </div>
      </div>
      <span class="field-label">Варианты в ежедневной записи</span>
      <div class="option-preview">
        <span v-for="option in allCareerOptions" :key="option.id" class="option-pill">
          <i v-if="option.icon">{{ option.icon }}</i
          >{{ option.label }}
        </span>
      </div>
      <div class="custom-options">
        <label class="field-label" for="new-career-option">Добавить свой вариант</label>
        <div class="inline-add">
          <input
            id="new-career-option"
            v-model="newCareerLabel"
            type="text"
            maxlength="32"
            placeholder="Например: урок, смена, заказ или собеседование"
            @keyup.enter="addCareerOption"
          />
          <button class="secondary-button" type="button" :disabled="!newCareerLabel.trim()" @click="addCareerOption">Добавить</button>
        </div>
        <div v-if="settings.customCareerOptions.some((option) => !option.archived)" class="custom-list">
          <div v-for="option in settings.customCareerOptions.filter((item) => !item.archived)" :key="option.id" class="custom-list__item">
            <span
              ><i>{{ option.icon }}</i
              >{{ option.label }}</span
            >
            <button
              class="ghost-button ghost-button--danger"
              type="button"
              :aria-label="`Скрыть ${option.label}`"
              @click="removeCareerOption(option.id)"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </article>

    <article id="nutrition-settings" class="settings-card settings-card--nutrition">
      <div class="form-card__heading">
        <span class="section-icon section-icon--green">◐</span>
        <div>
          <h2>Критерий питания</h2>
          <p>Заранее запишите, по каким понятным признакам питание подходит вашему плану.</p>
        </div>
      </div>
      <label class="field-label" for="nutrition-criterion">Что означает «поддержало цель»</label>
      <textarea
        id="nutrition-criterion"
        v-model="settings.nutritionGoalCriterion"
        rows="3"
        maxlength="280"
        placeholder="Например: ел по плану, был нормальный ужин, не было незапланированных вечерних перекусов"
      ></textarea>
      <button class="primary-button" type="button" @click="save('Критерий питания сохранён')">Сохранить настройки</button>
    </article>

    <article id="experiment-settings" class="settings-card settings-card--experiment">
      <div class="form-card__heading">
        <span class="section-icon section-icon--orange">⌁</span>
        <div>
          <h2>Личный эксперимент</h2>
          <p>Попробуйте одно изменение несколько дней или недель, а потом запишите, что вы заметили.</p>
        </div>
      </div>
      <label class="toggle-row"
        ><span><strong>Включить эксперимент</strong><small>В ежедневной записи появится один дополнительный вопрос.</small></span
        ><input v-model="settings.experiment.active" type="checkbox"
      /></label>
      <label class="field-label" for="experiment-title">Что хотите попробовать</label>
      <textarea
        id="experiment-title"
        v-model="settings.experiment.title"
        rows="3"
        maxlength="400"
        placeholder="Не читать новости после 22:00"
      ></textarea>
      <label class="field-label" for="experiment-hypothesis">Что хотите узнать <span class="field-optional">необязательно</span></label>
      <textarea
        id="experiment-hypothesis"
        v-model="settings.experiment.hypothesis"
        rows="2"
        maxlength="300"
        placeholder="Например: станет ли проще засыпать и сохранять энергию утром"
      ></textarea>
      <div class="form-row">
        <label class="form-control"
          ><span class="field-label">С какого дня</span><input v-model="settings.experiment.startDate" type="date"
        /></label>
        <label class="form-control"
          ><span class="field-label">До какого дня</span><input v-model="settings.experiment.endDate" type="date"
        /></label>
      </div>
      <template v-if="experimentCanConclude">
        <label class="field-label" for="experiment-conclusion">Что вы заметили?</label>
        <textarea
          id="experiment-conclusion"
          v-model="settings.experiment.conclusion"
          rows="3"
          maxlength="800"
          placeholder="Опиши наблюдения своими словами. Совпадение показателей не обязательно означает влияние эксперимента."
        ></textarea>
        <label class="field-label">Что хотите делать дальше? <span class="field-optional">необязательно</span></label>
        <ChipGroup v-model="settings.experiment.decision" :options="experimentDecisionOptions" allow-clear />
      </template>
      <p v-else-if="settings.experiment.endDate" class="field-hint">
        После последнего дня здесь можно записать, что вы заметили. Завершённый эксперимент появится в истории раздела «Тренды».
      </p>
      <button class="primary-button" type="button" @click="saveExperiment">Сохранить настройки</button>
      <button v-if="experimentCanConclude" class="secondary-button" type="button" @click="completeExperiment">Завершить эксперимент</button>
      <p v-if="settings.experimentHistory.length" class="data-note">
        Завершённые эксперименты можно посмотреть в истории раздела «Тренды»: {{ settings.experimentHistory.length }}.
      </p>
    </article>

    <article class="settings-card settings-card--backup">
      <div class="form-card__heading">
        <span class="section-icon section-icon--blue">↓</span>
        <div>
          <h2>Копия отдельным файлом</h2>
          <p>Для обычной работы скачивать файл не требуется. Он нужен только как дополнительная личная копия или для переноса данных.</p>
        </div>
      </div>
      <div class="data-actions">
        <button class="secondary-button" type="button" @click="exportData">Скачать копию</button>
        <button class="secondary-button" type="button" @click="importInput?.click()">Восстановить из копии</button>
        <input ref="importInput" class="visually-hidden" type="file" accept="application/json" @change="importData" />
      </div>
      <div class="danger-zone">
        <div>
          <strong>Удалить все данные</strong>
          <p>Записи, итоги, обзоры и настройки будут очищены.</p>
        </div>
        <button class="danger-button" type="button" @click="clearAll">Удалить</button>
      </div>
    </article>

    <article class="settings-card settings-card--cloud">
      <div class="form-card__heading">
        <span class="section-icon section-icon--green">↥</span>
        <div>
          <h2>Автоматическая облачная копия</h2>
          <p>
            После каждого изменения приложение сохраняет данные на устройстве и обновляет облачную копию. Экспортировать их вручную не
            нужно.
          </p>
        </div>
      </div>
      <div v-if="!auth.configured" class="cloud-sync-note">
        <strong>Облачная копия недоступна</strong>
        <p>В этой сборке синхронизация не настроена.</p>
      </div>
      <template v-else>
        <template v-if="cloudSession">
          <div class="cloud-session">
            <div>
              <strong>{{ cloudUserEmail }}</strong>
            </div>
            <button class="secondary-button cloud-session__logout" type="button" @click="signOutCloud">Выйти</button>
          </div>
          <details class="account-security" :open="$route.query['password-recovery'] === '1'">
            <summary>Изменить пароль</summary>
            <div class="settings-field-stack account-security__form">
              <label class="field-label" for="new-password">Новый пароль</label>
              <input
                id="new-password"
                v-model="newPassword"
                type="password"
                autocomplete="new-password"
                minlength="8"
                placeholder="Не меньше 8 символов"
              />
              <label class="field-label" for="new-password-confirmation">Повтори пароль</label>
              <input
                id="new-password-confirmation"
                v-model="newPasswordConfirmation"
                type="password"
                autocomplete="new-password"
                minlength="8"
                placeholder="Повтори пароль"
              />
              <button class="secondary-button" type="button" :disabled="auth.loading || !newPassword" @click="changePassword">
                Сохранить новый пароль
              </button>
            </div>
          </details>
          <div class="cloud-sync-note" :class="`cloud-sync-note--${store.cloudSyncStatus}`">
            <strong>{{ cloudStatusTitle }}</strong>
            <p>{{ cloudStatusText }}</p>
            <p v-if="store.cloudSyncError">Ошибка: {{ store.cloudSyncError }}</p>
          </div>
        </template>
        <div v-else class="cloud-sync-note">
          <strong>Сессия не найдена</strong>
          <p>Обнови страницу и войди снова. До входа приложение не загружает записи.</p>
        </div>
        <div class="data-actions">
          <button class="secondary-button" type="button" :disabled="!cloudSession" @click="saveBackupToCloud">Обновить копию сейчас</button>
          <button class="secondary-button" type="button" :disabled="!cloudSession" @click="restoreBackupFromCloud">
            Загрузить из облака
          </button>
        </div>
        <div v-if="cloudSession" class="danger-zone">
          <div>
            <strong>Удалить аккаунт</strong>
            <p>Аккаунт, облачная копия и данные на этом устройстве будут удалены.</p>
          </div>
          <button class="danger-button" type="button" :disabled="auth.loading" @click="deleteAccount">Удалить аккаунт</button>
        </div>
      </template>
    </article>

    <article class="settings-card settings-card--analysis">
      <div class="form-card__heading">
        <span class="section-icon section-icon--green">↗</span>
        <div>
          <h2>Данные для внешнего анализа</h2>
          <p>
            Промпт содержит читаемую сводку, а отдельный JSON — полную копию данных выбранного периода. Приложение само ничего не
            отправляет.
          </p>
        </div>
      </div>
      <div class="ai-actions">
        <button class="secondary-button" type="button" @click="copyAnalysisPrompt('week')">Промпт недели</button>
        <button class="secondary-button" type="button" @click="copyAnalysisPrompt('month')">Промпт месяца</button>
        <button class="secondary-button" type="button" @click="downloadAnalysisData('week')">Данные недели</button>
        <button class="secondary-button" type="button" @click="downloadAnalysisData('month')">Данные месяца</button>
      </div>
      <details class="analysis-range">
        <summary>Выбрать другой период</summary>
        <div class="analysis-range__content">
          <p>Например, можно захватить часть прошлого месяца и несколько дней текущего.</p>
          <div class="form-row">
            <div>
              <label class="field-label" for="analysis-start">Начало периода</label>
              <input id="analysis-start" v-model="analysisStart" type="date" :max="analysisEnd" aria-label="Начало периода анализа" />
            </div>
            <div>
              <label class="field-label" for="analysis-end">Конец периода</label>
              <input
                id="analysis-end"
                v-model="analysisEnd"
                type="date"
                :min="analysisStart"
                :max="analysisMaxDate"
                aria-label="Конец периода анализа"
              />
            </div>
          </div>
          <div class="ai-actions">
            <button class="secondary-button" type="button" @click="copyCustomAnalysisPrompt">Скопировать промпт периода</button>
            <button class="secondary-button" type="button" @click="downloadCustomAnalysisData">Скачать данные периода</button>
          </div>
          <p class="data-note">
            В промпт входят записи по каждому дню выбранного периода, включая личные заметки. JSON остаётся полной копией без сокращений.
          </p>
        </div>
      </details>
      <p class="data-note">
        В пакет входят личные заметки выбранного периода. Перед передачей внешнему сервису можно просмотреть скачанный JSON.
      </p>
    </article>
  </section>
</template>
