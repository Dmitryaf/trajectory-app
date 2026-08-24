import { computed, reactive, ref, watch, type Ref } from 'vue';
import { buildPeriodPackage, copyAiPrompt, downloadAiPackage } from '../export/browser';
import { addDays, startOfMonth, startOfWeek, todayKey } from '@/services/dates';
import { notifyInfo, notifySaved, notifyUnknownError } from '@/services/notifications';
import { plainCopy } from '@/services/plain';
import { useAppStore } from '@/stores/app';
import type { MonthlyReview, WeeklyReview } from '@/types';

type Period = 'week' | 'month';
type PeriodReview = WeeklyReview | MonthlyReview;

type PeriodReviewOptions<T extends PeriodReview> = {
  period: Period;
  anchor: Ref<string>;
  start: Readonly<Ref<string>>;
  end: Readonly<Ref<string>>;
  emptyReview: (start: string) => T;
  findReview: (start: string) => T | undefined;
  persistReview: (review: T) => Promise<void>;
  hasContext: (review: T) => boolean;
  prepareDraft?: (review: T) => void;
  afterLoad?: () => void;
};

const periodLabels = {
  week: {
    saved: 'Обзор недели сохранён',
    saveError: 'Не удалось сохранить обзор недели',
    downloaded: 'Данные недели скачаны',
    downloadError: 'Не удалось скачать данные недели',
  },
  month: {
    saved: 'Итог месяца сохранён',
    saveError: 'Не удалось сохранить итог месяца',
    downloaded: 'Данные месяца скачаны',
    downloadError: 'Не удалось скачать данные месяца',
  },
} as const;

export function usePeriodReview<T extends PeriodReview>(options: PeriodReviewOptions<T>) {
  const store = useAppStore();
  const labels = periodLabels[options.period];
  const review = reactive(options.emptyReview(options.start.value)) as T;
  const reviewSaving = ref(false);
  const promptCopying = ref(false);
  const reviewContextOpen = ref(false);
  const savedReview = computed(() => options.findReview(options.start.value));
  const hasSavedReview = computed(() => Boolean(savedReview.value));
  const reviewHasContext = computed(() => options.hasContext(review));
  const currentPeriodStart = () => (options.period === 'week' ? startOfWeek(todayKey()) : startOfMonth(todayKey()));
  const availabilityLeadDays = options.period === 'week' ? 1 : 2;
  const reviewAvailable = computed(
    () =>
      hasSavedReview.value ||
      options.end.value < todayKey() ||
      (options.start.value === currentPeriodStart() && todayKey() >= addDays(options.end.value, -availabilityLeadDays)),
  );

  function loadReview() {
    const existing = options.findReview(options.start.value);
    Object.assign(review, options.emptyReview(options.start.value), existing ? plainCopy(existing) : {});
    options.prepareDraft?.(review);
    options.afterLoad?.();
    reviewContextOpen.value = reviewHasContext.value;
  }

  watch(options.start, loadReview, { immediate: true });

  function updateReviewContextOpen(event: Event) {
    reviewContextOpen.value = (event.currentTarget as HTMLDetailsElement).open;
  }

  async function saveReview() {
    if (reviewSaving.value) {
      return;
    }
    reviewSaving.value = true;
    try {
      await options.persistReview(plainCopy(review));
      notifySaved(labels.saved);
    } catch (error) {
      notifyUnknownError(error, labels.saveError);
    } finally {
      reviewSaving.value = false;
    }
  }

  function createPackage() {
    return buildPeriodPackage(options.period, options.anchor.value, {
      entries: store.dailyEntries,
      results: store.results,
      lifeEvents: store.lifeEvents,
      reviews: store.weeklyReviews,
      monthlyReviews: store.monthlyReviews,
      settings: store.settings,
    });
  }

  async function copyPrompt() {
    if (promptCopying.value) {
      return;
    }
    promptCopying.value = true;
    try {
      await copyAiPrompt(createPackage(), store.settings);
      notifySaved('Текст для нейросети скопирован');
    } catch (error) {
      notifyUnknownError(error, 'Не удалось подготовить текст для нейросети');
    } finally {
      promptCopying.value = false;
    }
  }

  function downloadJson() {
    try {
      downloadAiPackage(createPackage());
      notifyInfo(labels.downloaded);
    } catch (error) {
      notifyUnknownError(error, labels.downloadError);
    }
  }

  return {
    copyPrompt,
    downloadJson,
    hasSavedReview,
    promptCopying,
    review,
    reviewAvailable,
    reviewContextOpen,
    reviewHasContext,
    reviewSaving,
    saveReview,
    savedReview,
    updateReviewContextOpen,
  };
}
