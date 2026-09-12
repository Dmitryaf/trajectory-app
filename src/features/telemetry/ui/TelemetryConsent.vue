<script setup lang="ts">
import ActionButton from '@/shared/ui/actions/ActionButton.vue';
import { productTelemetry, telemetryCollectionEnabled, telemetryState } from '../productTelemetry';
</script>

<template>
  <details v-if="telemetryCollectionEnabled || telemetryState.enabled || telemetryState.pendingWithdrawal" class="telemetry-consent">
    <summary>Добровольная аналитика использования</summary>
    <div class="telemetry-consent__body">
      <p>
        Можно разрешить сбор фактов открытия разделов и сохранения записей, обзоров и решений. События связаны с аккаунтом; содержимое
        записей, оценки состояния и тексты не передаются.
      </p>
      <p>
        Это необязательно и не влияет на функции приложения. Срок хранения событий — до 90 дней. При отзыве согласия сбор прекращается, а
        персональные продуктовые события удаляются с сервера. До согласия события не собираются.
      </p>
      <p>Настройка действует для аккаунта. На устройстве без сети удаление ждёт подключения; серверное подтверждение появится здесь.</p>
      <p class="telemetry-consent__status" role="status" aria-live="polite">
        {{ telemetryState.message || (telemetryState.enabled ? 'Сбор разрешён.' : 'Сбор на этом устройстве выключен.') }}
      </p>
      <ActionButton
        v-if="telemetryState.enabled || telemetryState.pendingWithdrawal"
        variant="secondary"
        type="button"
        :disabled="telemetryState.busy && telemetryState.pendingWithdrawal"
        @click="productTelemetry.withdraw()"
        >{{ telemetryState.pendingWithdrawal ? 'Повторить удаление событий' : 'Отозвать и удалить события' }}</ActionButton
      >
      <ActionButton
        v-else-if="telemetryState.available && telemetryCollectionEnabled"
        variant="secondary"
        type="button"
        :disabled="telemetryState.busy"
        @click="productTelemetry.grant()"
        >Разрешить сбор событий</ActionButton
      >
      <ActionButton v-else variant="secondary" type="button" :disabled="telemetryState.busy" @click="productTelemetry.refresh()"
        >Проверить состояние согласия</ActionButton
      >
    </div>
  </details>
</template>

<style scoped>
.telemetry-consent {
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 15px;
}
summary {
  padding: 14px;
  cursor: pointer;
  font-weight: 750;
}
.telemetry-consent__body {
  display: grid;
  gap: 12px;
  padding: 0 14px 14px;
}
p {
  margin: 0;
  font-size: 13px;
}
.telemetry-consent__status {
  min-height: 5lh;
}
.telemetry-consent__body :deep(button) {
  min-height: 72px;
}
</style>
