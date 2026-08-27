<script setup lang="ts">
import AutoGrowTextarea from '@/shared/ui/forms/AutoGrowTextarea.vue';
import ChipGroup from '@/shared/ui/forms/ChipGroup.vue';
import SettingsCard from '@/features/settings/ui/SettingsCard.vue';
import FormCardHeading from '@/shared/ui/forms/FormCardHeading.vue';
import FormFieldLabel from '@/shared/ui/forms/FormFieldLabel.vue';
import FormHint from '@/shared/ui/forms/FormHint.vue';
import FormRow from '@/shared/ui/forms/FormRow.vue';
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
  <SettingsCard id="experiment-settings" class="settings-card--experiment" tone="orange">
    <FormCardHeading icon="⌁" tone="orange">
      <div>
        <h2>Личный эксперимент</h2>
        <p>Попробуйте одно изменение несколько дней или недель, а потом запишите, что вы заметили.</p>
      </div>
    </FormCardHeading>
    <label class="toggle-row"
      ><span><strong>Включить эксперимент</strong><small>В ежедневной записи появится один дополнительный вопрос.</small></span
      ><input v-model="experiment.active" type="checkbox"
    /></label>
    <FormFieldLabel for="experiment-title">Что хотите попробовать</FormFieldLabel>
    <AutoGrowTextarea
      id="experiment-title"
      v-model="experiment.title"
      :rows="5"
      :max-length="experimentTextLimits.title"
      :read-only="identityLocked"
      placeholder="Не читать новости после 22:00"
    />
    <FormHint v-if="identityLocked">
      Условие и дата начала зафиксированы после первой дневной записи. Дату окончания можно продлить.
    </FormHint>
    <FormFieldLabel for="experiment-hypothesis" optional>Что хотите узнать</FormFieldLabel>
    <AutoGrowTextarea
      id="experiment-hypothesis"
      v-model="experiment.hypothesis"
      :rows="4"
      :max-length="experimentTextLimits.hypothesis"
      placeholder="Например: станет ли проще засыпать и сохранять энергию утром"
    />
    <FormRow>
      <label class="form-control"
        ><FormFieldLabel tag="span">С какого дня</FormFieldLabel
        ><input v-model="experiment.startDate" type="date" :disabled="identityLocked"
      /></label>
      <label class="form-control"
        ><FormFieldLabel tag="span">До какого дня</FormFieldLabel
        ><input v-model="experiment.endDate" type="date" :min="identityLocked ? savedEndDate : undefined"
      /></label>
    </FormRow>
    <template v-if="canConclude || experiment.conclusion.trim()">
      <FormFieldLabel for="experiment-conclusion">
        {{ canConclude ? 'Что вы заметили?' : 'Промежуточное наблюдение' }}
      </FormFieldLabel>
      <AutoGrowTextarea
        id="experiment-conclusion"
        v-model="experiment.conclusion"
        :rows="6"
        :max-length="experimentTextLimits.conclusion"
        placeholder="Опиши наблюдения своими словами. Совпадение показателей не обязательно означает влияние эксперимента."
      />
      <FormFieldLabel optional>
        {{ canConclude ? 'Что хотите делать дальше?' : 'Ранее выбранное решение' }}
      </FormFieldLabel>
      <ChipGroup v-model="experiment.decision" :options="experimentDecisionOptions" allow-clear />
    </template>
    <FormHint v-else-if="experiment.endDate">
      После последнего дня здесь можно записать, что вы заметили. Завершённый эксперимент появится в разделе «История».
    </FormHint>
    <button class="primary-button" type="button" :disabled="saving" @click="$emit('save')">
      {{ saveLabel }}
    </button>
    <button v-if="canConclude" class="secondary-button" type="button" :disabled="saving" @click="$emit('complete')">
      Завершить эксперимент
    </button>
    <p v-if="historyCount" class="data-note">Завершённые эксперименты можно посмотреть в разделе «История»: {{ historyCount }}.</p>
  </SettingsCard>
</template>

<style scoped>
.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 14px 0;
  border-top: 1px solid #edf0f4;
  border-bottom: 1px solid #edf0f4;
}
.toggle-row strong,
.toggle-row small {
  display: block;
}
.toggle-row small {
  margin-top: 4px;
  color: var(--muted);
}
.toggle-row input {
  width: 48px;
  height: 26px;
  accent-color: var(--accent-dark);
}
</style>
