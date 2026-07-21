<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ChipGroup from '../components/ChipGroup.vue';
import { formatDate, todayKey } from '../services/dates';
import { notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
import { pageCount as countPages, pageItems } from '../services/pagination';
import { useAppStore } from '../stores/app';
import { lifeEventTypeOptions, type LifeEventRecord, type LifeEventType } from '../types';

const store = useAppStore();
const title = ref('');
const note = ref('');
const date = ref(todayKey());
const type = ref<LifeEventType>('change');
const editingId = ref<number | null>(null);
const editingCreatedAt = ref('');
const saving = ref(false);
const filterText = ref('');
const filterType = ref('all');
const dateFrom = ref('');
const dateTo = ref('');
const currentPage = ref(1);
const pageSize = 8;

const recentEvents = computed(() => [...store.lifeEvents].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
const filteredEvents = computed(() => recentEvents.value.filter((event) => {
  const query = filterText.value.trim().toLocaleLowerCase('ru-RU');
  return (!query || `${event.title} ${event.note}`.toLocaleLowerCase('ru-RU').includes(query))
    && (filterType.value === 'all' || event.type === filterType.value)
    && (!dateFrom.value || event.date >= dateFrom.value)
    && (!dateTo.value || event.date <= dateTo.value);
}));
const pageCount = computed(() => countPages(filteredEvents.value.length, pageSize));
const visibleEvents = computed(() => pageItems(filteredEvents.value, currentPage.value, pageSize));
watch([filterText, filterType, dateFrom, dateTo], () => { currentPage.value = 1; });
watch(pageCount, (count) => { currentPage.value = Math.min(currentPage.value, count); });

async function saveEvent() {
  const cleanTitle = title.value.trim();
  if (!cleanTitle) return;
  saving.value = true;
  const wasEditing = editingId.value !== null;
  try {
    if (editingId.value === null) {
      await store.addLifeEvent({ date: date.value, type: type.value, title: cleanTitle, note: note.value.trim() });
    } else {
      await store.updateLifeEvent({ id: editingId.value, createdAt: editingCreatedAt.value, date: date.value, type: type.value, title: cleanTitle, note: note.value.trim() });
    }
    resetForm();
    notifySaved(wasEditing ? 'Событие обновлено' : 'Событие добавлено');
  } catch (error) {
    notifyUnknownError(error, 'Не удалось сохранить событие');
  } finally {
    saving.value = false;
  }
}

function edit(event: LifeEventRecord) {
  if (event.id === undefined) return;
  editingId.value = event.id;
  editingCreatedAt.value = event.createdAt;
  title.value = event.title;
  note.value = event.note;
  date.value = event.date;
  type.value = event.type;
}

function resetForm() {
  editingId.value = null;
  editingCreatedAt.value = '';
  title.value = '';
  note.value = '';
  date.value = todayKey();
  type.value = 'change';
}

async function remove(id?: number) {
  if (id === undefined || !window.confirm('Удалить это событие?')) return;
  await store.removeLifeEvent(id);
  if (editingId.value === id) resetForm();
  notifyInfo('Событие удалено');
}

function eventMeta(value: LifeEventRecord['type']) {
  return lifeEventTypeOptions.find((option) => option.id === value) ?? lifeEventTypeOptions[0];
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div><span class="eyebrow">Жизненный контекст</span><h1>События и инсайты</h1><p>Важные изменения, решения, наблюдения и обстоятельства, которые помогают увидеть траекторию.</p></div>
    </div>

    <article class="result-composer">
      <div class="form-card__heading"><span class="section-icon section-icon--amber">◆</span><div><h2>{{ editingId === null ? 'Добавить запись' : 'Редактировать запись' }}</h2><p>Событие меняет контекст, инсайт сохраняет важное понимание.</p></div></div>
      <ChipGroup v-model="type" :options="lifeEventTypeOptions" />
      <div class="event-composer__fields">
        <input v-model="title" type="text" maxlength="140" placeholder="Например: решил сменить направление поиска работы" @keyup.enter="saveEvent" />
        <input v-model="date" class="date-input" type="date" aria-label="Дата события" />
      </div>
      <textarea v-model="note" rows="2" maxlength="360" placeholder="Контекст, если он важен. Без обязательного анализа." />
      <button class="primary-button" type="button" :disabled="!title.trim() || saving" @click="saveEvent">{{ editingId === null ? 'Добавить запись' : 'Сохранить запись' }}</button>
      <button v-if="editingId !== null" class="secondary-button composer-cancel" type="button" @click="resetForm">Отменить редактирование</button>
    </article>

    <div class="section-heading"><div><span class="eyebrow">Хронология</span><h2>Важные события</h2></div><span class="count-badge">{{ filteredEvents.length }}</span></div>
    <div class="archive-filters">
      <input v-model="filterText" type="search" placeholder="Поиск по событиям" aria-label="Поиск по событиям" />
      <select v-model="filterType" aria-label="Тип события"><option value="all">Все типы</option><option v-for="option in lifeEventTypeOptions" :key="option.id" :value="option.id">{{ option.label }}</option></select>
      <label><span>С</span><input v-model="dateFrom" type="date" /></label>
      <label><span>По</span><input v-model="dateTo" type="date" /></label>
    </div>
    <div v-if="visibleEvents.length" class="timeline-list">
      <article v-for="event in visibleEvents" :key="event.id" class="timeline-item">
        <span class="timeline-item__icon">{{ eventMeta(event.type).icon }}</span>
        <div>
          <strong>{{ event.title }}</strong>
          <small>{{ eventMeta(event.type).label }} · {{ formatDate(event.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</small>
          <p v-if="event.note">{{ event.note }}</p>
        </div>
        <div class="item-actions">
          <button class="ghost-button" type="button" aria-label="Редактировать событие" @click="edit(event)">✎</button>
          <button class="ghost-button ghost-button--danger" type="button" aria-label="Удалить событие" @click="remove(event.id)">×</button>
        </div>
      </article>
      <nav v-if="pageCount > 1" class="archive-pagination" aria-label="Страницы событий">
        <button class="secondary-button" type="button" :disabled="currentPage === 1" @click="currentPage -= 1">Назад</button>
        <span>{{ currentPage }} из {{ pageCount }}</span>
        <button class="secondary-button" type="button" :disabled="currentPage === pageCount" @click="currentPage += 1">Дальше</button>
      </nav>
    </div>
    <div v-else class="empty-state"><span>◆</span><h3>{{ recentEvents.length ? 'Ничего не найдено' : 'Событий пока нет' }}</h3><p>{{ recentEvents.length ? 'Измени фильтры или диапазон дат.' : 'Здесь будут решения, изменения и обстоятельства, которые помогают объяснять длинную динамику.' }}</p></div>
  </section>
</template>
