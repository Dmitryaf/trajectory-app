<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{ text: string; contentId: string; textClass?: string }>();
const content = ref<HTMLElement>();
const expanded = ref(false);
const overflows = ref(false);
let resizeObserver: ResizeObserver | null = null;

function measure() {
  if (!content.value || expanded.value) {
    return;
  }
  overflows.value = content.value.scrollHeight > content.value.clientHeight + 1;
}

async function toggle() {
  expanded.value = !expanded.value;
  if (!expanded.value) {
    await nextTick(measure);
  }
}

onMounted(async () => {
  await nextTick(measure);
  resizeObserver = new ResizeObserver(measure);
  if (content.value) {
    resizeObserver.observe(content.value);
  }
});

watch(
  () => props.text,
  async () => {
    expanded.value = false;
    overflows.value = false;
    await nextTick(measure);
  },
);

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<template>
  <div>
    <p :id="contentId" ref="content" class="clamped-text" :class="[textClass, { 'clamped-text--collapsed': !expanded }]">
      {{ text }}
    </p>
    <button
      v-if="overflows"
      class="clamped-text__toggle"
      type="button"
      :aria-expanded="expanded"
      :aria-controls="contentId"
      @click="toggle"
    >
      {{ expanded ? 'Свернуть' : 'Показать полностью' }}
    </button>
  </div>
</template>

<style scoped>
.clamped-text--collapsed {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}
.clamped-text__toggle {
  margin-top: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2c745e;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}
.clamped-text__toggle:hover {
  color: #174f40;
}
</style>
