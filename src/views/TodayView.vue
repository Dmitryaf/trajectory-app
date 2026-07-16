<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import ChipGroup from '../components/ChipGroup.vue';
import ScalePicker from '../components/ScalePicker.vue';
import { useAppStore } from '../stores/app';
import { addDays, formatDate, formatMinutes, todayKey } from '../services/dates';
import { buildObservations, entriesForWeek, summarize } from '../services/analytics';
import { plainCopy } from '../services/plain';
import {
  activityOptions,
  careerOptions,
  emptyDailyEntry,
  eveningFactorOptions,
  lifeAreaOptions,
  specialDayOptions,
  type ActivityId,
  type CareerState,
  type DailyEntry,
  type LifeAreaId
} from '../types';

const store = useAppStore();
const selectedDate = ref(todayKey());
const sleepHours = ref<number | null>(null);
const saved = ref(false);
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
const weeklyReviewReady = computed(() => isToday.value && currentWeekSummary.value.entriesCount >= 4);
const yesterday = computed(() => addDays(todayKey(), -1));
const yesterdayMissing = computed(() => isToday.value && store.loaded && !store.entryByDate(yesterday.value));

function loadEntry(date: string) {
  const existing = store.entryByDate(date);
  Object.assign(form, existing ? plainCopy(existing) : emptyDailyEntry(date));
  sleepHours.value = form.sleepMinutes === null ? null : form.sleepMinutes / 60;
  saved.value = false;
}

watch(selectedDate, loadEntry, { immediate: true });

async function save() {
  form.sleepMinutes = sleepHours.value === null ? null : Math.round(sleepHours.value * 60);
  await store.saveEntry(plainCopy(form));
  saved.value = true;
  window.setTimeout(() => (saved.value = false), 2200);
}

function fillYesterday() {
  selectedDate.value = yesterday.value;
}
</script>

<template>
  <section class="page page--today">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Ежедневный чек-ин</span>
        <h1>{{ isToday ? 'Сегодня' : formatDate(selectedDate, { day: 'numeric', month: 'long', weekday: 'long' }) }}</h1>
        <p>Только факты. Обычно это занимает меньше минуты.</p>
      </div>
      <input v-model="selectedDate" class="date-input" type="date" aria-label="Дата записи" />
    </div>

    <section v-if="isToday && currentWeekSummary.entriesCount" class="today-pulse" aria-label="Пульс недели">
      <div>
        <span class="eyebrow">Пульс недели</span>
        <p>{{ currentWeekSummary.entriesCount }} заполненных {{ currentWeekSummary.entriesCount === 1 ? 'день' : 'дней' }} · сон {{ formatMinutes(currentWeekSummary.averageSleep === null ? null : Math.round(currentWeekSummary.averageSleep)) }} · {{ currentWeekSummary.externalSteps }} внешних шагов</p>
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

    <section v-if="weeklyReviewReady" class="review-nudge" aria-label="Неделя готова к обзору">
      <div>
        <strong>Уже есть материал для обзора</strong>
        <p>{{ currentWeekSummary.entriesCount }} заполненных дней достаточно, чтобы увидеть повторяющиеся факторы без ИИ.</p>
      </div>
      <RouterLink class="secondary-button" to="/week">Открыть неделю</RouterLink>
    </section>

    <form class="checkin-grid" @submit.prevent="save">
      <article class="form-card form-card--sleep">
        <div class="form-card__heading">
          <span class="section-icon section-icon--purple">◒</span>
          <div><h2>Сон и состояние</h2><p>Не действие и не достижение — просто данные.</p></div>
        </div>
        <label class="field-label" for="sleep-hours">Сколько спал</label>
        <div class="number-field">
          <input id="sleep-hours" v-model.number="sleepHours" type="number" min="0" max="16" step="0.25" inputmode="decimal" placeholder="7.5" />
          <span>часов</span>
        </div>
        <div class="form-row">
          <div class="form-control"><label class="field-label">Качество сна</label><ScalePicker v-model="form.sleepQuality" low-label="плохо" high-label="хорошо" /></div>
          <div class="form-control"><label class="field-label">Энергия</label><ScalePicker v-model="form.energy" low-label="нет сил" high-label="много сил" /></div>
        </div>
        <label class="field-label" for="state-context">Контекст сна и состояния</label>
        <textarea
          id="state-context"
          v-model="form.stateContext"
          rows="2"
          maxlength="220"
          placeholder="Например: поздний кофе, тревожные мысли, шум, перегруз, просыпался ночью"
        ></textarea>
        <div class="factor-block">
          <label class="field-label">Что могло повлиять на сон или состояние?</label>
          <ChipGroup v-model="form.eveningFactors" :options="eveningFactorOptions" multiple />
          <textarea
            v-if="form.eveningFactors.length"
            v-model="form.eveningFactorNote"
            rows="2"
            maxlength="180"
            placeholder="Короткое уточнение, если нужно. Без отчёта и саморазбора."
          ></textarea>
        </div>
      </article>

      <article class="form-card">
        <div class="form-card__heading">
          <span class="section-icon section-icon--blue">↗</span>
          <div><h2>Карьера</h2><p>Выбери самый значимый уровень контакта с карьерой.</p></div>
        </div>
        <ChipGroup v-model="form.careerState as CareerState | null" :options="careerItems" allow-clear />
      </article>

      <article class="form-card">
        <div class="form-card__heading">
          <span class="section-icon section-icon--green">△</span>
          <div><h2>Движение</h2><p>Можно выбрать несколько вариантов.</p></div>
        </div>
        <ChipGroup v-model="form.activities as ActivityId[]" :options="activityOptions" multiple />
      </article>

      <article class="form-card">
        <div class="form-card__heading">
          <span class="section-icon section-icon--amber">✦</span>
          <div><h2>Что ещё было в жизни</h2><p>Отметь присутствие областей, не расписывая каждое действие.</p></div>
        </div>
        <ChipGroup v-model="form.lifeAreas as LifeAreaId[]" :options="activeLifeOptions" multiple />
      </article>

      <article class="form-card form-card--special">
        <div class="form-card__heading">
          <span class="section-icon section-icon--orange">!</span>
          <div><h2>Особый день</h2><p>Если день выбивался из обычного ритма, отметь причину для будущих сравнений.</p></div>
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
        <div class="binary-choice">
          <button type="button" :class="{ selected: form.experimentCompleted === true }" @click="form.experimentCompleted = true">Да</button>
          <button type="button" :class="{ selected: form.experimentCompleted === false }" @click="form.experimentCompleted = false">Нет</button>
          <button type="button" :class="{ selected: form.experimentCompleted === null }" @click="form.experimentCompleted = null">Не отмечать</button>
        </div>
      </article>

      <article class="form-card">
        <div class="form-card__heading">
          <span class="section-icon">·</span>
          <div><h2>Главный факт дня</h2><p>Необязательно. Одна короткая фраза без анализа жизни.</p></div>
        </div>
        <textarea v-model="form.importantFact" rows="2" maxlength="240" placeholder="Например: отправил резюме напрямую в две компании"></textarea>
      </article>

      <button class="primary-button primary-button--save" type="submit">
        <span>{{ saved ? `Сохранено · ${weekEntryCount} дн. на неделе` : 'Сохранить день' }}</span><span>{{ saved ? '✓' : '→' }}</span>
      </button>
    </form>
  </section>
</template>
