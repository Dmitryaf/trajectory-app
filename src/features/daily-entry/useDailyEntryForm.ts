import { computed, getCurrentInstance, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { formatDate, todayKey } from '../../services/dates';
import { notifyError, notifySaved, notifyUnknownError } from '../../services/notifications';
import { plainCopy } from '../../services/plain';
import { emptyDailyEntry, type DailyBlockId, type DailyEntry } from '../../types';
import type { useAppStore } from '../../stores/app';
import { prepareDailyEntryForSave, snapshotDailyEntry, timeBetween, validateDailyEntryMetrics, type DailyEntryMetrics } from './model';

type AppStore = ReturnType<typeof useAppStore>;

export function useDailyEntryForm(store: AppStore) {
  const selectedDate = ref(todayKey());
  const sleepDurationMinutes = ref<number | null>(null);
  const timeInBedDurationMinutes = ref<number | null>(null);
  const weightKg = ref<number | null>(null);
  const saved = ref(false);
  const saving = ref(false);
  const validationMessage = ref('');
  const originalEntrySnapshot = ref('');
  const form = reactive<DailyEntry>(emptyDailyEntry(selectedDate.value));
  let syncingEntry = false;
  let lastDerivedTimeInBed: number | null = null;
  let savedTimer: number | undefined;

  const activeDailyBlocks = computed(() => new Set(store.settings.activeDailyBlocks));
  const hasSavedEntry = computed(() => Boolean(store.entryByDate(selectedDate.value)));
  const currentEntrySnapshot = computed(() => snapshotDailyEntry(form, currentMetrics()));
  const isDirty = computed(() => currentEntrySnapshot.value !== originalEntrySnapshot.value);
  const entryChangeNotice = computed(() => {
    if (saved.value) return '';
    if (isDirty.value && hasSavedEntry.value) return `Есть изменения за ${formatDate(selectedDate.value, { day: 'numeric', month: 'long' })}. Сохрани, чтобы обновить запись.`;
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

  function loadEntry(date: string) {
    validationMessage.value = '';
    applyEntry(store.entryByDate(date) ?? emptyDailyEntry(date));
    originalEntrySnapshot.value = snapshotDailyEntry(form, currentMetrics());
    saved.value = false;
  }

  function blockIsActive(block: DailyBlockId) {
    return activeDailyBlocks.value.has(block);
  }

  function confirmDiscardChanges(): boolean {
    return !isDirty.value || window.confirm('Есть несохранённые изменения. Отбросить их и продолжить?');
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
    if (!isDirty.value) return;
    event.preventDefault();
    event.returnValue = '';
  }

  async function save() {
    if (saving.value) return;
    validationMessage.value = validateDailyEntryMetrics(currentMetrics(), blockIsActive('sleep'));
    if (validationMessage.value) {
      notifyError(validationMessage.value);
      return;
    }
    const entry = prepareDailyEntryForSave(form, currentMetrics(), {
      focusTitle: store.settings.activeFocusTitle,
      externalEvidenceCriterion: store.settings.externalEvidenceCriterion,
      nutritionCriterion: store.settings.nutritionGoalCriterion,
    }, !hasSavedEntry.value);
    const wasExistingEntry = hasSavedEntry.value;
    saving.value = true;
    try {
      const savedEntry = await store.saveEntry(entry);
      applyEntry(savedEntry);
      originalEntrySnapshot.value = snapshotDailyEntry(form, currentMetrics());
      saved.value = true;
      notifySaved(wasExistingEntry ? `Запись за ${formatDate(selectedDate.value, { day: 'numeric', month: 'long' })} обновлена` : 'День сохранён');
      if (savedTimer !== undefined) window.clearTimeout(savedTimer);
      savedTimer = window.setTimeout(() => (saved.value = false), 2200);
    } catch (error) {
      notifyUnknownError(error, 'Не удалось сохранить день');
    } finally {
      saving.value = false;
    }
  }

  watch(selectedDate, loadEntry, { immediate: true });
  watch(() => [form.bedtime, form.wakeTime], ([bedtime, wakeTime]) => {
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
  }, { flush: 'sync' });

  if (getCurrentInstance()?.appContext.config.globalProperties.$router) {
    onBeforeRouteLeave(() => confirmDiscardChanges());
  }
  onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload));
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    if (savedTimer !== undefined) window.clearTimeout(savedTimer);
  });

  return {
    selectedDate,
    sleepDurationMinutes,
    timeInBedDurationMinutes,
    weightKg,
    saved,
    saving,
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
