<script setup lang="ts">
import ActionButton from '@/shared/ui/actions/ActionButton.vue';
import { computed, ref } from 'vue';
import ArchiveDateRange from '../features/journal/ui/ArchiveDateRange.vue';
import ArchiveItemActions from '../features/journal/ui/ArchiveItemActions.vue';
import ArchivePage from '../features/journal/ui/ArchivePage.vue';
import ArchivePagination from '../features/journal/ui/ArchivePagination.vue';
import AutoGrowTextarea from '../shared/ui/forms/AutoGrowTextarea.vue';
import ChipGroup from '../shared/ui/forms/ChipGroup.vue';
import FormCardHeading from '../shared/ui/forms/FormCardHeading.vue';
import DateInput from '../shared/ui/forms/DateInput.vue';
import ClampedText from '../shared/ui/content/ClampedText.vue';
import IconActionButton from '../shared/ui/actions/IconActionButton.vue';
import StableHeightTransitionGroup from '../shared/ui/layout/StableHeightTransitionGroup.vue';
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
  if (!clean) {
    return;
  }
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
  if (result.id === undefined) {
    return;
  }
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
  if (id === undefined || removingIds.value.includes(id) || !window.confirm('Удалить этот итог?')) {
    return;
  }
  removingIds.value.push(id);
  try {
    await store.removeResult(id);
    if (editingId.value === id) {
      resetForm();
    }
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
</script>

<template>
  <ArchivePage
    tone="results"
    heading-eyebrow="Конкретные результаты"
    heading-title="Итоги"
    heading-description="Сделанное дело или полученный результат."
    archive-eyebrow="Архив"
    archive-title="Итоги"
    :count="filteredResults.length"
    :has-items="visibleResults.length > 0"
    empty-icon="result"
    :empty-title="recentResults.length ? 'Ничего не найдено' : 'Итогов пока нет'"
    :empty-description="
      recentResults.length ? 'Измените фильтры или диапазон дат.' : 'Добавьте первое сделанное дело или полученный результат.'
    "
  >
    <template #composer>
      <FormCardHeading icon="result" tone="green">
        <div>
          <h2>{{ editingId === null ? 'Добавить итог' : 'Редактировать итог' }}</h2>
          <p>Запишите одним предложением, что вы сделали или какой результат получили.</p>
        </div>
      </FormCardHeading>
      <ChipGroup v-model="area" :options="resultEntryOptions" />
      <div class="result-composer__fields">
        <input
          v-model="title"
          type="text"
          maxlength="160"
          placeholder="Что вы сделали или какой результат получили"
          @keyup.enter="saveResult"
        />
        <DateInput v-model="date" required aria-label="Дата итога" />
        <ActionButton variant="primary" type="button" :disabled="!title.trim() || !date || saving" @click="saveResult">
          {{ editingId === null ? 'Добавить итог' : 'Сохранить итог' }}
        </ActionButton>
      </div>
      <AutoGrowTextarea
        v-model="note"
        :rows="4"
        :max-length="2000"
        placeholder="Что произошло, почему это важно или какой контекст стоит сохранить"
      />
      <ActionButton v-if="editingId !== null" variant="secondary" class="composer-cancel" type="button" @click="resetForm">
        Отменить редактирование
      </ActionButton>
    </template>
    <template #filters>
      <label class="archive-filter-field">
        <span class="archive-filter-field__label">Поиск</span>
        <input v-model="filterText" type="search" placeholder="Поиск по итогам" aria-label="Поиск по итогам" />
      </label>
      <label class="archive-filter-field">
        <span class="archive-filter-field__label">Область</span>
        <select v-model="filterArea" aria-label="Область итога">
          <option value="all">Все области</option>
          <option v-for="option in resultOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
        </select>
      </label>
      <ArchiveDateRange v-model:date-from="dateFrom" v-model:date-to="dateTo" context-label="итогов" />
    </template>
    <div>
      <StableHeightTransitionGroup name="archive-list" :change-key="currentPage" tag="div" class="results-list">
        <article v-for="result in visibleResults" :key="result.id ?? result.createdAt" class="result-item">
          <span class="result-item__icon">{{ areaMeta(result.area).icon }}</span>
          <div class="result-item__content">
            <strong>{{ result.title }}</strong
            ><small
              >{{ areaMeta(result.area).label }} · {{ formatDate(result.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</small
            >
            <ClampedText
              v-if="result.note"
              :text="result.note"
              :content-id="`result-note-${resultKey(result)}`"
              text-class="result-item__note"
              tone="result"
            />
          </div>
          <ArchiveItemActions>
            <IconActionButton icon="edit" label="Редактировать итог" @click="edit(result)" />
            <IconActionButton
              icon="delete"
              danger
              label="Удалить итог"
              :disabled="result.id !== undefined && removingIds.includes(result.id)"
              @click="remove(result.id)"
            />
          </ArchiveItemActions>
        </article>
      </StableHeightTransitionGroup>
      <ArchivePagination v-model:page="currentPage" :page-count="pageCount" context-label="итогов" />
    </div>
  </ArchivePage>
</template>

<style scoped src="./ResultsView.css"></style>
