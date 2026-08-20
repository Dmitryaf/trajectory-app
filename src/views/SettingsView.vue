<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AutoGrowTextarea from '../shared/ui/forms/AutoGrowTextarea.vue';
import PasswordField from '../shared/ui/forms/PasswordField.vue';
import PwaInstallGuide from '../features/pwa/ui/PwaInstallGuide.vue';
import { pwaPlatform } from '../features/pwa/installation';
import { useSettingsForm } from '../features/settings/useSettingsForm';
import type { DailyBlockId, LifeAreaId } from '../types';

type SettingsGroup = 'daily' | 'experiment' | 'data' | 'account';

const settingsGroups: Array<{ id: SettingsGroup; label: string; hash: string }> = [
  { id: 'daily', label: 'Ежедневная запись', hash: 'daily-settings' },
  { id: 'experiment', label: 'Эксперимент', hash: 'experiment-settings' },
  { id: 'data', label: 'Данные и синхронизация', hash: 'data-settings' },
  { id: 'account', label: 'Аккаунт и безопасность', hash: 'account-settings' },
];
const settingsGroupStyle = { animation: 'page-in 0.25s ease-out' };
const dailySectionHashes = new Set([
  'daily-settings',
  'daily-blocks',
  'movement-options',
  'life-areas',
  'context-options',
  'work-settings',
  'nutrition-settings',
]);
const dataSectionHashes = new Set(['data-settings', 'install-settings', 'backup-settings', 'cloud-settings', 'analysis-settings']);
const activeSettingsGroup = ref<SettingsGroup>('daily');
const passwordRecoveryRequested = new URLSearchParams(window.location.search).get('password-recovery') === '1';

function settingsGroupForHash(hash: string): SettingsGroup | null {
  const id = hash.replace(/^#/, '');
  if (dailySectionHashes.has(id)) return 'daily';
  if (id === 'experiment-settings' || id === 'experiment-settings-group') return 'experiment';
  if (dataSectionHashes.has(id)) return 'data';
  if (id === 'account-settings') return 'account';
  return null;
}

function scrollToSettingsHash(): void {
  const id = window.location.hash.replace(/^#/, '');
  if (!id) return;
  void nextTick(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
}

function syncSettingsGroupWithLocation(): void {
  if (passwordRecoveryRequested) activeSettingsGroup.value = 'account';
  else activeSettingsGroup.value = settingsGroupForHash(window.location.hash) ?? activeSettingsGroup.value;
  scrollToSettingsHash();
}

function selectSettingsGroup(group: (typeof settingsGroups)[number]): void {
  activeSettingsGroup.value = group.id;
  window.history.replaceState(null, '', `#${group.hash}`);
  scrollToSettingsHash();
}

onMounted(() => {
  syncSettingsGroupWithLocation();
  window.addEventListener('hashchange', syncSettingsGroupWithLocation);
});

onBeforeUnmount(() => window.removeEventListener('hashchange', syncSettingsGroupWithLocation));

const {
  ChipGroup,
  experimentDecisionOptions,
  experimentTextLimits,
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
  storageProtectionTitle,
  storageProtectionText,
  experimentCanConclude,
  experimentIdentityLocked,
  experimentSaveLabel,
  isSaving,
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

    <nav class="range-tabs" aria-label="Разделы настроек">
      <button
        v-for="group in settingsGroups"
        :key="group.id"
        type="button"
        :class="{ active: activeSettingsGroup === group.id }"
        :aria-pressed="activeSettingsGroup === group.id"
        @click="selectSettingsGroup(group)"
      >
        {{ group.label }}
      </button>
    </nav>

    <section
      v-show="activeSettingsGroup === 'daily'"
      id="daily-settings"
      class="settings-group"
      :style="settingsGroupStyle"
      aria-label="Настройка ежедневной записи"
    >
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
        <button
          class="primary-button"
          type="button"
          :disabled="isSaving('daily-blocks')"
          @click="save('Блоки ежедневной записи сохранены', 'daily-blocks')"
        >
          {{ isSaving('daily-blocks') ? 'Сохраняю…' : 'Сохранить блоки' }}
        </button>
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
              :disabled="isSaving('activity')"
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
            <button
              class="secondary-button"
              type="button"
              :disabled="!newActivityLabel.trim() || isSaving('activity')"
              @click="addActivityOption"
            >
              Добавить
            </button>
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
                :disabled="isSaving('activity')"
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
            <input
              id="new-life-area"
              v-model="newLifeAreaLabel"
              type="text"
              maxlength="32"
              placeholder="Учёба"
              @keyup.enter="addLifeArea"
            />
            <button
              class="secondary-button"
              type="button"
              :disabled="!newLifeAreaLabel.trim() || isSaving('life-areas')"
              @click="addLifeArea"
            >
              Добавить
            </button>
          </div>
          <div v-if="settings.customLifeAreaOptions.some((option) => !option.archived)" class="custom-list">
            <div
              v-for="option in settings.customLifeAreaOptions.filter((item) => !item.archived)"
              :key="option.id"
              class="custom-list__item"
            >
              <span
                ><i>{{ option.icon }}</i
                >{{ option.label }}</span
              >
              <button
                class="ghost-button ghost-button--danger"
                type="button"
                :aria-label="`Скрыть ${option.label}`"
                :disabled="isSaving('life-areas')"
                @click="removeLifeArea(option.id)"
              >
                ×
              </button>
            </div>
          </div>
        </div>
        <button class="primary-button" type="button" :disabled="isSaving('life-areas')" @click="save('Области сохранены', 'life-areas')">
          {{ isSaving('life-areas') ? 'Сохраняю…' : 'Сохранить области' }}
        </button>
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
              :disabled="isSaving('context')"
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
            <button
              class="secondary-button"
              type="button"
              :disabled="!newContextFactorLabel.trim() || isSaving('context')"
              @click="addContextFactor"
            >
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
                :disabled="isSaving('context')"
                @click="restoreContextFactor(option.id)"
              >
                <span>+</span>{{ option.label }}
              </button>
            </div>
          </div>
          <p class="data-note">Минус убирает вариант из ежедневной записи. Прежние отметки остаются в истории, графиках и выгрузке.</p>
        </div>
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
            <button
              class="secondary-button"
              type="button"
              :disabled="!newCareerLabel.trim() || isSaving('career')"
              @click="addCareerOption"
            >
              Добавить
            </button>
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
                :disabled="isSaving('career')"
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
        <button
          class="primary-button"
          type="button"
          :disabled="isSaving('nutrition')"
          @click="save('Критерий питания сохранён', 'nutrition')"
        >
          {{ isSaving('nutrition') ? 'Сохраняю…' : 'Сохранить настройки' }}
        </button>
      </article>
    </section>

    <section
      v-show="activeSettingsGroup === 'experiment'"
      id="experiment-settings-group"
      class="settings-group"
      :style="settingsGroupStyle"
      aria-label="Настройка личного эксперимента"
    >
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
        <AutoGrowTextarea
          id="experiment-title"
          v-model="settings.experiment.title"
          :rows="5"
          :max-length="experimentTextLimits.title"
          :read-only="experimentIdentityLocked"
          placeholder="Не читать новости после 22:00"
        />
        <p v-if="experimentIdentityLocked" class="field-hint">
          Условие и дата начала зафиксированы после первой дневной записи. Дату окончания можно продлить.
        </p>
        <label class="field-label" for="experiment-hypothesis">Что хотите узнать <span class="field-optional">необязательно</span></label>
        <AutoGrowTextarea
          id="experiment-hypothesis"
          v-model="settings.experiment.hypothesis"
          :rows="4"
          :max-length="experimentTextLimits.hypothesis"
          placeholder="Например: станет ли проще засыпать и сохранять энергию утром"
        />
        <div class="form-row">
          <label class="form-control"
            ><span class="field-label">С какого дня</span
            ><input v-model="settings.experiment.startDate" type="date" :disabled="experimentIdentityLocked"
          /></label>
          <label class="form-control"
            ><span class="field-label">До какого дня</span
            ><input
              v-model="settings.experiment.endDate"
              type="date"
              :min="experimentIdentityLocked ? store.settings.experiment.endDate : undefined"
          /></label>
        </div>
        <template v-if="experimentCanConclude || settings.experiment.conclusion.trim()">
          <label class="field-label" for="experiment-conclusion">
            {{ experimentCanConclude ? 'Что вы заметили?' : 'Промежуточное наблюдение' }}
          </label>
          <AutoGrowTextarea
            id="experiment-conclusion"
            v-model="settings.experiment.conclusion"
            :rows="6"
            :max-length="experimentTextLimits.conclusion"
            placeholder="Опиши наблюдения своими словами. Совпадение показателей не обязательно означает влияние эксперимента."
          />
          <label class="field-label">
            {{ experimentCanConclude ? 'Что хотите делать дальше?' : 'Ранее выбранное решение' }}
            <span class="field-optional">необязательно</span>
          </label>
          <ChipGroup v-model="settings.experiment.decision" :options="experimentDecisionOptions" allow-clear />
        </template>
        <p v-else-if="settings.experiment.endDate" class="field-hint">
          После последнего дня здесь можно записать, что вы заметили. Завершённый эксперимент появится в разделе «История».
        </p>
        <button class="primary-button" type="button" :disabled="isSaving('experiment')" @click="saveExperiment">
          {{ experimentSaveLabel }}
        </button>
        <button
          v-if="experimentCanConclude"
          class="secondary-button"
          type="button"
          :disabled="isSaving('experiment')"
          @click="completeExperiment"
        >
          Завершить эксперимент
        </button>
        <p v-if="settings.experimentHistory.length" class="data-note">
          Завершённые эксперименты можно посмотреть в разделе «История»: {{ settings.experimentHistory.length }}.
        </p>
      </article>
    </section>

    <section
      v-show="activeSettingsGroup === 'data'"
      id="data-settings"
      class="settings-group"
      :style="settingsGroupStyle"
      aria-label="Данные и синхронизация"
    >
      <article v-if="pwaPlatform !== 'other'" id="install-settings" class="settings-card settings-card--backup">
        <div class="form-card__heading">
          <span class="section-icon section-icon--blue">⌂</span>
          <div>
            <h2>Установка на телефон</h2>
            <p>Добавьте «Траекторию» на домашний экран и открывайте её как отдельное приложение.</p>
          </div>
        </div>
        <PwaInstallGuide open />
      </article>

      <article id="backup-settings" class="settings-card settings-card--backup">
        <div class="form-card__heading">
          <span class="section-icon section-icon--blue">↓</span>
          <div>
            <h2>Копия отдельным файлом</h2>
            <p>Для обычной работы скачивать файл не требуется. Он нужен только как дополнительная личная копия или для переноса данных.</p>
          </div>
        </div>
        <div class="cloud-sync-note" role="status">
          <strong>{{ storageProtectionTitle }}</strong>
          <p>{{ storageProtectionText }}</p>
        </div>
        <div class="data-actions">
          <button class="secondary-button" type="button" @click="exportData">Скачать копию</button>
          <button class="secondary-button" type="button" :disabled="isSaving('import')" @click="importInput?.click()">
            {{ isSaving('import') ? 'Восстанавливаю…' : 'Восстановить из копии' }}
          </button>
          <input
            ref="importInput"
            class="visually-hidden"
            type="file"
            accept="application/json"
            :disabled="isSaving('import')"
            @change="importData"
          />
        </div>
        <div class="danger-zone">
          <div>
            <strong>Удалить все данные</strong>
            <p>Записи, итоги, обзоры и настройки будут очищены.</p>
          </div>
          <button class="danger-button" type="button" :disabled="isSaving('clear-data')" @click="clearAll">
            {{ isSaving('clear-data') ? 'Удаляю…' : 'Удалить' }}
          </button>
        </div>
      </article>

      <article id="cloud-settings" class="settings-card settings-card--cloud">
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
          <div v-if="cloudSession" class="cloud-sync-note" :class="`cloud-sync-note--${store.cloudSyncStatus}`">
            <strong>{{ cloudStatusTitle }}</strong>
            <p>{{ cloudStatusText }}</p>
            <p v-if="store.cloudSyncError">Ошибка: {{ store.cloudSyncError }}</p>
          </div>
          <div v-else class="cloud-sync-note">
            <strong>Сессия не найдена</strong>
            <p>Обнови страницу и войди снова. До входа приложение не загружает записи.</p>
          </div>
          <p v-if="cloudSession" class="muted">Изменения с других устройств появляются автоматически, когда приложение открыто.</p>
        </template>
      </article>

      <article id="analysis-settings" class="settings-card settings-card--analysis">
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
          <button
            class="secondary-button"
            type="button"
            :disabled="isSaving('analysis-week')"
            :aria-busy="isSaving('analysis-week')"
            @click="copyAnalysisPrompt('week')"
          >
            Промпт недели
          </button>
          <button
            class="secondary-button"
            type="button"
            :disabled="isSaving('analysis-month')"
            :aria-busy="isSaving('analysis-month')"
            @click="copyAnalysisPrompt('month')"
          >
            Промпт месяца
          </button>
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
              <button
                class="secondary-button"
                type="button"
                :disabled="isSaving('analysis-range')"
                :aria-busy="isSaving('analysis-range')"
                @click="copyCustomAnalysisPrompt"
              >
                Скопировать промпт периода
              </button>
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

    <section
      v-show="activeSettingsGroup === 'account'"
      id="account-settings"
      class="settings-group"
      :style="settingsGroupStyle"
      aria-label="Аккаунт и безопасность"
    >
      <article class="settings-card settings-card--account settings-card--career">
        <div class="form-card__heading">
          <span class="section-icon section-icon--blue">◉</span>
          <div>
            <h2>Аккаунт и безопасность</h2>
            <p>Управляйте входом, паролем и удалением аккаунта отдельно от копий данных.</p>
          </div>
        </div>
        <div v-if="!auth.configured" class="cloud-sync-note">
          <strong>Аккаунт недоступен</strong>
          <p>В этой сборке облачный вход не настроен.</p>
        </div>
        <template v-else-if="cloudSession">
          <div class="cloud-session">
            <div>
              <strong>{{ cloudUserEmail }}</strong>
            </div>
            <button class="secondary-button cloud-session__logout" type="button" :disabled="auth.loading" @click="signOutCloud">
              Выйти
            </button>
          </div>
          <details class="account-security" :open="passwordRecoveryRequested">
            <summary>Изменить пароль</summary>
            <div class="settings-field-stack account-security__form">
              <label class="field-label" for="new-password">Новый пароль</label>
              <PasswordField
                id="new-password"
                v-model="newPassword"
                autocomplete="new-password"
                minlength="8"
                placeholder="Не меньше 8 символов"
              />
              <label class="field-label" for="new-password-confirmation">Повтори пароль</label>
              <PasswordField
                id="new-password-confirmation"
                v-model="newPasswordConfirmation"
                autocomplete="new-password"
                minlength="8"
                placeholder="Повтори пароль"
              />
              <button class="secondary-button" type="button" :disabled="auth.loading || !newPassword" @click="changePassword">
                Сохранить новый пароль
              </button>
            </div>
          </details>
          <div class="danger-zone">
            <div>
              <strong>Удалить аккаунт</strong>
              <p>Аккаунт, облачная копия и данные на этом устройстве будут удалены.</p>
            </div>
            <button class="danger-button" type="button" :disabled="auth.loading" @click="deleteAccount">Удалить аккаунт</button>
          </div>
        </template>
        <div v-else class="cloud-sync-note">
          <strong>Сессия не найдена</strong>
          <p>Обновите страницу и войдите снова, чтобы управлять аккаунтом.</p>
        </div>
      </article>
    </section>
  </section>
</template>
