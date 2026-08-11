<script setup lang="ts">
import { ref } from 'vue';

defineOptions({ inheritAttrs: false });

defineProps<{
  id: string;
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const visible = ref(false);

function updateValue(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="password-field">
    <input :id="id" v-bind="$attrs" :value="modelValue" :type="visible ? 'text' : 'password'" @input="updateValue" />
    <div style="margin-top: 6px">
      <button
        class="secondary-button password-field__toggle"
        type="button"
        :aria-label="visible ? 'Скрыть пароль' : 'Показать пароль'"
        :aria-pressed="visible"
        :aria-controls="id"
        @click="visible = !visible"
      >
        {{ visible ? 'Скрыть пароль' : 'Показать пароль' }}
      </button>
    </div>
  </div>
</template>
