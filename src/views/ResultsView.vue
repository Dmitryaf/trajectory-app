<script setup lang="ts">
import { computed, ref } from 'vue';
import ArchiveDateRange from '../features/journal/ui/ArchiveDateRange.vue';
import ArchivePagination from '../features/journal/ui/ArchivePagination.vue';
import AutoGrowTextarea from '../shared/ui/forms/AutoGrowTextarea.vue';
import ChipGroup from '../shared/ui/forms/ChipGroup.vue';
import { archiveRangeFromQuery } from '../features/journal/archiveQuery';
import { useArchiveList } from '../features/journal/useArchiveList';
import { formatDate, todayKey } from '../services/dates';
import { notifyError, notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
import { useAppStore } from '../stores/app';
import { resultAreaOptions, type ResultRecord } from '../types';

const store = useAppStore();
const title = ref('');
const note = ref('');
const date = ref(todayKey());
const area = ref<ResultRecord['area']>('career');
const editingId = ref<number | null>(null);
const editingCreatedAt = ref('');
const saving = ref(false);
const removingIds = ref<number[]>([]);
const expandedNotes = ref<string[]>([]);
const archiveRange = archiveRangeFromQuery();
const recentResults = computed(() => [...store.results].sort((a, b) => b.date.localeCompare(a.date)));
const resultOptions = computed(() => [...resultAreaOptions, ...store.settings.customLifeAreaOptions]);
const resultEntryOptions = computed(() => [
  ...resultAreaOptions,
  ...store.settings.customLifeAreaOptions.filter((option) => !option.archived || option.id === area.value),
]);
const {
  filterText,
  filterCategory: filterArea,
  dateFrom,
  dateTo,
  currentPage,
  filteredItems: filteredResults,
  pageCount,
  visibleItems: visibleResults,
} = useArchiveList(recentResults, {
  getSearchText: (result) => `${result.title} ${result.note}`,
  getCategory: (result) => result.area,
  ...archiveRange,
});

async function saveResult() {
  const clean = title.value.trim();
  if (!clean) return;
  if (!date.value) {
    notifyError('Укажите дату итога');
    return;
  }
  saving.value = true;
  const wasEditing = editingId.value !== null;
  try {
    if (editingId.value === null) {
      await store.addResult({ date: date.value, area: area.value, title: clean, note: note.value.trim() });
    } else {
      await store.updateResult({
        id: editingId.value,
        createdAt: editingCreatedAt.value,
        date: date.value,
        area: area.value,
        title: clean,
        note: note.value.trim(),
      });
    }
    resetForm();
    notifySaved(wasEditing ? 'Итог обновлён' : 'Итог добавлен');
  } catch (error) {
    notifyUnknownError(error, 'Не удалось сохранить итог');
  } finally {
    saving.value = false;
  }
}

function edit(result: ResultRecord) {
  if (result.id === undefined) return;
  editingId.value = result.id;
  editingCreatedAt.value = result.createdAt;
  title.value = result.title;
  note.value = result.note;
  date.value = result.date;
  area.value = result.area;
}

function resetForm() {
  editingId.value = null;
  editingCreatedAt.value = '';
  title.value = '';
  note.value = '';
  date.value = todayKey();
  area.value = 'career';
}

async function remove(id?: number) {
  if (id === undefined || removingIds.value.includes(id) || !window.confirm('Удалить этот итог?')) return;
  removingIds.value.push(id);
  try {
    await store.removeResult(id);
    if (editingId.value === id) resetForm();
    notifyInfo('Итог удалён');
  } catch (error) {
    notifyUnknownError(error, 'Не удалось удалить итог');
  } finally {
    removingIds.value = removingIds.value.filter((item) => item !== id);
  }
}

function areaMeta(value: ResultRecord['area']) {
  return resultOptions.value.find((option) => option.id === value) ?? { id: value, label: value, icon: '+' };
}

function resultKey(result: ResultRecord) {
  return String(result.id ?? result.createdAt);
}

function noteIsExpanded(result: ResultRecord) {
  return expandedNotes.value.includes(resultKey(result));
}

function toggleNote(result: ResultRecord) {
  const key = resultKey(result);
  expandedNotes.value = expandedNotes.value.includes(key)
    ? expandedNotes.value.filter((item) => item !== key)
    : [...expandedNotes.value, key];
}
</script>

<template>
  <section class="page page--archive page--results">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Конкретные результаты</span>
        <h1>Итоги</h1>
        <p>Итог — конкретное сделанное дело или полученный результат.</p>
      </div>
    </div>

    <article class="result-composer result-composer--results">
      <div class="form-card__heading">
        <span class="section-icon section-icon--green">✓</span>
        <div>
          <h2>{{ editingId === null ? 'Добавить итог' : 'Редактировать итог' }}</h2>
          <p>Запишите одним предложением, что вы сделали или какой результат получили.</p>
        </div>
      </div>
      <ChipGroup v-model="area" :options="resultEntryOptions" />
      <div class="result-composer__fields">
        <input
          v-model="title"
          type="text"
          maxlength="160"
          placeholder="Что вы сделали или какой результат получили"
          @keyup.enter="saveResult"
        />
        <input v-model="date" class="date-input" type="date" required aria-label="Дата итога" />
        <button class="primary-button" type="button" :disabled="!title.trim() || !date || saving" @click="saveResult">
          {{ editingId === null ? 'Добавить итог' : 'Сохранить итог' }}
        </button>
      </div>
      <AutoGrowTextarea
        v-model="note"
        :rows="4"
        :max-length="2000"
        placeholder="Что произошло, почему это важно или какой контекст стоит сохранить"
      />
      <button v-if="editingId !== null" class="secondary-button composer-cancel" type="button" @click="resetForm">
        Отменить редактирование
      </button>
    </article>

    <section class="archive-panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Архив</span>
          <h2>Итоги</h2>
        </div>
        <span class="count-badge">{{ filteredResults.length }}</span>
      </div>
      <div class="archive-filters">
        <input v-model="filterText" type="search" placeholder="Поиск по итогам" aria-label="Поиск по итогам" />
        <select v-model="filterArea" aria-label="Область итога">
          <option value="all">Все области</option>
          <option v-for="option in resultOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
        </select>
        <ArchiveDateRange v-model:date-from="dateFrom" v-model:date-to="dateTo" context-label="итогов" />
      </div>
      <div v-if="visibleResults.length">
        <TransitionGroup name="archive-list" tag="div" class="results-list">
          <article v-for="result in visibleResults" :key="result.id ?? result.createdAt" class="result-item">
            <span class="result-item__icon">{{ areaMeta(result.area).icon }}</span>
            <div class="result-item__content">
              <strong>{{ result.title }}</strong
              ><small
                >{{ areaMeta(result.area).label }} ·
                {{ formatDate(result.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</small
              >
              <p
                v-if="result.note"
                :id="`result-note-${resultKey(result)}`"
                class="result-item__note"
                :class="{ 'result-item__note--clamped': result.note.length > 240 && !noteIsExpanded(result) }"
              >
                {{ result.note }}
              </p>
              <button
                v-if="result.note.length > 240"
                class="result-item__note-toggle"
                type="button"
                :aria-expanded="noteIsExpanded(result)"
                :aria-controls="`result-note-${resultKey(result)}`"
                @click="toggleNote(result)"
              >
                {{ noteIsExpanded(result) ? 'Свернуть' : 'Показать полностью' }}
              </button>
            </div>
            <div class="item-actions">
              <button class="ghost-button" type="button" aria-label="Редактировать итог" @click="edit(result)">✎</button>
              <button
                class="ghost-button ghost-button--danger"
                type="button"
                aria-label="Удалить итог"
                :disabled="result.id !== undefined && removingIds.includes(result.id)"
                @click="remove(result.id)"
              >
                ×
              </button>
            </div>
          </article>
        </TransitionGroup>
        <ArchivePagination v-model:page="currentPage" :page-count="pageCount" context-label="итогов" />
      </div>
      <div v-else class="empty-state">
        <span>✓</span>
        <h3>{{ recentResults.length ? 'Ничего не найдено' : 'Итогов пока нет' }}</h3>
        <p>
          {{ recentResults.length ? 'Измените фильтры или диапазон дат.' : 'Добавьте первое сделанное дело или полученный результат.' }}
        </p>
      </div>
    </section>
  </section>
</template>
