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
    dismissedUntil: dismissedUntil.value,
  }),
);
const canPrompt = computed(() => pwaInstallPromptAvailable.value);
const guideLabel = computed(() => (pwaPlatform.value === 'ios' ? 'Как установить на iPhone' : 'Как установить'));

function postpone() {
  dismissedUntil.value = postponePwaInstallNudge();
}

async function install() {
  if (installing.value) {
    return;
  }
  installing.value = true;
  try {
    const outcome = await promptPwaInstallation();
    if (outcome !== 'unavailable') {
      postpone();
    }
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

<style scoped>
.pwa-install-nudge {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding: 13px 14px;
  border: 1px solid #cfe5dc;
  border-radius: 16px;
  background: linear-gradient(135deg, #effaf6, rgba(255, 255, 255, 0.9));
}
.pwa-install-nudge__mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  background: #d9f3e8;
  color: var(--accent-dark);
  font-size: 18px;
  font-weight: 900;
}
.pwa-install-nudge strong {
  display: block;
  color: var(--navy);
  font-size: 14px;
}
.pwa-install-nudge p {
  margin: 2px 0 0;
  color: #66766f;
  font-size: 12px;
}
.pwa-install-nudge__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pwa-install-nudge__actions .secondary-button {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  padding: 8px 11px;
  text-align: center;
  text-decoration: none;
}
.pwa-install-nudge__later {
  min-height: 40px;
  padding: 8px;
  border: 0;
  background: transparent;
  color: #6d7d76;
  font-weight: 750;
}
.pwa-install-nudge__later:hover {
  color: var(--accent-dark);
}

@media (max-width: 720px) {
  .pwa-install-nudge {
    grid-template-columns: 38px minmax(0, 1fr);
    align-items: start;
  }
  .pwa-install-nudge__actions {
    grid-column: 1 / -1;
  }
  .pwa-install-nudge__actions .secondary-button {
    flex: 1;
  }
}
</style>
