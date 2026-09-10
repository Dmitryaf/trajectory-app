<script setup lang="ts">
import ActionButton from '@/shared/ui/actions/ActionButton.vue';
import { computed, nextTick, onMounted, ref } from 'vue';
import ArchiveDateRange from '../features/journal/ui/ArchiveDateRange.vue';
import ArchiveItemActions from '../features/journal/ui/ArchiveItemActions.vue';
import ArchivePage from '../features/journal/ui/ArchivePage.vue';
import ArchivePagination from '../features/journal/ui/ArchivePagination.vue';
import JournalComposerReturn from '../features/journal/ui/JournalComposerReturn.vue';
import AutoGrowTextarea from '../shared/ui/forms/AutoGrowTextarea.vue';
import ChipGroup from '../shared/ui/forms/ChipGroup.vue';
import FormCardHeading from '../shared/ui/forms/FormCardHeading.vue';
import DateInput from '../shared/ui/forms/DateInput.vue';
import ClampedText from '../shared/ui/content/ClampedText.vue';
import IconActionButton from '../shared/ui/actions/IconActionButton.vue';
import { archiveRangeFromQuery } from '../features/journal/archiveQuery';
import { useArchiveList } from '../features/journal/useArchiveList';
import { formatDate, todayKey } from '../services/dates';
import { notifyError, notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
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
const titleInput = ref<HTMLInputElement>();
const journalComposeRequested = new URLSearchParams(window.location.search).get('compose') === 'journal';
const archiveRange = archiveRangeFromQuery();

const recentEvents = computed(() =>
  [...store.lifeEvents].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
);
const createDraftDirty = computed(() => Boolean(title.value || note.value) || date.value !== todayKey() || type.value !== 'change');
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
  if (!cleanTitle) {
    return;
  }
  if (!date.value) {
    notifyError('Укажите дату события');
    return;
  }
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
  if (event.id === undefined) {
    return;
  }
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
  if (id === undefined || removingIds.value.includes(id) || !window.confirm('Удалить это событие?')) {
    return;
  }
  removingIds.value.push(id);
  try {
    await store.removeLifeEvent(id);
    if (editingId.value === id) {
      resetForm();
    }
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

onMounted(async () => {
  if (!journalComposeRequested) {
    return;
  }
  await nextTick();
  titleInput.value?.focus();
});
</script>

<template>
  <ArchivePage
    tone="events"
    heading-eyebrow="Что произошло и что вы заметили"
    heading-title="События и наблюдения"
    heading-description="Событие — ситуация, которую важно помнить. Мысль или наблюдение может быть обычной деталью дня, к которой захочется вернуться."
    archive-eyebrow="Хронология"
    archive-title="События и важные мысли"
    :count="filteredEvents.length"
    :has-items="visibleEvents.length > 0"
    empty-icon="event"
    :empty-title="recentEvents.length ? 'Ничего не найдено' : 'Записей пока нет'"
    :empty-description="recentEvents.length ? 'Измените фильтры или диапазон дат.' : 'Добавьте первое важное событие или понимание.'"
  >
    <template #composer>
      <FormCardHeading icon="event" tone="amber">
        <div>
          <h2>{{ editingId === null ? 'Добавить запись' : 'Редактировать запись' }}</h2>
          <p>Выберите, что хотите записать: произошедшее событие или важную мысль.</p>
        </div>
      </FormCardHeading>
      <ChipGroup v-model="type" :options="lifeEventTypeOptions" />
      <div class="event-composer__fields">
        <input ref="titleInput" v-model="title" type="text" maxlength="140" placeholder="Короткое название" @keyup.enter="saveEvent" />
        <DateInput v-model="date" required aria-label="Дата события" />
      </div>
      <AutoGrowTextarea v-model="note" :rows="4" :max-length="2000" placeholder="Что произошло или что вы поняли и почему это важно" />
      <ActionButton variant="primary" type="button" :disabled="!title.trim() || !date || saving" @click="saveEvent">
        {{ editingId === null ? 'Добавить запись' : 'Сохранить запись' }}
      </ActionButton>
      <ActionButton v-if="editingId !== null" variant="secondary" class="composer-cancel" type="button" @click="resetForm">
        Отменить редактирование
      </ActionButton>
      <JournalComposerReturn v-else-if="journalComposeRequested" :dirty="createDraftDirty" @discard="resetForm" />
    </template>
    <template #filters>
      <input v-model="filterText" type="search" placeholder="Поиск по событиям" aria-label="Поиск по событиям" />
      <select v-model="filterType" aria-label="Тип события">
        <option value="all">Все типы</option>
        <option v-for="option in lifeEventTypeOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
      </select>
      <ArchiveDateRange v-model:date-from="dateFrom" v-model:date-to="dateTo" context-label="событий" />
    </template>
    <div>
      <TransitionGroup name="archive-list" tag="div" class="timeline-list">
        <article v-for="event in visibleEvents" :key="eventKey(event)" class="timeline-item">
          <span class="timeline-item__icon">{{ eventMeta(event.type).icon }}</span>
          <div>
            <strong>{{ event.title }}</strong>
            <small
              >{{ eventMeta(event.type).label }} · {{ formatDate(event.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</small
            >
            <ClampedText
              v-if="event.note"
              :text="event.note"
              :content-id="`event-note-${eventKey(event)}`"
              text-class="timeline-item__note"
              tone="event"
            />
          </div>
          <ArchiveItemActions>
            <IconActionButton icon="edit" label="Редактировать событие" @click="edit(event)" />
            <IconActionButton
              icon="delete"
              danger
              label="Удалить событие"
              :disabled="event.id !== undefined && removingIds.includes(event.id)"
              @click="remove(event.id)"
            />
          </ArchiveItemActions>
        </article>
      </TransitionGroup>
      <ArchivePagination v-model:page="currentPage" :page-count="pageCount" context-label="событий" />
    </div>
  </ArchivePage>
</template>

<style scoped src="./EventsView.css"></style>
