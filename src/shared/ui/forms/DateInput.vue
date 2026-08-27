<script setup lang="ts">
import { nextTick, ref } from 'vue';

defineOptions({ inheritAttrs: false });
const props = defineProps<{ displayValue?: string }>();
const model = defineModel<string>();
const element = ref<HTMLInputElement>();
defineExpose({ element });

function updateModel(event: Event) {
  model.value = (event.target as HTMLInputElement).value;
}

async function restoreControlledValue() {
  await nextTick();
  const expected = props.displayValue ?? model.value ?? '';
  if (element.value && element.value.value !== expected) {
    element.value.value = expected;
  }
}
</script>

<template>
  <input
    ref="element"
    :value="props.displayValue ?? model"
    class="date-input"
    type="date"
    v-bind="$attrs"
    @input="updateModel"
    @change="restoreControlledValue"
  />
</template>

<style scoped>
.date-input {
  width: auto;
  min-width: 145px;
  background: rgba(255, 255, 255, 0.72);
  font-weight: 650;
}
</style>
