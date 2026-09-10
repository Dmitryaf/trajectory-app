<script setup lang="ts">
import { nextTick } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import ActionButton from '@/shared/ui/actions/ActionButton.vue';

const props = defineProps<{
  dirty: boolean;
}>();

const emit = defineEmits<{
  discard: [];
}>();

const router = useRouter();
let discardApproved = false;

function confirmDiscard() {
  return !props.dirty || window.confirm('Введённый текст не сохранён. Отменить добавление?');
}

onBeforeRouteLeave(() => discardApproved || confirmDiscard());

async function cancel() {
  if (!confirmDiscard()) {
    return;
  }
  discardApproved = true;
  emit('discard');
  await nextTick();
  await router.push({ path: '/more', query: { add: '1' } });
}
</script>

<template>
  <ActionButton variant="secondary" class="composer-cancel" type="button" @click="cancel">Отменить добавление</ActionButton>
</template>
