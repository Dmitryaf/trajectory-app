import { computed, getCurrentInstance, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { formatDate, todayKey } from '../../services/dates';
import { notifyError, notifySaved, notifyUnknownError } from '../../services/notifications';
import { plainCopy } from '../../services/plain';
import { emptyDailyEntry, type DailyBlockId, type DailyEntry } from '../../types';
import type { useAppStore } from '../../stores/app';
import {
  prepareDailyEntryForSave,
  snapshotDailyEntry,
  timeBetween,
  validateDailyEntryMetrics,
  validateDailyEntryText,
  type DailyEntryMetrics,
} from './model';

type AppStore = ReturnType<typeof useAppStore>;

export function useDailyEntryForm(store: AppStore) {
  const selectedDate = ref(todayKey());
  const sleepDurationMinutes = ref<number | null>(null);
  const timeInBedDurationMinutes = ref<number | null>(null);
  const weightKg = ref<number | null>(null);
  const saved = ref(false);
  const saving = ref(false);
  const draftStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const restoredDraft = ref(false);
  const validationMessage = ref('');
  const originalEntrySnapshot = ref('');
  const persistedDraftSnapshot = ref('');
  const form = reactive<DailyEntry>(emptyDailyEntry(selectedDate.value));
  let syncingEntry = false;
  let lastDerivedTimeInBed: number | null = null;
  let savedTimer: number | undefined;
  let draftTimer: number | undefined;
  let draftSavePromise: Promise<boolean> | null = null;

  const activeDailyBlocks = computed(() => new Set(store.settings.activeDailyBlocks));
  const hasSavedEntry = computed(() => Boolean(store.entryByDate(selectedDate.value)));
  const currentEntrySnapshot = computed(() => snapshotDailyEntry(form, currentMetrics()));
  const isDirty = computed(() => currentEntrySnapshot.value !== originalEntrySnapshot.value);
  const entryChangeNotice = computed(() => {
    if (saved.value) return '';
    if (draftStatus.value === 'error') return 'Не удалось защитить черновик. Сохраните день, прежде чем закрывать страницу.';
    if (isDirty.value && draftStatus.value === 'saving') return 'Сохраняю черновик на этом устройстве…';
    if (isDirty.value && draftStatus.value === 'saved')
      return restoredDraft.value
        ? 'Восстановлены несохранённые изменения. Черновик хранится только на этом устройстве.'
        : 'Черновик сохранён на этом устройстве. Чтобы добавить день в историю, нажмите «Сохранить день».';
    if (isDirty.value && hasSavedEntry.value)
      return `Есть изменения за ${formatDate(selectedDate.value, { day: 'numeric', month: 'long' })}. Сохрани, чтобы обновить запись.`;
    if (isDirty.value) return `Есть несохранённая запись за ${formatDate(selectedDate.value, { day: 'numeric', month: 'long' })}.`;
    return '';
  });
  const saveButtonText = computed(() => {
    if (saving.value) return 'Сохраняю…';
    if (hasSavedEntry.value && isDirty.value) return 'Сохранить изменения';
    if (hasSavedEntry.value) return 'Запись сохранена';
    return 'Сохранить день';
  });
  const saveButtonDisabled = computed(() => saving.value || (hasSavedEntry.value && !isDirty.value && !saved.value));

  function currentMetrics(): DailyEntryMetrics {
    return {
      sleepMinutes: sleepDurationMinutes.value,
      timeInBedMinutes: timeInBedDurationMinutes.value,
      weightKg: weightKg.value,
    };
  }

  function applyEntry(entry: DailyEntry) {
    syncingEntry = true;
    Object.assign(form, plainCopy(entry));
    sleepDurationMinutes.value = entry.sleepMinutes;
    timeInBedDurationMinutes.value = entry.timeInBedMinutes;
    weightKg.value = entry.weightKg;
    syncingEntry = false;
    lastDerivedTimeInBed = null;
  }

  function currentDraftEntry(): DailyEntry {
    return plainCopy({
      ...form,
      sleepMinutes: sleepDurationMinutes.value,
      timeInBedMinutes: timeInBedDurationMinutes.value,
      weightKg: weightKg.value,
    });
  }

  function loadEntry(date: string) {
    validationMessage.value = '';
    restoredDraft.value = false;
    draftStatus.value = 'idle';
    persistedDraftSnapshot.value = '';
    const savedEntry = store.entryByDate(date) ?? emptyDailyEntry(date);
    applyEntry(savedEntry);
    originalEntrySnapshot.value = snapshotDailyEntry(form, currentMetrics());
    const draft = store.draftByDate(date);
    if (draft) {
      applyEntry(draft.entry);
      const draftSnapshot = snapshotDailyEntry(form, currentMetrics());
      if (draftSnapshot !== originalEntrySnapshot.value) {
        persistedDraftSnapshot.value = draftSnapshot;
        draftStatus.value = 'saved';
        restoredDraft.value = true;
      } else {
        void store.removeDailyEntryDraft(date);
      }
    }
    saved.value = false;
  }

  function blockIsActive(block: DailyBlockId) {
    return activeDailyBlocks.value.has(block);
  }

  function confirmDiscardChanges(): boolean {
    if (!isDirty.value || persistedDraftSnapshot.value === currentEntrySnapshot.value) return true;
    return window.confirm('Черновик ещё не сохранён на устройстве. Отбросить изменения и продолжить?');
  }

  function changeSelectedDate(date: string): boolean {
    if (!date || date === selectedDate.value) return true;
    if (!confirmDiscardChanges()) return false;
    selectedDate.value = date;
    return true;
  }

  function selectDate(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (!changeSelectedDate(input.value)) input.value = selectedDate.value;
  }

  function handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!isDirty.value || persistedDraftSnapshot.value === currentEntrySnapshot.value) return;
    event.preventDefault();
    event.returnValue = '';
  }

  function queueDraftSave() {
    if (draftTimer !== undefined) window.clearTimeout(draftTimer);
    draftStatus.value = 'saving';
    draftTimer = window.setTimeout(() => void persistDraft(), 500);
  }

  async function persistDraft() {
    while (draftSavePromise) {
      await draftSavePromise;
      if (!isDirty.value || persistedDraftSnapshot.value === currentEntrySnapshot.value) return true;
    }
    if (draftTimer !== undefined) {
      window.clearTimeout(draftTimer);
      draftTimer = undefined;
    }
    if (!isDirty.value) return true;
    const snapshot = currentEntrySnapshot.value;
    draftStatus.value = 'saving';
    const operation = (async () => {
      try {
        await store.saveDailyEntryDraft(currentDraftEntry());
        if (currentEntrySnapshot.value === snapshot) {
          persistedDraftSnapshot.value = snapshot;
          draftStatus.value = 'saved';
        } else {
          queueDraftSave();
        }
        return true;
      } catch (error) {
        draftStatus.value = 'error';
        console.warn('Не удалось сохранить черновик дневной записи', error);
        return false;
      }
    })();
    draftSavePromise = operation;
    try {
      return await operation;
    } finally {
      if (draftSavePromise === operation) draftSavePromise = null;
    }
  }

  async function save() {
    if (saving.value) return;
    validationMessage.value = validateDailyEntryMetrics(currentMetrics(), blockIsActive('sleep')) || validateDailyEntryText(form);
    if (validationMessage.value) {
      notifyError(validationMessage.value);
      return;
    }
    const entry = prepareDailyEntryForSave(
      form,
      currentMetrics(),
      {
        focusTitle: store.settings.activeFocusTitle,
        focusOutcomeCriterion: store.settings.focusOutcomeCriterion,
        focusReviewDate: store.settings.focusReviewDate,
        externalEvidenceCriterion: store.settings.externalEvidenceCriterion,
        nutritionCriterion: store.settings.nutritionGoalCriterion,
        activeDailyBlocks: store.settings.activeDailyBlocks,
      },
      !hasSavedEntry.value,
    );
    const wasExistingEntry = hasSavedEntry.value;
    saving.value = true;
    try {
      if (draftSavePromise) await draftSavePromise;
      if (draftTimer !== undefined) {
        window.clearTimeout(draftTimer);
        draftTimer = undefined;
      }
      const savedEntry = await store.saveEntry(entry);
      applyEntry(savedEntry);
      originalEntrySnapshot.value = snapshotDailyEntry(form, currentMetrics());
      persistedDraftSnapshot.value = '';
      draftStatus.value = 'idle';
      restoredDraft.value = false;
      saved.value = true;
      const localSaveMessage = wasExistingEntry
        ? `Запись за ${formatDate(selectedDate.value, { day: 'numeric', month: 'long' })} обновлена на устройстве`
        : 'День сохранён на устройстве';
      notifySaved(store.cloudSyncStatus === 'disabled' ? localSaveMessage : `${localSaveMessage} · облако обновляется`);
      if (savedTimer !== undefined) window.clearTimeout(savedTimer);
      savedTimer = window.setTimeout(() => (saved.value = false), 2200);
    } catch (error) {
      notifyUnknownError(error, 'Не удалось сохранить день');
    } finally {
      saving.value = false;
    }
  }

  watch(selectedDate, loadEntry, { immediate: true });
  watch(
    currentEntrySnapshot,
    (snapshot) => {
      if (syncingEntry) return;
      saved.value = false;
      if (snapshot === originalEntrySnapshot.value) {
        if (draftTimer !== undefined) window.clearTimeout(draftTimer);
        draftTimer = undefined;
        persistedDraftSnapshot.value = '';
        draftStatus.value = 'idle';
        restoredDraft.value = false;
        void store.removeDailyEntryDraft(selectedDate.value);
        return;
      }
      queueDraftSave();
    },
    { flush: 'sync' },
  );
  watch(
    () => [form.bedtime, form.wakeTime],
    ([bedtime, wakeTime]) => {
      if (syncingEntry) return;
      const duration = timeBetween(String(bedtime), String(wakeTime));
      if (duration !== null) {
        timeInBedDurationMinutes.value = duration;
        lastDerivedTimeInBed = duration;
        return;
      }
      if (lastDerivedTimeInBed !== null && timeInBedDurationMinutes.value === lastDerivedTimeInBed) {
        timeInBedDurationMinutes.value = null;
      }
      lastDerivedTimeInBed = null;
    },
    { flush: 'sync' },
  );

  if (getCurrentInstance()?.appContext.config.globalProperties.$router) {
    onBeforeRouteLeave(async () => {
      if (!isDirty.value || persistedDraftSnapshot.value === currentEntrySnapshot.value) return true;
      return (await persistDraft()) || confirmDiscardChanges();
    });
  }
  onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload));
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    if (savedTimer !== undefined) window.clearTimeout(savedTimer);
    if (draftTimer !== undefined) window.clearTimeout(draftTimer);
  });

  return {
    selectedDate,
    sleepDurationMinutes,
    timeInBedDurationMinutes,
    weightKg,
    saved,
    saving,
    draftStatus,
    restoredDraft,
    validationMessage,
    form,
    hasSavedEntry,
    isDirty,
    entryChangeNotice,
    saveButtonText,
    saveButtonDisabled,
    blockIsActive,
    changeSelectedDate,
    selectDate,
    save,
  };
}
