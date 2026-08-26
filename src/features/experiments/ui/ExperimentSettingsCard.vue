<script setup lang="ts">
import AutoGrowTextarea from '@/shared/ui/forms/AutoGrowTextarea.vue';
import ChipGroup from '@/shared/ui/forms/ChipGroup.vue';
import type { AppSettings } from '@/types';
import { experimentDecisionOptions, experimentTextLimits } from '../model';

defineProps<{
  canConclude: boolean;
  historyCount: number;
  identityLocked: boolean;
  savedEndDate: string;
  saveLabel: string;
  saving: boolean;
}>();

const experiment = defineModel<AppSettings['experiment']>('experiment', { required: true });

defineEmits<{
  complete: [];
  save: [];
}>();
</script>

<template>
  <article id="experiment-settings" class="settings-card settings-card--experiment">
    <div class="form-card__heading">
      <span class="section-icon section-icon--orange">⌁</span>
      <div>
        <h2>Личный эксперимент</h2>
        <p>Попробуйте одно изменение несколько дней или недель, а потом запишите, что вы заметили.</p>
      </div>
    </div>
    <label class="toggle-row"
      ><span><strong>Включить эксперимент</strong><small>В ежедневной записи появится один дополнительный вопрос.</small></span
      ><input v-model="experiment.active" type="checkbox"
    /></label>
    <label class="field-label" for="experiment-title">Что хотите попробовать</label>
    <AutoGrowTextarea
      id="experiment-title"
      v-model="experiment.title"
      :rows="5"
      :max-length="experimentTextLimits.title"
      :read-only="identityLocked"
      placeholder="Не читать новости после 22:00"
    />
    <p v-if="identityLocked" class="field-hint">
      Условие и дата начала зафиксированы после первой дневной записи. Дату окончания можно продлить.
    </p>
    <label class="field-label" for="experiment-hypothesis">Что хотите узнать <span class="field-optional">необязательно</span></label>
    <AutoGrowTextarea
      id="experiment-hypothesis"
      v-model="experiment.hypothesis"
      :rows="4"
      :max-length="experimentTextLimits.hypothesis"
      placeholder="Например: станет ли проще засыпать и сохранять энергию утром"
    />
    <div class="form-row">
      <label class="form-control"
        ><span class="field-label">С какого дня</span><input v-model="experiment.startDate" type="date" :disabled="identityLocked"
      /></label>
      <label class="form-control"
        ><span class="field-label">До какого дня</span
        ><input v-model="experiment.endDate" type="date" :min="identityLocked ? savedEndDate : undefined"
      /></label>
    </div>
    <template v-if="canConclude || experiment.conclusion.trim()">
      <label class="field-label" for="experiment-conclusion">
        {{ canConclude ? 'Что вы заметили?' : 'Промежуточное наблюдение' }}
      </label>
      <AutoGrowTextarea
        id="experiment-conclusion"
        v-model="experiment.conclusion"
        :rows="6"
        :max-length="experimentTextLimits.conclusion"
        placeholder="Опиши наблюдения своими словами. Совпадение показателей не обязательно означает влияние эксперимента."
      />
      <label class="field-label">
        {{ canConclude ? 'Что хотите делать дальше?' : 'Ранее выбранное решение' }}
        <span class="field-optional">необязательно</span>
      </label>
      <ChipGroup v-model="experiment.decision" :options="experimentDecisionOptions" allow-clear />
    </template>
    <p v-else-if="experiment.endDate" class="field-hint">
      После последнего дня здесь можно записать, что вы заметили. Завершённый эксперимент появится в разделе «История».
    </p>
    <button class="primary-button" type="button" :disabled="saving" @click="$emit('save')">
      {{ saveLabel }}
    </button>
    <button v-if="canConclude" class="secondary-button" type="button" :disabled="saving" @click="$emit('complete')">
      Завершить эксперимент
    </button>
    <p v-if="historyCount" class="data-note">Завершённые эксперименты можно посмотреть в разделе «История»: {{ historyCount }}.</p>
  </article>
</template>

<style scoped>
.settings-card--experiment {
  --settings-accent: #df6d53;
}
</style>
