<script setup lang="ts">
import AiAnalysisSteps from './AiAnalysisSteps.vue';
import SettingsCard from '@/features/settings/ui/SettingsCard.vue';
import FormCardHeading from '@/shared/ui/forms/FormCardHeading.vue';
import FormDisclosure from '@/shared/ui/forms/FormDisclosure.vue';
import FormFieldLabel from '@/shared/ui/forms/FormFieldLabel.vue';
import FormRow from '@/shared/ui/forms/FormRow.vue';
import { useExternalAnalysis } from '../useExternalAnalysis';

const { copyCustomPrompt, copyPrompt, downloadCustomData, downloadData, end, isCopying, maxDate, start } = useExternalAnalysis();
</script>

<template>
  <SettingsCard id="analysis-settings" class="settings-card--analysis" tone="purple">
    <FormCardHeading icon="↗" tone="green">
      <div>
        <h2>Данные для внешнего анализа</h2>
        <p>
          Подготовленный текст содержит читаемую сводку, а отдельный JSON — полную копию данных выбранного периода. Приложение само ничего
          не отправляет.
        </p>
      </div>
    </FormCardHeading>
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
    <FormDisclosure class="analysis-range">
      <template #summary>Выбрать другой период</template>
      <p>Например, можно захватить часть прошлого месяца и несколько дней текущего.</p>
      <FormRow>
        <div>
          <FormFieldLabel for="analysis-start">Начало периода</FormFieldLabel>
          <input id="analysis-start" v-model="start" type="date" :max="end" aria-label="Начало периода анализа" />
        </div>
        <div>
          <FormFieldLabel for="analysis-end">Конец периода</FormFieldLabel>
          <input id="analysis-end" v-model="end" type="date" :min="start" :max="maxDate" aria-label="Конец периода анализа" />
        </div>
      </FormRow>
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
    </FormDisclosure>
    <p class="data-note">
      В пакет входят личные заметки выбранного периода. Перед передачей внешнему сервису можно просмотреть скачанный JSON.
    </p>
  </SettingsCard>
</template>

<style scoped>
.ai-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 12px;
}

@media (max-width: 720px) {
  .ai-actions {
    grid-template-columns: 1fr;
  }
}
</style>
