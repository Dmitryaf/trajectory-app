<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import ChipGroup from '../components/ChipGroup.vue';
import DurationInput from '../components/DurationInput.vue';
import ScalePicker from '../components/ScalePicker.vue';
import { useAppStore } from '../stores/app';
import { addDays, endOfMonth, endOfWeek, formatDate, formatMinutes, startOfMonth, startOfWeek, todayKey } from '../services/dates';
import { buildObservations, entriesForPeriod, entriesForWeek, summarize } from '../services/analytics';
import { notifyError, notifySaved } from '../services/notifications';
import { plainCopy } from '../services/plain';
import {
  actionDirectionOptions,
  activityOptions,
  careerOptions,
  emptyDailyEntry,
  experimentAppliesToDate,
  contextFactorOptions,
  lifeAreaOptions,
  nutritionOptions,
  specialDayOptions,
  type ActionDirectionId,
  type ActivityId,
  type CareerState,
  type DailyBlockId,
  type DailyEntry,
  type LifeAreaId,
  type NutritionState
} from '../types';

const store = useAppStore();
const selectedDate = ref(todayKey());
const sleepDurationMinutes = ref<number | null>(null);
const timeInBedDurationMinutes = ref<number | null>(null);
const weightKg = ref<number | null>(null);
const saved = ref(false);
const validationMessage = ref('');
const originalEntrySnapshot = ref('');
const form = reactive<DailyEntry>(emptyDailyEntry(selectedDate.value));

const careerItems = computed(() => [...careerOptions, ...store.settings.customCareerOptions.filter((option) => !option.archived)]);
const contextFactorItems = computed(() => [...contextFactorOptions, ...store.settings.customContextFactorOptions.filter((option) => !option.archived)]);
const lifeAreaItems = computed(() => [...lifeAreaOptions, ...store.settings.customLifeAreaOptions]);
const activeLifeOptions = computed(() => lifeAreaItems.value.filter((option) => store.settings.activeLifeAreas.includes(option.id)));
const activeDailyBlocks = computed(() => new Set(store.settings.activeDailyBlocks));
const isToday = computed(() => selectedDate.value === todayKey());
const weekEntryCount = computed(() => entriesForWeek(store.dailyEntries, selectedDate.value).length);
const currentWeekEntries = computed(() => entriesForWeek(store.dailyEntries, todayKey()));
const externalCareerIds = computed(() => ['external', 'interview', 'result', ...store.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id)]);
const currentWeekSummary = computed(() => summarize(currentWeekEntries.value, externalCareerIds.value));
const currentWeekObservation = computed(() => buildObservations(currentWeekEntries.value, contextFactorItems.value)[0]);
const currentMonthEntries = computed(() => entriesForPeriod(store.dailyEntries, startOfMonth(todayKey()), endOfMonth(todayKey())));
const currentMonthSummary = computed(() => summarize(currentMonthEntries.value, externalCareerIds.value));
const isWeekReviewWindow = computed(() => isToday.value && todayKey() >= addDays(endOfWeek(todayKey()), -1));
const isMonthReviewWindow = computed(() => isToday.value && todayKey() >= addDays(endOfMonth(todayKey()), -2));
const hasSavedEntry = computed(() => Boolean(store.entryByDate(selectedDate.value)));
const currentEntrySnapshot = computed(() => snapshotEntry(form));
const isDirty = computed(() => currentEntrySnapshot.value !== originalEntrySnapshot.value);
const entryChangeNotice = computed(() => {
  if (saved.value) return '';
  if (isDirty.value && hasSavedEntry.value) return `Есть изменения за ${formatDate(selectedDate.value, { day: 'numeric', month: 'long' })}. Сохрани, чтобы обновить запись.`;
  if (isDirty.value) return `Есть несохранённая запись за ${formatDate(selectedDate.value, { day: 'numeric', month: 'long' })}.`;
  return '';
});
const saveButtonText = computed(() => {
  if (hasSavedEntry.value && isDirty.value) return 'Сохранить изменения';
  if (hasSavedEntry.value) return 'Запись сохранена';
  return 'Сохранить день';
});
const saveButtonDisabled = computed(() => hasSavedEntry.value && !isDirty.value && !saved.value);
const experimentAppliesToSelectedDate = computed(() => {
  return experimentAppliesToDate(store.settings.experiment, selectedDate.value);
});
const reviewReminders = computed(() => [
  isWeekReviewWindow.value && currentWeekSummary.value.ordinaryCoveredEntriesCount >= 4 && currentWeekSummary.value.ordinaryCoreEntriesCount >= 2 && !store.reviewByWeek(startOfWeek(todayKey()))
    ? { id: 'week', title: 'Неделя готова к разбору', text: `${currentWeekSummary.value.ordinaryCoveredEntriesCount} заполненных дней уже достаточно для короткого обзора.`, to: '/week', label: 'Открыть неделю' }
    : null,
  isMonthReviewWindow.value && currentMonthSummary.value.ordinaryCoveredEntriesCount >= 12 && currentMonthSummary.value.ordinaryCoreEntriesCount >= 6 && !store.reviewByMonth(startOfMonth(todayKey()))
    ? { id: 'month', title: 'Месяц готов к разбору', text: `${currentMonthSummary.value.ordinaryCoveredEntriesCount} заполненных дней дают материал для месячного обзора.`, to: '/month', label: 'Открыть месяц' }
    : null,
].filter((item): item is { id: string; title: string; text: string; to: string; label: string } => item !== null));
const yesterday = computed(() => addDays(todayKey(), -1));
const yesterdayMissing = computed(() => isToday.value && store.loaded && !store.entryByDate(yesterday.value));

function blockIsActive(block: DailyBlockId) {
  return activeDailyBlocks.value.has(block);
}

function snapshotEntry(entry: DailyEntry) {
  const entryForSnapshot = { ...plainCopy(entry), updatedAt: '' };
  return JSON.stringify({
    ...entryForSnapshot,
    sleepMinutes: sleepDurationMinutes.value,
    timeInBedMinutes: timeInBedDurationMinutes.value,
    weightKg: normalizeWeight(weightKg.value)
  });
}

function normalizeWeight(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function loadEntry(date: string) {
  validationMessage.value = '';
  const existing = store.entryByDate(date);
  Object.assign(form, existing ? plainCopy(existing) : emptyDailyEntry(date));
  sleepDurationMinutes.value = form.sleepMinutes;
  timeInBedDurationMinutes.value = form.timeInBedMinutes;
  weightKg.value = form.weightKg;
  originalEntrySnapshot.value = snapshotEntry(form);
  saved.value = false;
}

watch(selectedDate, loadEntry, { immediate: true });
watch(() => [form.bedtime, form.wakeTime], ([bedtime, wakeTime]) => {
  const duration = timeBetween(String(bedtime), String(wakeTime));
  if (duration !== null) timeInBedDurationMinutes.value = duration;
});

function timeBetween(start: string, end: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  let duration = endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
  if (duration <= 0) duration += 24 * 60;
  return duration <= 18 * 60 ? duration : null;
}

async function save() {
  validationMessage.value = '';
  if (blockIsActive('sleep') && sleepDurationMinutes.value !== null && timeInBedDurationMinutes.value !== null && sleepDurationMinutes.value > timeInBedDurationMinutes.value) {
    validationMessage.value = 'Время сна не может быть больше времени в кровати.';
    notifyError(validationMessage.value);
    return;
  }
  const entry = plainCopy(form);
  entry.sleepMinutes = sleepDurationMinutes.value;
  entry.timeInBedMinutes = timeInBedDurationMinutes.value;
  entry.weightKg = normalizeWeight(weightKg.value);
  if (!hasSavedEntry.value && !entry.focusTitle.trim()) entry.focusTitle = store.settings.activeFocusTitle.trim();
  if (!hasSavedEntry.value && !entry.externalEvidenceCriterion.trim()) entry.externalEvidenceCriterion = store.settings.externalEvidenceCriterion.trim();
  if (!hasSavedEntry.value && !entry.nutritionCriterion.trim()) entry.nutritionCriterion = store.settings.nutritionGoalCriterion.trim();
  const wasExistingEntry = hasSavedEntry.value;
  await store.saveEntry(entry);
  Object.assign(form, entry);
  originalEntrySnapshot.value = snapshotEntry(form);
  saved.value = true;
  notifySaved(wasExistingEntry ? `Запись за ${formatDate(selectedDate.value, { day: 'numeric', month: 'long' })} обновлена` : 'День сохранён');
  window.setTimeout(() => (saved.value = false), 2200);
}

function fillYesterday() {
  selectedDate.value = yesterday.value;
}

function setContextFactors(value: string | string[] | null) {
  form.contextFactors = Array.isArray(value) ? value as DailyEntry['contextFactors'] : [];
  form.contextFactorsRecorded = true;
}

function setActivities(value: string | string[] | null) {
  form.activities = Array.isArray(value) ? value as ActivityId[] : [];
  form.activitiesRecorded = true;
}

function setLifeAreas(value: string | string[] | null) {
  form.lifeAreas = Array.isArray(value) ? value as LifeAreaId[] : [];
  form.lifeAreasRecorded = true;
}
</script>

<template>
  <section class="page page--today">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Ежедневная запись</span>
        <h1>{{ isToday ? 'Сегодня' : formatDate(selectedDate, { day: 'numeric', month: 'long', weekday: 'long' }) }}</h1>
      </div>
      <input v-model="selectedDate" class="date-input" type="date" :max="todayKey()" aria-label="Дата записи" />
    </div>

    <nav class="quick-capture" aria-label="Быстрые записи">
      <RouterLink to="/results"><span>✓</span><strong>Добавить итог</strong></RouterLink>
      <RouterLink to="/events"><span>✦</span><strong>Записать событие или инсайт</strong></RouterLink>
    </nav>

    <section v-if="isToday && currentWeekSummary.coveredEntriesCount" class="today-pulse" aria-label="Пульс недели">
      <div>
        <span class="eyebrow">Пульс недели</span>
        <p>{{ currentWeekSummary.coveredEntriesCount }} {{ currentWeekSummary.coveredEntriesCount === 1 ? 'заполненный день' : 'заполненных дней' }} · сон {{ formatMinutes(currentWeekSummary.averageSleep === null ? null : Math.round(currentWeekSummary.averageSleep)) }} · {{ currentWeekSummary.externalSteps }} дн. с откликом, встречей или ответом</p>
      </div>
      <p v-if="currentWeekObservation">{{ currentWeekObservation.text }}</p>
    </section>

    <section v-if="yesterdayMissing" class="recovery-nudge" aria-label="Вчера без записи">
      <div>
        <strong>Вчера без записи</strong>
        <p>Можно заполнить коротко сейчас или спокойно продолжить с сегодняшнего дня.</p>
      </div>
      <button class="secondary-button" type="button" @click="fillYesterday">Заполнить вчера</button>
    </section>

    <section v-if="entryChangeNotice" class="entry-change-notice" aria-live="polite">
      <strong>{{ hasSavedEntry ? 'Изменения не сохранены' : 'Новая запись не сохранена' }}</strong>
      <p>{{ entryChangeNotice }}</p>
    </section>

    <section v-for="reminder in reviewReminders" :key="reminder.id" class="review-nudge" aria-label="Период готов к обзору">
      <div>
        <strong>{{ reminder.title }}</strong>
        <p>{{ reminder.text }}</p>
      </div>
      <RouterLink class="secondary-button" :to="reminder.to">{{ reminder.label }}</RouterLink>
    </section>

    <form class="checkin-grid" @submit.prevent="save">
      <article v-if="blockIsActive('sleep')" class="form-card form-card--sleep">
        <div class="form-card__heading">
          <span class="section-icon section-icon--purple">◒</span>
          <div><h2>Сон и состояние</h2><p>Ночь перед выбранной датой и состояние следующего дня.</p></div>
        </div>
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
          <div class="form-control"><label class="field-label">Качество сна</label><ScalePicker v-model="form.sleepQuality" low-label="плохо" high-label="хорошо" /></div>
          <div class="form-control"><label class="field-label">Энергия за день</label><ScalePicker v-model="form.energy" low-label="нет сил" high-label="много сил" /></div>
        </div>
        <p v-if="validationMessage" class="field-error" role="alert">{{ validationMessage }}</p>
      </article>

      <article v-if="blockIsActive('context')" class="form-card form-card--context">
        <div class="form-card__heading">
          <span class="section-icon section-icon--orange">⌁</span>
          <div><h2>Контекст дня</h2><p>Отметь условия, которые могли быть связаны с самочувствием или ходом дня.</p></div>
        </div>
        <div class="factor-block">
          <label class="field-label">Повторяющиеся условия</label>
          <ChipGroup :model-value="form.contextFactors" :options="contextFactorItems" multiple @update:model-value="setContextFactors" />
          <button class="none-option" :class="{ selected: form.contextFactorsRecorded && !form.contextFactors.length }" type="button" @click="form.contextFactors = []; form.contextFactorsRecorded = true">Ничего из списка</button>
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
            <input id="special-day-note" v-model="form.specialDayNote" type="text" maxlength="120" placeholder="Например: перелёт, простуда, дедлайн или семейное событие" />
          </template>
        </div>
      </article>

      <article v-if="blockIsActive('career')" class="form-card">
        <div class="form-card__heading">
          <span class="section-icon section-icon--blue">↗</span>
          <div><h2>Карьера</h2><p>Отметь всё, что сегодня было связано с работой или её поиском.</p></div>
        </div>
        <ChipGroup v-model="form.careerStates as CareerState[]" :options="careerItems" multiple />
      </article>

      <article class="form-card form-card--direction">
        <div class="form-card__heading">
          <span class="section-icon section-icon--blue">⌁</span>
          <div><h2>Действия по текущей цели</h2><p>{{ form.focusTitle || store.settings.activeFocusTitle ? `Текущая цель: ${form.focusTitle || store.settings.activeFocusTitle}` : 'Выбери, что лучше всего описывает этот день относительно твоей цели.' }}</p></div>
        </div>
        <p v-if="form.externalEvidenceCriterion || store.settings.externalEvidenceCriterion" class="form-context">Конкретное действие: {{ form.externalEvidenceCriterion || store.settings.externalEvidenceCriterion }}</p>
        <ChipGroup v-model="form.actionDirection as ActionDirectionId | null" :options="actionDirectionOptions" allow-clear />
        <textarea
          v-if="form.actionDirection"
          v-model="form.actionNote"
          rows="2"
          maxlength="180"
          placeholder="Например: сделал запланированное, готовился, поддерживал привычный ритм или занимался другим"
        ></textarea>
      </article>

      <article v-if="blockIsActive('movement')" class="form-card">
        <div class="form-card__heading">
          <span class="section-icon section-icon--green">△</span>
          <div><h2>Физическая активность</h2><p>Можно выбрать несколько вариантов.</p></div>
        </div>
        <ChipGroup :model-value="form.activities as ActivityId[]" :options="activityOptions" multiple @update:model-value="setActivities" />
        <button class="none-option" :class="{ selected: form.activitiesRecorded && !form.activities.length }" type="button" @click="form.activities = []; form.activitiesRecorded = true">Без активности</button>
      </article>

      <article v-if="blockIsActive('nutrition')" class="form-card form-card--nutrition">
        <div class="form-card__heading">
          <span class="section-icon section-icon--green">◐</span>
          <div><h2>Питание</h2><p>{{ form.nutritionCriterion || store.settings.nutritionGoalCriterion || 'Отметь, соответствовало ли питание выбранным правилам.' }}</p></div>
        </div>
        <ChipGroup v-model="form.nutritionState as NutritionState | null" :options="nutritionOptions" allow-clear />
        <div class="sleep-field-grid">
          <div>
            <label class="field-label" for="weight-kg">Вес</label>
            <div class="number-field">
              <input id="weight-kg" v-model.number="weightKg" type="number" min="30" max="250" step="0.1" inputmode="decimal" placeholder="82.4" />
              <span>кг</span>
            </div>
          </div>
        </div>
        <textarea v-model="form.nutritionNote" rows="2" maxlength="180" placeholder="Например: много перекусов вечером, ел по плану, пропустил нормальный ужин"></textarea>
      </article>

      <article class="form-card">
        <div class="form-card__heading">
          <span class="section-icon section-icon--amber">✦</span>
          <div><h2>Области жизни</h2><p>Отметь, что присутствовало сегодня.</p></div>
        </div>
        <ChipGroup :model-value="form.lifeAreas as LifeAreaId[]" :options="activeLifeOptions" multiple @update:model-value="setLifeAreas" />
        <button class="none-option" :class="{ selected: form.lifeAreasRecorded && !form.lifeAreas.length }" type="button" @click="form.lifeAreas = []; form.lifeAreasRecorded = true">Ничего не отмечаю</button>
      </article>

      <article v-if="experimentAppliesToSelectedDate" class="form-card form-card--experiment">
        <div class="form-card__heading">
          <span class="section-icon section-icon--orange">⌁</span>
          <div><h2>Текущий эксперимент</h2><p>{{ store.settings.experiment.title }}</p></div>
        </div>
        <p v-if="store.settings.experiment.hypothesis" class="form-context">Гипотеза: {{ store.settings.experiment.hypothesis }}</p>
        <p v-if="store.settings.experiment.targetMetric" class="form-context">Проверяем: {{ store.settings.experiment.targetMetric }}</p>
        <label class="field-label">Условие эксперимента сегодня выполнено?</label>
        <div class="binary-choice">
          <button type="button" :class="{ selected: form.experimentCompleted === true }" @click="form.experimentCompleted = true">Выполнено</button>
          <button type="button" :class="{ selected: form.experimentCompleted === false }" @click="form.experimentCompleted = false">Не выполнено</button>
          <button type="button" :class="{ selected: form.experimentCompleted === null }" @click="form.experimentCompleted = null">Не отмечать</button>
        </div>
      </article>

      <article class="form-card">
        <div class="form-card__heading">
          <span class="section-icon">·</span>
          <div><h2>Факт дня</h2><p>Один заметный факт, который поможет потом понять этот день.</p></div>
        </div>
        <textarea v-model="form.importantFact" rows="2" maxlength="240" placeholder="Например: разговор заметно изменил настроение на весь день"></textarea>
      </article>

      <button class="primary-button primary-button--save" type="submit" :disabled="saveButtonDisabled">
        <span>{{ saveButtonText }}</span><span>{{ saved ? '✓' : '→' }}</span>
      </button>
    </form>
  </section>
</template>
