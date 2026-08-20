<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { postponePwaInstallNudge, readPwaInstallNudgeDismissedUntil, shouldShowPwaInstallNudge } from '../installNudge';
import { initPwaInstallation, promptPwaInstallation, pwaInstalled, pwaInstallPromptAvailable, pwaPlatform } from '../installation';

const props = defineProps<{ savedEntryCount: number }>();
const dismissedUntil = ref(readPwaInstallNudgeDismissedUntil());
const installing = ref(false);

initPwaInstallation();

const visible = computed(() =>
  shouldShowPwaInstallNudge({
    savedEntryCount: props.savedEntryCount,
    installed: pwaInstalled.value,
    platform: pwaPlatform.value,
    promptAvailable: pwaInstallPromptAvailable.value,
    dismissedUntil: dismissedUntil.value,
  }),
);
const canPrompt = computed(() => pwaInstallPromptAvailable.value);
const guideLabel = computed(() => (pwaPlatform.value === 'ios' ? 'Как установить на iPhone' : 'Как установить'));

function postpone() {
  dismissedUntil.value = postponePwaInstallNudge();
}

async function install() {
  if (installing.value) return;
  installing.value = true;
  try {
    const outcome = await promptPwaInstallation();
    if (outcome !== 'unavailable') postpone();
  } finally {
    installing.value = false;
  }
}
</script>

<template>
  <aside v-if="visible" class="pwa-install-nudge" aria-label="Установка приложения">
    <span class="pwa-install-nudge__mark" aria-hidden="true">⌂</span>
    <div>
      <strong>Открывайте «Траекторию» без браузера</strong>
      <p>Добавьте приложение на домашний экран телефона.</p>
    </div>
    <div class="pwa-install-nudge__actions">
      <button v-if="canPrompt" class="secondary-button" type="button" :disabled="installing" @click="install">
        {{ installing ? 'Открываю…' : 'Установить' }}
      </button>
      <RouterLink v-else class="secondary-button" to="/settings#install-settings">{{ guideLabel }}</RouterLink>
      <button class="pwa-install-nudge__later" type="button" @click="postpone">Позже</button>
    </div>
  </aside>
</template>
