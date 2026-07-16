<script setup lang="ts">
import { computed, ref } from 'vue';
import ChipGroup from '../components/ChipGroup.vue';
import { formatDate, todayKey } from '../services/dates';
import { useAppStore } from '../stores/app';
import { resultAreaOptions, type ResultRecord } from '../types';

const store = useAppStore();
const title = ref('');
const date = ref(todayKey());
const area = ref<ResultRecord['area']>('career');
const saving = ref(false);
const recentResults = computed(() => [...store.results].sort((a, b) => b.date.localeCompare(a.date)));
const resultOptions = computed(() => [...resultAreaOptions, ...store.settings.customLifeAreaOptions]);

async function addResult() {
  const clean = title.value.trim();
  if (!clean) return;
  saving.value = true;
  await store.addResult({ date: date.value, area: area.value, title: clean });
  title.value = '';
  saving.value = false;
}

async function remove(id?: number) {
  if (id === undefined || !window.confirm('Удалить этот результат?')) return;
  await store.removeResult(id);
}

function areaMeta(value: ResultRecord['area']) {
  return resultOptions.value.find((option) => option.id === value) ?? { id: value, label: value, icon: '+' };
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div><span class="eyebrow">Не просто активность</span><h1>Результаты</h1><p>Законченные вещи, которые останутся видны в итогах месяца.</p></div>
    </div>

    <article class="result-composer">
      <div class="form-card__heading"><span class="section-icon section-icon--green">✓</span><div><h2>Добавить результат</h2><p>Коротко и конкретно.</p></div></div>
      <ChipGroup v-model="area" :options="resultOptions" />
      <div class="result-composer__fields">
        <input v-model="title" type="text" maxlength="160" placeholder="Например: прошёл техническое собеседование" @keyup.enter="addResult" />
        <input v-model="date" class="date-input" type="date" aria-label="Дата результата" />
        <button class="primary-button" type="button" :disabled="!title.trim() || saving" @click="addResult">Добавить</button>
      </div>
    </article>

    <div class="section-heading"><div><span class="eyebrow">Архив фактов</span><h2>Все результаты</h2></div><span class="count-badge">{{ recentResults.length }}</span></div>
    <div v-if="recentResults.length" class="results-list">
      <article v-for="result in recentResults" :key="result.id" class="result-item">
        <span class="result-item__icon">{{ areaMeta(result.area).icon }}</span>
        <div><strong>{{ result.title }}</strong><small>{{ areaMeta(result.area).label }} · {{ formatDate(result.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</small></div>
        <button class="ghost-button ghost-button--danger" type="button" aria-label="Удалить результат" @click="remove(result.id)">×</button>
      </article>
    </div>
    <div v-else class="empty-state"><span>✓</span><h3>Результатов пока нет</h3><p>Они появятся здесь и в месячном обзоре.</p></div>
  </section>
</template>
