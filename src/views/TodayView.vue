<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import ChipGroup from '../components/ChipGroup.vue';
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
  eveningFactorOptions,
  lifeAreaOptions,
  nutritionOptions,
  specialDayOptions,
  type ActionDirectionId,
  type ActivityId,
  type CareerState,
  type DailyEntry,
  type LifeAreaId,
  type NutritionState
} from '../types';

const store = useAppStore();
const selectedDate = ref(todayKey());
const sleepHours = ref<number | null>(null);
const timeInBedHours = ref<number | null>(null);
const weightKg = ref<number | null>(null);
const saved = ref(false);
const validationMessage = ref('');
const originalEntrySnapshot = ref('');
const form = reactive<DailyEntry>(emptyDailyEntry(selectedDate.value));

const careerItems = computed(() => [...careerOptions, ...store.settings.customCareerOptions]);
const lifeAreaItems = computed(() => [...lifeAreaOptions, ...store.settings.customLifeAreaOptions]);
const activeLifeOptions = computed(() => lifeAreaItems.value.filter((option) => store.settings.activeLifeAreas.includes(option.id)));
const isToday = computed(() => selectedDate.value === todayKey());
const weekEntryCount = computed(() => entriesForWeek(store.dailyEntries, selectedDate.value).length);
const currentWeekEntries = computed(() => entriesForWeek(store.dailyEntries, todayKey()));
const externalCareerIds = computed(() => ['external', 'interview', 'result', ...store.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id)]);
const currentWeekSummary = computed(() => summarize(currentWeekEntries.value, externalCareerIds.value));
const currentWeekObservation = computed(() => buildObservations(currentWeekEntries.value)[0]);
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
const reviewReminders = computed(() => [
  isWeekReviewWindow.value && currentWeekSummary.value.ordinaryCoveredEntriesCount >= 4 && currentWeekSummary.value.ordinaryCoreEntriesCount >= 2 && !store.reviewByWeek(startOfWeek(todayKey()))
    ? { id: 'week', title: 'Неделя готова к разбору', text: `${currentWeekSummary.value.ordinaryCoveredEntriesCount} содержательных дней уже достаточно для короткого обзора.`, to: '/week', label: 'Открыть неделю' }
    : null,
  isMonthReviewWindow.value && currentMonthSummary.value.ordinaryCoveredEntriesCount >= 12 && currentMonthSummary.value.ordinaryCoreEntriesCount >= 6 && !store.reviewByMonth(startOfMonth(todayKey()))
    ? { id: 'month', title: 'Месяц готов к разбору', text: `${currentMonthSummary.value.ordinaryCoveredEntriesCount} содержательных дней дают материал для месячного обзора.`, to: '/month', label: 'Открыть месяц' }
    : null,
].filter((item): item is { id: string; title: string; text: string; to: string; label: string } => item !== null));
const yesterday = computed(() => addDays(todayKey(), -1));
const yesterdayMissing = computed(() => isToday.value && store.loaded && !store.entryByDate(yesterday.value));

function snapshotEntry(entry: DailyEntry) {
  const entryForSnapshot = { ...plainCopy(entry), updatedAt: '' };
  return JSON.stringify({
    ...entryForSnapshot,
    sleepMinutes: sleepHours.value === null ? null : Math.round(sleepHours.value * 60),
    timeInBedMinutes: timeInBedHours.value === null ? null : Math.round(timeInBedHours.value * 60),
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
  sleepHours.value = form.sleepMinutes === null ? null : form.sleepMinutes / 60;
  timeInBedHours.value = form.timeInBedMinutes === null ? null : form.timeInBedMinutes / 60;
  weightKg.value = form.weightKg;
  originalEntrySnapshot.value = snapshotEntry(form);
  saved.value = false;
}

watch(selectedDate, loadEntry, { immediate: true });
watch(() => [form.bedtime, form.wakeTime], ([bedtime, wakeTime]) => {
  const duration = timeBetween(String(bedtime), String(wakeTime));
  if (duration !== null) timeInBedHours.value = duration / 60;
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
  if (sleepHours.value !== null && timeInBedHours.value !== null && sleepHours.value > timeInBedHours.value) {
    validationMessage.value = 'Время сна не может быть больше времени в кровати.';
    notifyError(validationMessage.value);
    return;
  }
  const entry = plainCopy(form);
  entry.sleepMinutes = sleepHours.value === null ? null : Math.round(sleepHours.value * 60);
  entry.timeInBedMinutes = timeInBedHours.value === null ? null : Math.round(timeInBedHours.value * 60);
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

function setEveningFactors(value: string | string[] | null) {
  form.eveningFactors = Array.isArray(value) ? value as DailyEntry['eveningFactors'] : [];
  form.eveningFactorsRecorded = true;
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
        <p>Только факты. Обычно это занимает меньше минуты.</p>
      </div>
      <input v-model="selectedDate" class="date-input" type="date" aria-label="Дата записи" />
    </div>

    <section v-if="isToday && currentWeekSummary.coveredEntriesCount" class="today-pulse" aria-label="Пульс недели">
      <div>
        <span class="eyebrow">Пульс недели</span>
        <p>{{ currentWeekSummary.coveredEntriesCount }} содержательных {{ currentWeekSummary.coveredEntriesCount === 1 ? 'день' : 'дней' }} · сон {{ formatMinutes(currentWeekSummary.averageSleep === null ? null : Math.round(currentWeekSummary.averageSleep)) }} · {{ currentWeekSummary.externalSteps }} дн. с внешним карьерным контактом</p>
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
        <p>{{ reminder.text }} Пакет для GPT можно скачать в обзоре периода.</p>
      </div>
      <RouterLink class="secondary-button" :to="reminder.to">{{ reminder.label }}</RouterLink>
    </section>

    <form class="checkin-grid" @submit.prevent="save">
      <article class="form-card form-card--sleep">
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
            <div class="number-field">
              <input id="sleep-hours" v-model.number="sleepHours" type="number" min="0" max="16" step="0.25" inputmode="decimal" placeholder="7.5" />
              <span>часов</span>
            </div>
          </div>
          <div>
            <label class="field-label" for="time-in-bed-hours">В кровати</label>
            <div class="number-field">
              <input id="time-in-bed-hours" v-model.number="timeInBedHours" type="number" min="0" max="18" step="0.25" inputmode="decimal" placeholder="8.5" />
              <span>часов</span>
            </div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-control"><label class="field-label">Качество сна</label><ScalePicker v-model="form.sleepQuality" low-label="плохо" high-label="хорошо" /></div>
          <div class="form-control"><label class="field-label">Энергия за день</label><ScalePicker v-model="form.energy" low-label="нет сил" high-label="много сил" /></div>
        </div>
        <p v-if="validationMessage" class="field-error" role="alert">{{ validationMessage }}</p>
        <label class="field-label" for="state-context">Что мешало или влияло</label>
        <textarea
          id="state-context"
          v-model="form.stateContext"
          rows="2"
          maxlength="220"
          placeholder="Например: поздний кофе, тревога, шум, перегруз, просыпался ночью"
        ></textarea>
        <div class="factor-block">
          <label class="field-label">Факторы перед этим сном</label>
          <ChipGroup :model-value="form.eveningFactors" :options="eveningFactorOptions" multiple @update:model-value="setEveningFactors" />
          <button class="none-option" :class="{ selected: form.eveningFactorsRecorded && !form.eveningFactors.length }" type="button" @click="form.eveningFactors = []; form.eveningFactorsRecorded = true">Ничего из списка</button>
          <textarea
            v-if="form.eveningFactors.length"
            v-model="form.eveningFactorNote"
            rows="2"
            maxlength="180"
            placeholder="Короткое уточнение, если нужно."
          ></textarea>
        </div>
      </article>

      <article class="form-card">
        <div class="form-card__heading">
          <span class="section-icon section-icon--blue">↗</span>
          <div><h2>Карьера</h2><p>Самый заметный контакт с карьерой за день.</p></div>
        </div>
        <ChipGroup v-model="form.careerStates as CareerState[]" :options="careerItems" multiple />
      </article>

      <article class="form-card form-card--direction">
        <div class="form-card__heading">
          <span class="section-icon section-icon--blue">⌁</span>
          <div><h2>Направление действия</h2><p>{{ form.focusTitle || store.settings.activeFocusTitle ? `Фокус: ${form.focusTitle || store.settings.activeFocusTitle}` : 'Проверка: день двигал цель наружу или оставался подготовкой.' }}</p></div>
        </div>
        <p v-if="form.externalEvidenceCriterion || store.settings.externalEvidenceCriterion" class="form-context">Внешний шаг: {{ form.externalEvidenceCriterion || store.settings.externalEvidenceCriterion }}</p>
        <ChipGroup v-model="form.actionDirection as ActionDirectionId | null" :options="actionDirectionOptions" allow-clear />
        <textarea
          v-if="form.actionDirection"
          v-model="form.actionNote"
          rows="2"
          maxlength="180"
          placeholder="Например: написал человеку, изучал тему, поддерживал режим, день ушёл в новости"
        ></textarea>
      </article>

      <article class="form-card">
        <div class="form-card__heading">
          <span class="section-icon section-icon--green">△</span>
          <div><h2>Движение</h2><p>Можно выбрать несколько вариантов.</p></div>
        </div>
        <ChipGroup :model-value="form.activities as ActivityId[]" :options="activityOptions" multiple @update:model-value="setActivities" />
        <button class="none-option" :class="{ selected: form.activitiesRecorded && !form.activities.length }" type="button" @click="form.activities = []; form.activitiesRecorded = true">Без движения</button>
      </article>

      <article class="form-card form-card--nutrition">
        <div class="form-card__heading">
          <span class="section-icon section-icon--green">◐</span>
          <div><h2>Питание</h2><p>{{ form.nutritionCriterion || store.settings.nutritionGoalCriterion || 'Отметь, поддерживало ли оно цель по весу.' }}</p></div>
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

      <article class="form-card form-card--special">
        <div class="form-card__heading">
          <span class="section-icon section-icon--orange">!</span>
          <div><h2>Особый день</h2><p>Отметка для будущих сравнений и контекста.</p></div>
        </div>
        <ChipGroup v-model="form.specialDay" :options="specialDayOptions" allow-clear />
        <template v-if="form.specialDay">
          <label class="field-label" for="special-day-note">Короткое уточнение</label>
          <input id="special-day-note" v-model="form.specialDayNote" type="text" maxlength="120" placeholder="Например: перелёт, простуда, дедлайн, семейное событие" />
        </template>
      </article>

      <article v-if="store.settings.experiment.active" class="form-card form-card--experiment">
        <div class="form-card__heading">
          <span class="section-icon section-icon--orange">⌁</span>
          <div><h2>Текущий эксперимент</h2><p>{{ store.settings.experiment.title }}</p></div>
        </div>
        <p v-if="store.settings.experiment.hypothesis" class="form-context">Гипотеза: {{ store.settings.experiment.hypothesis }}</p>
        <p v-if="store.settings.experiment.targetMetric" class="form-context">Проверяем: {{ store.settings.experiment.targetMetric }}</p>
        <div class="binary-choice">
          <button type="button" :class="{ selected: form.experimentCompleted === true }" @click="form.experimentCompleted = true">Да</button>
          <button type="button" :class="{ selected: form.experimentCompleted === false }" @click="form.experimentCompleted = false">Нет</button>
          <button type="button" :class="{ selected: form.experimentCompleted === null }" @click="form.experimentCompleted = null">Пропустить</button>
        </div>
      </article>

      <article class="form-card">
        <div class="form-card__heading">
          <span class="section-icon">·</span>
          <div><h2>Наблюдение дня</h2><p>Событие, изменение или контекст, который стоит запомнить.</p></div>
        </div>
        <textarea v-model="form.importantFact" rows="2" maxlength="240" placeholder="Например: разговор заметно изменил настроение на весь день"></textarea>
      </article>

      <button class="primary-button primary-button--save" type="submit" :disabled="saveButtonDisabled">
        <span>{{ saveButtonText }}</span><span>{{ saved ? '✓' : '→' }}</span>
      </button>
    </form>
  </section>
</template>
