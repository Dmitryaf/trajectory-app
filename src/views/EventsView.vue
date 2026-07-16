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
const editingId = ref<number | null>(null);
const editingCreatedAt = ref('');
const saving = ref(false);

const recentEvents = computed(() => [...store.lifeEvents].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));

async function saveEvent() {
  const cleanTitle = title.value.trim();
  if (!cleanTitle) return;
  saving.value = true;
  if (editingId.value === null) {
    await store.addLifeEvent({ date: date.value, type: type.value, title: cleanTitle, note: note.value.trim() });
  } else {
    await store.updateLifeEvent({ id: editingId.value, createdAt: editingCreatedAt.value, date: date.value, type: type.value, title: cleanTitle, note: note.value.trim() });
  }
  resetForm();
  saving.value = false;
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
  if (id === undefined || !window.confirm('Удалить это событие из архива?')) return;
  await store.removeLifeEvent(id);
  if (editingId.value === id) resetForm();
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
      <div class="form-card__heading"><span class="section-icon section-icon--amber">◆</span><div><h2>{{ editingId === null ? 'Добавить событие' : 'Редактировать событие' }}</h2><p>Коротко зафиксируй то, что важно увидеть в будущем.</p></div></div>
      <ChipGroup v-model="type" :options="lifeEventTypeOptions" />
      <div class="event-composer__fields">
        <input v-model="title" type="text" maxlength="140" placeholder="Например: решил сменить направление поиска работы" @keyup.enter="saveEvent" />
        <input v-model="date" class="date-input" type="date" aria-label="Дата события" />
      </div>
      <textarea v-model="note" rows="2" maxlength="360" placeholder="Контекст, если он важен. Без обязательного анализа." />
      <button class="primary-button" type="button" :disabled="!title.trim() || saving" @click="saveEvent">{{ editingId === null ? 'Добавить в архив' : 'Сохранить событие' }}</button>
      <button v-if="editingId !== null" class="secondary-button composer-cancel" type="button" @click="resetForm">Отменить редактирование</button>
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
        <div class="item-actions">
          <button class="ghost-button" type="button" aria-label="Редактировать событие" @click="edit(event)">✎</button>
          <button class="ghost-button ghost-button--danger" type="button" aria-label="Удалить событие" @click="remove(event.id)">×</button>
        </div>
      </article>
    </div>
    <div v-else class="empty-state"><span>◆</span><h3>Архив пока пуст</h3><p>Здесь будут решения, изменения и события, которые помогают видеть длинную траекторию.</p></div>
  </section>
</template>
