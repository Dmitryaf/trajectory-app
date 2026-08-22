<script setup lang="ts">
import AiAnalysisSteps from './AiAnalysisSteps.vue';
import { useExternalAnalysis } from '../useExternalAnalysis';

const { copyCustomPrompt, copyPrompt, downloadCustomData, downloadData, end, isCopying, maxDate, start } = useExternalAnalysis();
</script>

<template>
  <article id="analysis-settings" class="settings-card settings-card--analysis">
    <div class="form-card__heading">
      <span class="section-icon section-icon--green">↗</span>
      <div>
        <h2>Данные для внешнего анализа</h2>
        <p>
          Подготовленный текст содержит читаемую сводку, а отдельный JSON — полную копию данных выбранного периода. Приложение само ничего
          не отправляет.
        </p>
      </div>
    </div>
    <AiAnalysisSteps />
    <div class="ai-actions">
      <button
        class="secondary-button"
        type="button"
        :disabled="isCopying('analysis-week')"
        :aria-busy="isCopying('analysis-week')"
        @click="copyPrompt('week')"
      >
        Подготовить текст недели
      </button>
      <button
        class="secondary-button"
        type="button"
        :disabled="isCopying('analysis-month')"
        :aria-busy="isCopying('analysis-month')"
        @click="copyPrompt('month')"
      >
        Подготовить текст месяца
      </button>
      <button class="secondary-button" type="button" @click="downloadData('week')">Данные недели</button>
      <button class="secondary-button" type="button" @click="downloadData('month')">Данные месяца</button>
    </div>
    <details class="analysis-range">
      <summary>Выбрать другой период</summary>
      <div class="analysis-range__content">
        <p>Например, можно захватить часть прошлого месяца и несколько дней текущего.</p>
        <div class="form-row">
          <div>
            <label class="field-label" for="analysis-start">Начало периода</label>
            <input id="analysis-start" v-model="start" type="date" :max="end" aria-label="Начало периода анализа" />
          </div>
          <div>
            <label class="field-label" for="analysis-end">Конец периода</label>
            <input id="analysis-end" v-model="end" type="date" :min="start" :max="maxDate" aria-label="Конец периода анализа" />
          </div>
        </div>
        <div class="ai-actions">
          <button
            class="secondary-button"
            type="button"
            :disabled="isCopying('analysis-range')"
            :aria-busy="isCopying('analysis-range')"
            @click="copyCustomPrompt"
          >
            Подготовить текст периода
          </button>
          <button class="secondary-button" type="button" @click="downloadCustomData">Скачать данные периода</button>
        </div>
        <p class="data-note">
          В текст входят записи по каждому дню выбранного периода, включая личные заметки. JSON остаётся полной копией без сокращений.
        </p>
      </div>
    </details>
    <p class="data-note">
      В пакет входят личные заметки выбранного периода. Перед передачей внешнему сервису можно просмотреть скачанный JSON.
    </p>
  </article>
</template>
