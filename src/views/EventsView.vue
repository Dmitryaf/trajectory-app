<script setup lang="ts">
import { computed, ref } from 'vue';
import ChipGroup from '../components/ChipGroup.vue';
import { formatDate, todayKey } from '../services/dates';
import { useAppStore } from '../stores/app';
import { lifeEventTypeOptions, type LifeEventRecord, type LifeEventType } from '../types';

const store = useAppStore();
const title = ref('');
const note = ref('');
const date = ref(todayKey());
const type = ref<LifeEventType>('change');
const saving = ref(false);

const recentEvents = computed(() => [...store.lifeEvents].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));

async function addEvent() {
  const cleanTitle = title.value.trim();
  if (!cleanTitle) return;
  saving.value = true;
  await store.addLifeEvent({ date: date.value, type: type.value, title: cleanTitle, note: note.value.trim() });
  title.value = '';
  note.value = '';
  saving.value = false;
}

async function remove(id?: number) {
  if (id === undefined || !window.confirm('Удалить это событие из архива?')) return;
  await store.removeLifeEvent(id);
}

function eventMeta(value: LifeEventRecord['type']) {
  return lifeEventTypeOptions.find((option) => option.id === value) ?? lifeEventTypeOptions[0];
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div><span class="eyebrow">Длинная дуга</span><h1>Архив</h1><p>Важные изменения, решения и жизненные события отдельно от ежедневного чек-ина.</p></div>
    </div>

    <article class="result-composer">
      <div class="form-card__heading"><span class="section-icon section-icon--amber">◆</span><div><h2>Добавить событие</h2><p>Коротко зафиксируй то, что важно увидеть в будущем.</p></div></div>
      <ChipGroup v-model="type" :options="lifeEventTypeOptions" />
      <div class="event-composer__fields">
        <input v-model="title" type="text" maxlength="140" placeholder="Например: решил сменить направление поиска работы" @keyup.enter="addEvent" />
        <input v-model="date" class="date-input" type="date" aria-label="Дата события" />
      </div>
      <textarea v-model="note" rows="2" maxlength="360" placeholder="Контекст, если он важен. Без обязательного анализа." />
      <button class="primary-button" type="button" :disabled="!title.trim() || saving" @click="addEvent">Добавить в архив</button>
    </article>

    <div class="section-heading"><div><span class="eyebrow">Хронология</span><h2>Важные события</h2></div><span class="count-badge">{{ recentEvents.length }}</span></div>
    <div v-if="recentEvents.length" class="timeline-list">
      <article v-for="event in recentEvents" :key="event.id" class="timeline-item">
        <span class="timeline-item__icon">{{ eventMeta(event.type).icon }}</span>
        <div>
          <strong>{{ event.title }}</strong>
          <small>{{ eventMeta(event.type).label }} · {{ formatDate(event.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</small>
          <p v-if="event.note">{{ event.note }}</p>
        </div>
        <button class="ghost-button ghost-button--danger" type="button" aria-label="Удалить событие" @click="remove(event.id)">×</button>
      </article>
    </div>
    <div v-else class="empty-state"><span>◆</span><h3>Архив пока пуст</h3><p>Здесь будут решения, изменения и события, которые помогают видеть длинную траекторию.</p></div>
  </section>
</template>
