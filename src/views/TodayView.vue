<script setup lang="ts">
import { computed } from 'vue';
import ChipGroup from '../components/ChipGroup.vue';
import DurationInput from '../components/DurationInput.vue';
import HowItWorksDialog from '../components/HowItWorksDialog.vue';
import ScalePicker from '../components/ScalePicker.vue';
import { useDailyEntryForm } from '../features/daily-entry/useDailyEntryForm';
import { useAppStore } from '../stores/app';
import { addDays, endOfMonth, endOfWeek, formatDate, formatMinutes, startOfMonth, startOfWeek, todayKey } from '../services/dates';
import { buildObservations, entriesForPeriod, entriesForWeek, summarize } from '../services/analytics';
import {
  actionDirectionEntryOptions,
  activityOptions,
  careerOptions,
  experimentAppliesToDate,
  contextFactorOptions,
  legacyContextFactorOptions,
  legacyActivityOptions,
  legacyCareerOptions,
  lifeAreaOptions,
  nutritionOptions,
  specialDayOptions,
  type ActionDirectionId,
  type ActivityId,
  type CareerState,
  type DailyEntry,
  type DailyRecordedFieldId,
  type LifeAreaId,
  type NutritionState,
} from '../types';

const store = useAppStore();
const {
  selectedDate,
  sleepDurationMinutes,
  timeInBedDurationMinutes,
  weightKg,
  saved,
  validationMessage,
  form,
  hasSavedEntry,
  isDirty,
  entryChangeNotice,
  saveButtonText,
  saveButtonDisabled,
  blockIsActive,
  changeSelectedDate,
  selectDate,
  save,
} = useDailyEntryForm(store);

const careerItems = computed(() => {
  const usedIds = new Set([
    ...store.dailyEntries.flatMap((entry) => entry.careerStates),
    ...store.dailyEntries.flatMap((entry) => (entry.careerState ? [entry.careerState] : [])),
    ...form.careerStates,
  ]);
  return Array.from(
    new Map(
      [
        ...careerOptions,
        ...store.settings.customCareerOptions.filter((option) => !option.archived),
        ...legacyCareerOptions.filter((option) => usedIds.has(option.id)),
      ].map((option) => [option.id, option]),
    ).values(),
  );
});
const activityItems = computed(() => {
  const configured = [
    ...activityOptions.filter((option) => !store.settings.hiddenActivityIds.includes(option.id)),
    ...store.settings.customActivityOptions.filter((option) => !option.archived),
  ];
  const configuredIds = new Set(configured.map((option) => option.id));
  const historical = Array.from(
    new Map(
      [...activityOptions, ...legacyActivityOptions, ...store.settings.customActivityOptions].map((option) => [option.id, option]),
    ).values(),
  ).filter((option) => form.activities.includes(option.id) && !configuredIds.has(option.id));
  return [...configured, ...historical];
});
const contextFactorItems = computed(() => [
  ...contextFactorOptions.filter((option) => !store.settings.hiddenContextFactorIds.includes(option.id)),
  ...store.settings.customContextFactorOptions.filter((option) => !option.archived),
  ...legacyContextFactorOptions.filter((option) => form.contextFactors.includes(option.id)),
]);
const actionDirectionItems = computed(() =>
  form.actionDirection === 'recovery'
    ? [...actionDirectionEntryOptions, { id: 'recovery' as const, label: 'Восстановление (старая отметка)', icon: '◌' }]
    : actionDirectionEntryOptions,
);
const lifeAreaItems = computed(() => [...lifeAreaOptions, ...store.settings.customLifeAreaOptions]);
const activeLifeOptions = computed(() => lifeAreaItems.value.filter((option) => store.settings.activeLifeAreas.includes(option.id)));
const isToday = computed(() => selectedDate.value === todayKey());
const isFirstEntry = computed(() => store.loaded && store.dailyEntries.length === 0);
const hasSelectedFocus = computed(() => Boolean((form.focusTitle || store.settings.activeFocusTitle).trim()));
const hasRecordedGoalAction = computed(() => form.recordedFields.includes('actionDirection'));
const showGoalActionChoices = computed(() => hasSelectedFocus.value || hasRecordedGoalAction.value);
const currentWeekEntries = computed(() => entriesForWeek(store.dailyEntries, todayKey()));
const externalCareerIds = computed(() => [
  'external',
  'interview',
  'result',
  ...store.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id),
]);
const currentWeekSummary = computed(() => summarize(currentWeekEntries.value, externalCareerIds.value));
const currentWeekObservation = computed(() => buildObservations(currentWeekEntries.value, contextFactorItems.value)[0]);
const currentMonthEntries = computed(() => entriesForPeriod(store.dailyEntries, startOfMonth(todayKey()), endOfMonth(todayKey())));
const currentMonthSummary = computed(() => summarize(currentMonthEntries.value, externalCareerIds.value));
const isWeekReviewWindow = computed(() => isToday.value && todayKey() >= addDays(endOfWeek(todayKey()), -1));
const isMonthReviewWindow = computed(() => isToday.value && todayKey() >= addDays(endOfMonth(todayKey()), -2));
const experimentAppliesToSelectedDate = computed(() => {
  return experimentAppliesToDate(store.settings.experiment, selectedDate.value);
});
const reviewReminders = computed(() =>
  [
    isWeekReviewWindow.value &&
    currentWeekSummary.value.ordinaryCoveredEntriesCount >= 4 &&
    currentWeekSummary.value.ordinaryCoreEntriesCount >= 2 &&
    !store.reviewByWeek(startOfWeek(todayKey()))
      ? {
          id: 'week',
          title: 'Неделя готова к разбору',
          text: `${currentWeekSummary.value.ordinaryCoveredEntriesCount} заполненных дней уже достаточно для короткого обзора.`,
          to: '/week',
          label: 'Открыть неделю',
        }
      : null,
    isMonthReviewWindow.value &&
    currentMonthSummary.value.ordinaryCoveredEntriesCount >= 12 &&
    currentMonthSummary.value.ordinaryCoreEntriesCount >= 6 &&
    !store.reviewByMonth(startOfMonth(todayKey()))
      ? {
          id: 'month',
          title: 'Месяц готов к разбору',
          text: `${currentMonthSummary.value.ordinaryCoveredEntriesCount} заполненных дней дают материал для месячного обзора.`,
          to: '/month',
          label: 'Открыть месяц',
        }
      : null,
  ].filter((item): item is { id: string; title: string; text: string; to: string; label: string } => item !== null),
);
const activeReviewReminder = computed(() => reviewReminders.value[0] ?? null);
const currentWeeklyPlan = computed(() => store.reviewByWeek(startOfWeek(todayKey()))?.ifThenPlan.trim() ?? '');
const yesterday = computed(() => addDays(todayKey(), -1));
const yesterdayMissing = computed(
  () => isToday.value && store.loaded && store.dailyEntries.length > 0 && !store.entryByDate(yesterday.value),
);

function fillYesterday() {
  changeSelectedDate(yesterday.value);
}

function setContextFactors(value: string | string[] | null) {
  form.contextFactors = Array.isArray(value) ? (value as DailyEntry['contextFactors']) : [];
  form.contextFactorsRecorded = true;
  markRecorded('contextFactors');
}

function setActivities(value: string | string[] | null) {
  form.activities = Array.isArray(value) ? (value as ActivityId[]) : [];
  form.activitiesRecorded = true;
  markRecorded('activities');
}

function setLifeAreas(value: string | string[] | null) {
  form.lifeAreas = Array.isArray(value) ? (value as LifeAreaId[]) : [];
  form.lifeAreasRecorded = true;
  markRecorded('lifeAreas');
}

function setCareerStates(value: string | string[] | null) {
  form.careerStates = Array.isArray(value) ? (value as CareerState[]) : [];
  form.careerState = form.careerStates[0] ?? null;
  markRecorded('careerStates');
}

function setActionDirection(value: string | string[] | null) {
  form.actionDirection = typeof value === 'string' ? (value as ActionDirectionId) : null;
  if (form.actionDirection) markRecorded('actionDirection');
  else unmarkRecorded('actionDirection');
}

function setNoActionDirection() {
  form.actionDirection = null;
  form.actionNote = '';
  markRecorded('actionDirection');
}

function setNutritionState(value: string | string[] | null) {
  form.nutritionState = typeof value === 'string' ? (value as NutritionState) : null;
  if (form.nutritionState) markRecorded('nutritionState');
  else unmarkRecorded('nutritionState');
}

function markRecorded(field: DailyRecordedFieldId) {
  if (!form.recordedFields.includes(field)) form.recordedFields.push(field);
}

function unmarkRecorded(field: DailyRecordedFieldId) {
  form.recordedFields = form.recordedFields.filter((item) => item !== field);
}
</script>

<template>
  <section class="page page--today">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Ежедневная запись</span>
        <h1>{{ isToday ? 'Сегодня' : formatDate(selectedDate, { day: 'numeric', month: 'long', weekday: 'long' }) }}</h1>
      </div>
      <input :value="selectedDate" class="date-input" type="date" :max="todayKey()" aria-label="Дата записи" @change="selectDate" />
    </div>

    <nav v-if="!isFirstEntry" class="quick-capture" aria-label="Быстрые записи">
      <RouterLink to="/results"><span>✓</span><strong>Сохранить завершённый результат</strong></RouterLink>
      <RouterLink to="/events"><span>✦</span><strong>Записать мысль или событие</strong></RouterLink>
    </nav>

    <section v-if="isFirstEntry" class="first-entry-guide" aria-label="Первая запись">
      <div>
        <span class="eyebrow">С чего начать</span>
        <h2>Отметьте несколько деталей сегодняшнего дня</h2>
        <p>Не нужно заполнять всё. Разделы на главной можно добавить или убрать в настройках — уже сохранённые записи не пропадут.</p>
      </div>
      <div class="first-entry-guide__actions">
        <RouterLink class="secondary-button" to="/settings#daily-blocks">Настроить блоки на главной</RouterLink>
        <HowItWorksDialog button-label="Зачем это заполнять?" inline />
      </div>
    </section>

    <div v-else class="daily-layout-settings">
      <span>Хотите добавить или убрать разделы?</span>
      <RouterLink to="/settings#daily-blocks">Настроить главную →</RouterLink>
    </div>

    <section v-if="!isFirstEntry && entryChangeNotice" class="entry-change-notice" aria-live="polite">
      <strong>{{ hasSavedEntry ? 'Изменения не сохранены' : 'Новая запись не сохранена' }}</strong>
      <p>{{ entryChangeNotice }}</p>
    </section>

    <section v-else-if="activeReviewReminder" class="review-nudge" aria-label="Период готов к обзору">
      <div>
        <strong>{{ activeReviewReminder.title }}</strong>
        <p>{{ activeReviewReminder.text }}</p>
      </div>
      <RouterLink class="secondary-button" :to="activeReviewReminder.to">{{ activeReviewReminder.label }}</RouterLink>
    </section>

    <section v-else-if="yesterdayMissing" class="recovery-nudge" aria-label="Вчера без записи">
      <div>
        <strong>Вчера без записи</strong>
        <p>Можно заполнить коротко сейчас или спокойно продолжить с сегодняшнего дня.</p>
      </div>
      <button class="secondary-button" type="button" @click="fillYesterday">Заполнить вчера</button>
    </section>

    <section v-else-if="isToday && currentWeeklyPlan" class="today-pulse" aria-label="Текущий план недели">
      <div>
        <span class="eyebrow">План недели</span>
        <p>{{ currentWeeklyPlan }}</p>
      </div>
    </section>

    <section v-else-if="isToday && currentWeekSummary.coveredEntriesCount" class="today-pulse" aria-label="Пульс недели">
      <div>
        <span class="eyebrow">Пульс недели</span>
        <p>
          {{ currentWeekSummary.coveredEntriesCount }}
          {{ currentWeekSummary.coveredEntriesCount === 1 ? 'заполненный день' : 'заполненных дней' }} · сон
          {{ formatMinutes(currentWeekSummary.averageSleep === null ? null : Math.round(currentWeekSummary.averageSleep)) }} ·
          {{ currentWeekSummary.externalActionDays }} дн. с шагом к цели
        </p>
      </div>
      <p v-if="currentWeekObservation">{{ currentWeekObservation.text }}</p>
    </section>

    <form class="checkin-grid" :class="{ 'checkin-grid--dirty': isDirty }" @submit.prevent="save">
      <article v-if="blockIsActive('sleep')" id="sleep" class="form-card form-card--sleep form-card--wide">
        <div class="form-card__heading">
          <span class="section-icon section-icon--purple">◒</span>
          <div>
            <h2>Сон и состояние</h2>
            <p>Сон перед этой датой и сколько сил было в этот день.</p>
          </div>
          <RouterLink class="card-settings-link" to="/settings#daily-blocks">Настроить</RouterLink>
        </div>
        <p class="field-hint">Время в кровати посчитается по времени отбоя и подъёма. «Примерно спал» — ваша оценка самого сна.</p>
        <div class="sleep-field-grid">
          <div>
            <label class="field-label" for="bedtime">Лёг спать</label>
            <input id="bedtime" v-model="form.bedtime" type="time" />
          </div>
          <div>
            <label class="field-label" for="wake-time">Встал</label>
            <input id="wake-time" v-model="form.wakeTime" type="time" />
          </div>
          <div>
            <label class="field-label" for="sleep-hours">Примерно спал</label>
            <DurationInput id="sleep-hours" v-model="sleepDurationMinutes" :max-hours="16" />
          </div>
          <div>
            <label class="field-label" for="time-in-bed-hours">В кровати</label>
            <DurationInput id="time-in-bed-hours" v-model="timeInBedDurationMinutes" :max-hours="18" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-control">
            <label class="field-label">Качество сна</label><ScalePicker v-model="form.sleepQuality" low-label="плохо" high-label="хорошо" />
          </div>
          <div class="form-control">
            <label class="field-label">Энергия за день</label
            ><ScalePicker v-model="form.energy" low-label="нет сил" high-label="много сил" />
          </div>
        </div>
        <p v-if="validationMessage" class="field-error" role="alert">{{ validationMessage }}</p>
      </article>

      <article v-if="blockIsActive('context')" id="day-conditions" class="form-card form-card--context form-card--wide">
        <div class="form-card__heading">
          <span class="section-icon section-icon--orange">⌁</span>
          <div>
            <h2>Что могло повлиять на день</h2>
            <p>Отметьте условия, которые стоит сравнить с другими днями.</p>
          </div>
          <RouterLink class="card-settings-link" to="/settings#context-options">Настроить</RouterLink>
        </div>
        <div class="factor-block">
          <label class="field-label">Повторяющиеся условия</label>
          <ChipGroup :model-value="form.contextFactors" :options="contextFactorItems" multiple @update:model-value="setContextFactors" />
          <button
            class="none-option"
            :class="{ selected: form.contextFactorsRecorded && !form.contextFactors.length }"
            type="button"
            @click="setContextFactors([])"
          >
            Ничего из списка
          </button>
        </div>
        <label class="field-label" for="context-note">Короткое пояснение</label>
        <textarea
          id="context-note"
          v-model="form.contextNote"
          rows="3"
          maxlength="400"
          placeholder="Например: поздний кофе, тревога, шум, перегруз или частые пробуждения"
        ></textarea>
        <div class="context-special-day">
          <label class="field-label">Необычный день</label>
          <p class="field-hint">Эта отметка помогает не смешивать особые обстоятельства с обычными днями.</p>
          <ChipGroup v-model="form.specialDay" :options="specialDayOptions" allow-clear />
          <template v-if="form.specialDay">
            <label class="field-label" for="special-day-note">Короткое уточнение</label>
            <input
              id="special-day-note"
              v-model="form.specialDayNote"
              type="text"
              maxlength="120"
              placeholder="Например: перелёт, простуда, дедлайн или семейное событие"
            />
          </template>
        </div>
      </article>

      <article v-if="blockIsActive('career')" id="career" class="form-card">
        <div class="form-card__heading">
          <span class="section-icon section-icon--blue">↗</span>
          <div>
            <h2>Работа</h2>
            <p>Что сегодня было связано с работой, учёбой для неё или своим проектом.</p>
          </div>
          <RouterLink class="card-settings-link" to="/settings#work-settings">Настроить</RouterLink>
        </div>
        <ChipGroup
          :model-value="form.careerStates as CareerState[]"
          :options="careerItems"
          multiple
          @update:model-value="setCareerStates"
        />
        <button
          class="none-option"
          :class="{ selected: form.recordedFields.includes('careerStates') && !form.careerStates.length }"
          type="button"
          @click="setCareerStates([])"
        >
          Ничего из списка
        </button>
      </article>

      <article id="goal-actions" class="form-card form-card--direction form-card--wide">
        <div class="form-card__heading">
          <span class="section-icon section-icon--blue">⌁</span>
          <div>
            <h2>Действия по цели</h2>
            <p>
              {{
                hasSelectedFocus
                  ? `Текущая цель: ${form.focusTitle || store.settings.activeFocusTitle}`
                  : hasRecordedGoalAction
                    ? 'Для этой записи цель не была сохранена.'
                    : 'Сначала выберите, над чем сейчас хотите работать.'
              }}
            </p>
          </div>
          <RouterLink class="card-settings-link" to="/settings#goal-settings">{{
            hasSelectedFocus ? 'Настроить' : 'Выбрать цель'
          }}</RouterLink>
        </div>
        <template v-if="showGoalActionChoices">
          <p v-if="form.focusOutcomeCriterion || store.settings.focusOutcomeCriterion" class="form-context">
            Как понять, что получилось: {{ form.focusOutcomeCriterion || store.settings.focusOutcomeCriterion }}
          </p>
          <p v-if="form.focusReviewDate || store.settings.focusReviewDate" class="form-context">
            Проверить цель:
            {{ formatDate(form.focusReviewDate || store.settings.focusReviewDate, { day: 'numeric', month: 'long', year: 'numeric' }) }}
          </p>
          <p v-if="form.externalEvidenceCriterion || store.settings.externalEvidenceCriterion" class="form-context">
            Что считать шагом: {{ form.externalEvidenceCriterion || store.settings.externalEvidenceCriterion }}
          </p>
          <p class="field-hint">Выберите, что лучше всего описывает этот день относительно цели.</p>
          <ChipGroup
            :model-value="form.actionDirection"
            :options="actionDirectionItems"
            allow-clear
            @update:model-value="setActionDirection"
          />
          <button
            class="none-option"
            :class="{ selected: form.recordedFields.includes('actionDirection') && form.actionDirection === null }"
            type="button"
            @click="setNoActionDirection"
          >
            Действий по цели не было
          </button>
          <p v-if="form.actionDirection === 'recovery'" class="data-note">
            Это значение сохранено из старой записи. Для новых дней восстановление отмечается в активности или условиях дня.
          </p>
          <textarea
            v-if="form.actionDirection"
            v-model="form.actionNote"
            rows="2"
            maxlength="180"
            placeholder="Коротко: что именно вы сделали"
          ></textarea>
        </template>
        <div v-else class="empty-block-note">
          <p>После выбора цели здесь можно будет отмечать конкретные шаги, подготовку или дни, занятые другими делами.</p>
          <RouterLink class="secondary-button" to="/settings#goal-settings">Выбрать текущую цель</RouterLink>
        </div>
      </article>

      <article v-if="blockIsActive('movement')" id="movement" class="form-card">
        <div class="form-card__heading">
          <span class="section-icon section-icon--green">△</span>
          <div>
            <h2>Физическая активность</h2>
            <p>Отметьте, была ли сегодня активность и какая.</p>
          </div>
          <RouterLink class="card-settings-link" to="/settings#movement-options">Настроить</RouterLink>
        </div>
        <ChipGroup :model-value="form.activities as ActivityId[]" :options="activityItems" multiple @update:model-value="setActivities" />
        <button
          class="none-option"
          :class="{ selected: form.activitiesRecorded && !form.activities.length }"
          type="button"
          @click="setActivities([])"
        >
          Без активности
        </button>
      </article>

      <article v-if="blockIsActive('nutrition')" id="nutrition" class="form-card form-card--nutrition">
        <div class="form-card__heading">
          <span class="section-icon section-icon--green">◐</span>
          <div>
            <h2>Питание</h2>
            <p>
              {{
                form.nutritionCriterion ||
                store.settings.nutritionGoalCriterion ||
                'Отметьте, как прошёл день относительно вашего ориентира в питании.'
              }}
            </p>
          </div>
          <RouterLink class="card-settings-link" to="/settings#nutrition-settings">Настроить</RouterLink>
        </div>
        <ChipGroup :model-value="form.nutritionState" :options="nutritionOptions" allow-clear @update:model-value="setNutritionState" />
        <div class="sleep-field-grid">
          <div>
            <label class="field-label" for="weight-kg">Вес</label>
            <div class="number-field">
              <input
                id="weight-kg"
                v-model.number="weightKg"
                type="number"
                min="30"
                max="250"
                step="0.1"
                inputmode="decimal"
                placeholder="82.4"
              />
              <span>кг</span>
            </div>
          </div>
        </div>
        <textarea
          v-model="form.nutritionNote"
          rows="2"
          maxlength="180"
          placeholder="Например: много перекусов вечером, ел по плану, пропустил нормальный ужин"
        ></textarea>
      </article>

      <article id="life-areas" class="form-card">
        <div class="form-card__heading">
          <span class="section-icon section-icon--amber">✦</span>
          <div>
            <h2>Области жизни</h2>
            <p>Что было заметной частью этого дня. Это не оценка успешности.</p>
          </div>
          <RouterLink class="card-settings-link" to="/settings#life-areas">Настроить</RouterLink>
        </div>
        <ChipGroup :model-value="form.lifeAreas as LifeAreaId[]" :options="activeLifeOptions" multiple @update:model-value="setLifeAreas" />
        <button
          class="none-option"
          :class="{ selected: form.lifeAreasRecorded && !form.lifeAreas.length }"
          type="button"
          @click="setLifeAreas([])"
        >
          Ничего не отмечаю
        </button>
      </article>

      <article v-if="experimentAppliesToSelectedDate" id="experiment" class="form-card form-card--experiment">
        <div class="form-card__heading">
          <span class="section-icon section-icon--orange">⌁</span>
          <div>
            <h2>Эксперимент</h2>
            <p>{{ store.settings.experiment.title }}</p>
          </div>
          <RouterLink class="card-settings-link" to="/settings#experiment-settings">Настроить</RouterLink>
        </div>
        <p v-if="store.settings.experiment.hypothesis" class="form-context">
          Что хотите узнать: {{ store.settings.experiment.hypothesis }}
        </p>
        <label class="field-label">Сегодня получилось это сделать?</label>
        <div class="binary-choice">
          <button type="button" :class="{ selected: form.experimentCompleted === true }" @click="form.experimentCompleted = true">
            Да
          </button>
          <button type="button" :class="{ selected: form.experimentCompleted === false }" @click="form.experimentCompleted = false">
            Нет
          </button>
          <button type="button" :class="{ selected: form.experimentCompleted === null }" @click="form.experimentCompleted = null">
            Нет отметки
          </button>
        </div>
      </article>

      <article class="form-card">
        <div class="form-card__heading">
          <span class="section-icon">·</span>
          <div>
            <h2>Заметка дня</h2>
            <p>Что сегодня произошло или что вы заметили — даже если день был обычным.</p>
          </div>
        </div>
        <textarea
          v-model="form.importantFact"
          rows="2"
          maxlength="240"
          placeholder="Например: после прогулки стало легче собраться с мыслями"
        ></textarea>
      </article>

      <button class="primary-button primary-button--save" type="submit" :disabled="saveButtonDisabled">
        <span>{{ saveButtonText }}</span
        ><span>{{ saved ? '✓' : '→' }}</span>
      </button>
      <Transition name="mobile-save">
        <button v-if="isDirty" class="primary-button mobile-save-button" type="submit" :disabled="saveButtonDisabled">
          <span>{{ saveButtonText }}</span
          ><span aria-hidden="true">→</span>
        </button>
      </Transition>
    </form>
  </section>
</template>
