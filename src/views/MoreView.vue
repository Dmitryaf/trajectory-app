<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import JournalEntryTypeDialog from '../features/journal/ui/JournalEntryTypeDialog.vue';
import { useAppStore } from '../stores/app';
import PageHeading from '../shared/ui/layout/PageHeading.vue';
import PageShell from '../shared/ui/layout/PageShell.vue';
import EyebrowText from '../shared/ui/typography/EyebrowText.vue';
import UiIcon from '../shared/ui/icons/UiIcon.vue';
import type { UiIconName } from '../shared/ui/icons/icons';

const store = useAppStore();
const route = useRoute();
const openEntryDialog = computed(() => route.query.add === '1');
const sections = computed<Array<{ to: string; icon: UiIconName; tone: string; count: number; title: string; text: string }>>(() => [
  {
    to: '/results',
    icon: 'result',
    tone: 'mint',
    count: store.results.length,
    title: 'Итоги',
    text: 'Конкретные сделанные дела и полученные результаты.',
  },
  {
    to: '/events',
    icon: 'event',
    tone: 'amber',
    count: store.lifeEvents.length,
    title: 'События и наблюдения',
    text: 'Событие — ситуация, которую важно помнить. Наблюдение — мысль или деталь, к которой захочется вернуться.',
  },
]);
</script>

<template>
  <PageShell class="page--journal">
    <PageHeading>
      <div>
        <EyebrowText>Важное отдельно</EyebrowText>
        <h1>Журнал</h1>
        <p>Здесь отдельно хранятся конкретные итоги, события, мысли и наблюдения.</p>
      </div>
    </PageHeading>
    <JournalEntryTypeDialog :open-initially="openEntryDialog" />
    <article class="journal-guide-card">
      <strong>Что записывать в Журнал</strong>
      <p>
        <b>Итог</b> — конкретное сделанное дело или полученный результат. <b>Событие</b> — ситуация, которую важно помнить.
        <b>Мысль или наблюдение</b> — что вы заметили, поняли или стали видеть иначе. Это не обязано быть необычным.
      </p>
    </article>
    <div class="more-grid">
      <RouterLink v-for="section in sections" :key="section.to" :to="section.to" class="more-card" :class="`more-card--${section.tone}`">
        <span><UiIcon :name="section.icon" /></span>
        <div>
          <small>{{ section.count }} в журнале</small>
          <h2>{{ section.title }}</h2>
          <p>{{ section.text }}</p>
        </div>
        <i><UiIcon name="arrow-right" /></i>
      </RouterLink>
    </div>
    <RouterLink to="/settings" class="journal-settings-card">
      <span><UiIcon name="settings" /></span>
      <div>
        <small>Управление приложением</small>
        <h2>Настройки</h2>
        <p>Поля ежедневной записи, текущая цель, эксперимент и копии данных.</p>
      </div>
      <i><UiIcon name="arrow-right" /></i>
    </RouterLink>
  </PageShell>
</template>

<style scoped src="./MoreView.css"></style>
