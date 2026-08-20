<script setup lang="ts">
import { computed, ref } from 'vue';
import { initPwaInstallation, promptPwaInstallation, pwaInstalled, pwaInstallPromptAvailable, pwaPlatform } from '../installation';

withDefaults(defineProps<{ open?: boolean }>(), { open: false });

const installStatus = ref('');
const installing = ref(false);
const summary = computed(() => (pwaInstalled.value ? 'Приложение установлено' : 'Установить на телефон'));

initPwaInstallation();

async function install() {
  if (installing.value) return;
  installing.value = true;
  installStatus.value = '';
  try {
    const outcome = await promptPwaInstallation();
    if (outcome === 'accepted') installStatus.value = 'Подтвердите установку в окне браузера.';
    else if (outcome === 'dismissed') installStatus.value = 'Установка отменена. Позже её можно запустить из меню браузера.';
    else installStatus.value = 'Откройте меню браузера и выберите установку приложения.';
  } catch {
    installStatus.value = 'Не удалось открыть установку. Используйте команду установки в меню браузера.';
  } finally {
    installing.value = false;
  }
}
</script>

<template>
  <details class="analysis-range" :open="open">
    <summary>{{ summary }}</summary>
    <div class="analysis-range__content">
      <div v-if="pwaInstalled" class="cloud-sync-note" role="status">
        <strong>Открыто с домашнего экрана</strong>
        <p>«Траектория» работает в отдельном окне без панели браузера.</p>
      </div>
      <template v-else>
        <p>Установка добавит значок на домашний экран. Сначала откройте приложение онлайн и войдите в аккаунт.</p>
        <button v-if="pwaInstallPromptAvailable" class="secondary-button" type="button" :disabled="installing" @click="install">
          {{ installing ? 'Открываю установку…' : 'Установить через браузер' }}
        </button>
        <p v-if="installStatus" class="settings-status" role="status">{{ installStatus }}</p>

        <div class="install-platforms">
          <section class="install-platform" :class="{ 'install-platform--current': pwaPlatform === 'android' }">
            <h3>Android</h3>
            <ol>
              <li>Откройте сайт в Chrome.</li>
              <li>В меню браузера выберите «Установить приложение» или «Добавить на главный экран».</li>
              <li>Подтвердите установку.</li>
            </ol>
          </section>

          <section class="install-platform" :class="{ 'install-platform--current': pwaPlatform === 'ios' }">
            <h3>iPhone и iPad</h3>
            <ol>
              <li>Откройте сайт в Safari.</li>
              <li>Нажмите «Поделиться».</li>
              <li>Выберите «На экран Домой» → «Открыть как веб-приложение» → «Добавить».</li>
            </ol>
          </section>
        </div>
      </template>

      <p class="data-note">
        После первого онлайн-запуска интерфейс и локальные записи могут открываться без сети. Облачная синхронизация требует вернуть сеть и
        снова открыть приложение; фоновая синхронизация не гарантируется.
      </p>
      <p class="data-note">
        Удаление значка не удаляет аккаунт, облачную копию и данные сайта. При необходимости сначала удалите их в разделе «Аккаунт и
        безопасность».
      </p>
    </div>
  </details>
</template>
