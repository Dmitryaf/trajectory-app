<script setup lang="ts">
defineEmits<{ dismiss: []; prepare: [] }>();
</script>

<template>
  <aside class="review-nudge ai-analysis-nudge" aria-label="Анализ записей во внешней нейросети">
    <div class="ai-analysis-nudge__copy">
      <span class="eyebrow">Ещё один способ посмотреть на записи</span>
      <strong>Подготовить текст для нейросети</strong>
      <p>Приложение только соберёт текст и ничего не отправит само. Сервис выбираете вы.</p>
      <ol aria-label="Как получить разбор">
        <li>Подготовить текст</li>
        <li>Открыть выбранный сервис</li>
        <li>Вставить текст и получить разбор</li>
      </ol>
    </div>
    <div class="ai-analysis-nudge__actions">
      <RouterLink class="secondary-button" to="/week#ai-analysis" @click="$emit('prepare')">Подготовить текст для нейросети</RouterLink>
      <button class="ai-analysis-nudge__dismiss" type="button" aria-label="Больше не показывать подсказку" @click="$emit('dismiss')">
        Больше не показывать
      </button>
    </div>
  </aside>
</template>
