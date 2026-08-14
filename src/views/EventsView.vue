<script setup lang="ts">
import { computed, ref } from 'vue';
import ArchiveDateRange from '../features/journal/ui/ArchiveDateRange.vue';
import ArchivePagination from '../features/journal/ui/ArchivePagination.vue';
import AutoGrowTextarea from '../shared/ui/forms/AutoGrowTextarea.vue';
import ChipGroup from '../shared/ui/forms/ChipGroup.vue';
import { archiveRangeFromQuery } from '../features/journal/archiveQuery';
import { useArchiveList } from '../features/journal/useArchiveList';
import { formatDate, todayKey } from '../services/dates';
import { notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
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
const removingIds = ref<number[]>([]);
const expandedNotes = ref<string[]>([]);
const archiveRange = archiveRangeFromQuery();

const recentEvents = computed(() =>
  [...store.lifeEvents].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
);
const {
  filterText,
  filterCategory: filterType,
  dateFrom,
  dateTo,
  currentPage,
  filteredItems: filteredEvents,
  pageCount,
  visibleItems: visibleEvents,
} = useArchiveList(recentEvents, {
  getSearchText: (event) => `${event.title} ${event.note}`,
  getCategory: (event) => event.type,
  ...archiveRange,
});

async function saveEvent() {
  const cleanTitle = title.value.trim();
  if (!cleanTitle) return;
  saving.value = true;
  const wasEditing = editingId.value !== null;
  try {
    if (editingId.value === null) {
      await store.addLifeEvent({ date: date.value, type: type.value, title: cleanTitle, note: note.value.trim() });
    } else {
      await store.updateLifeEvent({
        id: editingId.value,
        createdAt: editingCreatedAt.value,
        date: date.value,
        type: type.value,
        title: cleanTitle,
        note: note.value.trim(),
      });
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
  if (id === undefined || removingIds.value.includes(id) || !window.confirm('Удалить это событие?')) return;
  removingIds.value.push(id);
  try {
    await store.removeLifeEvent(id);
    if (editingId.value === id) resetForm();
    notifyInfo('Событие удалено');
  } catch (error) {
    notifyUnknownError(error, 'Не удалось удалить событие');
  } finally {
    removingIds.value = removingIds.value.filter((item) => item !== id);
  }
}

function eventMeta(value: LifeEventRecord['type']) {
  return lifeEventTypeOptions.find((option) => option.id === value) ?? lifeEventTypeOptions[0];
}

function eventKey(event: LifeEventRecord) {
  return String(event.id ?? event.createdAt);
}

function noteIsExpanded(event: LifeEventRecord) {
  return expandedNotes.value.includes(eventKey(event));
}

function toggleNote(event: LifeEventRecord) {
  const key = eventKey(event);
  expandedNotes.value = expandedNotes.value.includes(key)
    ? expandedNotes.value.filter((item) => item !== key)
    : [...expandedNotes.value, key];
}
</script>

<template>
  <section class="page page--archive page--events">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Что произошло и что вы заметили</span>
        <h1>События и наблюдения</h1>
        <p>
          Событие — ситуация, которую важно помнить. Мысль или наблюдение может быть обычной деталью дня, к которой захочется вернуться.
        </p>
      </div>
    </div>

    <article class="result-composer result-composer--events">
      <div class="form-card__heading">
        <span class="section-icon section-icon--amber">◆</span>
        <div>
          <h2>{{ editingId === null ? 'Добавить запись' : 'Редактировать запись' }}</h2>
          <p>Выберите, что хотите записать: произошедшее событие или важную мысль.</p>
        </div>
      </div>
      <ChipGroup v-model="type" :options="lifeEventTypeOptions" />
      <div class="event-composer__fields">
        <input v-model="title" type="text" maxlength="140" placeholder="Короткое название" @keyup.enter="saveEvent" />
        <input v-model="date" class="date-input" type="date" aria-label="Дата события" />
      </div>
      <AutoGrowTextarea v-model="note" :rows="4" :max-length="2000" placeholder="Что произошло или что вы поняли и почему это важно" />
      <button class="primary-button" type="button" :disabled="!title.trim() || saving" @click="saveEvent">
        {{ editingId === null ? 'Добавить запись' : 'Сохранить запись' }}
      </button>
      <button v-if="editingId !== null" class="secondary-button composer-cancel" type="button" @click="resetForm">
        Отменить редактирование
      </button>
    </article>

    <section class="archive-panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Хронология</span>
          <h2>События и важные мысли</h2>
        </div>
        <span class="count-badge">{{ filteredEvents.length }}</span>
      </div>
      <div class="archive-filters">
        <input v-model="filterText" type="search" placeholder="Поиск по событиям" aria-label="Поиск по событиям" />
        <select v-model="filterType" aria-label="Тип события">
          <option value="all">Все типы</option>
          <option v-for="option in lifeEventTypeOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
        </select>
        <ArchiveDateRange v-model:date-from="dateFrom" v-model:date-to="dateTo" context-label="событий" />
      </div>
      <div v-if="visibleEvents.length">
        <TransitionGroup name="archive-list" tag="div" class="timeline-list">
          <article v-for="event in visibleEvents" :key="eventKey(event)" class="timeline-item">
            <span class="timeline-item__icon">{{ eventMeta(event.type).icon }}</span>
            <div>
              <strong>{{ event.title }}</strong>
              <small
                >{{ eventMeta(event.type).label }} ·
                {{ formatDate(event.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</small
              >
              <p
                v-if="event.note"
                :id="`event-note-${eventKey(event)}`"
                class="timeline-item__note"
                :class="{ 'timeline-item__note--clamped': event.note.length > 240 && !noteIsExpanded(event) }"
              >
                {{ event.note }}
              </p>
              <button
                v-if="event.note.length > 240"
                class="timeline-item__note-toggle"
                type="button"
                :aria-expanded="noteIsExpanded(event)"
                :aria-controls="`event-note-${eventKey(event)}`"
                @click="toggleNote(event)"
              >
                {{ noteIsExpanded(event) ? 'Свернуть' : 'Показать полностью' }}
              </button>
            </div>
            <div class="item-actions">
              <button class="ghost-button" type="button" aria-label="Редактировать событие" @click="edit(event)">✎</button>
              <button
                class="ghost-button ghost-button--danger"
                type="button"
                aria-label="Удалить событие"
                :disabled="event.id !== undefined && removingIds.includes(event.id)"
                @click="remove(event.id)"
              >
                ×
              </button>
            </div>
          </article>
        </TransitionGroup>
        <ArchivePagination v-model:page="currentPage" :page-count="pageCount" context-label="событий" />
      </div>
      <div v-else class="empty-state">
        <span>◆</span>
        <h3>{{ recentEvents.length ? 'Ничего не найдено' : 'Записей пока нет' }}</h3>
        <p>{{ recentEvents.length ? 'Измените фильтры или диапазон дат.' : 'Добавьте первое важное событие или понимание.' }}</p>
      </div>
    </section>
  </section>
</template>
