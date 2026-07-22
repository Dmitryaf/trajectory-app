<script setup lang="ts">
import { computed, ref } from 'vue';
import ChipGroup from '../components/ChipGroup.vue';
import ArchiveDateRange from '../features/journal/ArchiveDateRange.vue';
import ArchivePagination from '../features/journal/ArchivePagination.vue';
import { useArchiveList } from '../features/journal/useArchiveList';
import { formatDate, todayKey } from '../services/dates';
import { notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
import { useAppStore } from '../stores/app';
import { resultAreaOptions, type ResultRecord } from '../types';

const store = useAppStore();
const title = ref('');
const date = ref(todayKey());
const area = ref<ResultRecord['area']>('career');
const editingId = ref<number | null>(null);
const editingCreatedAt = ref('');
const saving = ref(false);
const recentResults = computed(() => [...store.results].sort((a, b) => b.date.localeCompare(a.date)));
const resultOptions = computed(() => [...resultAreaOptions, ...store.settings.customLifeAreaOptions]);
const resultEntryOptions = computed(() => [...resultAreaOptions, ...store.settings.customLifeAreaOptions.filter((option) => !option.archived)]);
const {
  filterText,
  filterCategory: filterArea,
  dateFrom,
  dateTo,
  currentPage,
  filteredItems: filteredResults,
  pageCount,
  visibleItems: visibleResults
} = useArchiveList(recentResults, {
  getSearchText: (result) => result.title,
  getCategory: (result) => result.area
});

async function saveResult() {
  const clean = title.value.trim();
  if (!clean) return;
  saving.value = true;
  const wasEditing = editingId.value !== null;
  try {
    if (editingId.value === null) {
      await store.addResult({ date: date.value, area: area.value, title: clean });
    } else {
      await store.updateResult({ id: editingId.value, createdAt: editingCreatedAt.value, date: date.value, area: area.value, title: clean });
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
  date.value = result.date;
  area.value = result.area;
}

function resetForm() {
  editingId.value = null;
  editingCreatedAt.value = '';
  title.value = '';
  date.value = todayKey();
  area.value = 'career';
}

async function remove(id?: number) {
  if (id === undefined || !window.confirm('Удалить этот итог?')) return;
  await store.removeResult(id);
  if (editingId.value === id) resetForm();
  notifyInfo('Итог удалён');
}

function areaMeta(value: ResultRecord['area']) {
  return resultOptions.value.find((option) => option.id === value) ?? { id: value, label: value, icon: '+' };
}
</script>

<template>
  <section class="page page--archive page--results">
    <div class="page-heading">
      <div><span class="eyebrow">Завершённое</span><h1>Итоги</h1><p>Здесь можно сохранить выполненное дело, полученный результат или другое важное завершение.</p></div>
    </div>

    <article class="result-composer result-composer--results">
      <div class="form-card__heading"><span class="section-icon section-icon--green">✓</span><div><h2>{{ editingId === null ? 'Добавить итог' : 'Редактировать итог' }}</h2><p>Коротко запиши, что завершилось или какой результат получен.</p></div></div>
      <ChipGroup v-model="area" :options="resultEntryOptions" />
      <div class="result-composer__fields">
        <input v-model="title" type="text" maxlength="160" placeholder="Например: закончил курс или завершил важное дело" @keyup.enter="saveResult" />
        <input v-model="date" class="date-input" type="date" aria-label="Дата итога" />
        <button class="primary-button" type="button" :disabled="!title.trim() || saving" @click="saveResult">{{ editingId === null ? 'Добавить итог' : 'Сохранить итог' }}</button>
      </div>
      <button v-if="editingId !== null" class="secondary-button composer-cancel" type="button" @click="resetForm">Отменить редактирование</button>
    </article>

    <section class="archive-panel">
      <div class="section-heading"><div><span class="eyebrow">Архив</span><h2>Итоги</h2></div><span class="count-badge">{{ filteredResults.length }}</span></div>
      <div class="archive-filters">
        <input v-model="filterText" type="search" placeholder="Поиск по итогам" aria-label="Поиск по итогам" />
        <select v-model="filterArea" aria-label="Область итога"><option value="all">Все области</option><option v-for="option in resultOptions" :key="option.id" :value="option.id">{{ option.label }}</option></select>
        <ArchiveDateRange v-model:date-from="dateFrom" v-model:date-to="dateTo" context-label="итогов" />
      </div>
      <div v-if="visibleResults.length">
        <TransitionGroup name="archive-list" tag="div" class="results-list">
        <article v-for="result in visibleResults" :key="result.id ?? result.createdAt" class="result-item">
          <span class="result-item__icon">{{ areaMeta(result.area).icon }}</span>
          <div><strong>{{ result.title }}</strong><small>{{ areaMeta(result.area).label }} · {{ formatDate(result.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</small></div>
          <div class="item-actions">
            <button class="ghost-button" type="button" aria-label="Редактировать итог" @click="edit(result)">✎</button>
            <button class="ghost-button ghost-button--danger" type="button" aria-label="Удалить итог" @click="remove(result.id)">×</button>
          </div>
        </article>
        </TransitionGroup>
        <ArchivePagination v-model:page="currentPage" :page-count="pageCount" context-label="итогов" />
      </div>
      <div v-else class="empty-state"><span>✓</span><h3>{{ recentResults.length ? 'Ничего не найдено' : 'Итогов пока нет' }}</h3><p>{{ recentResults.length ? 'Измени фильтры или диапазон дат.' : 'Добавь первое завершённое дело или полученный результат.' }}</p></div>
    </section>
  </section>
</template>
