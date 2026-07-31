<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const props = withDefaults(
  defineProps<{
    openForFirstVisit?: boolean;
  }>(),
  { openForFirstVisit: false },
);

const emit = defineEmits<{ 'intro-seen': [] }>();
const router = useRouter();
const isOpen = ref(false);
const closeButton = ref<HTMLButtonElement>();
const openedAsIntro = ref(false);

watch(
  () => props.openForFirstVisit,
  async (shouldOpen) => {
    if (!shouldOpen) {
      if (openedAsIntro.value) {
        isOpen.value = false;
        openedAsIntro.value = false;
      }
      return;
    }
    if (isOpen.value) return;
    openedAsIntro.value = true;
    isOpen.value = true;
    await nextTick();
    closeButton.value?.focus();
  },
  { immediate: true },
);

async function open() {
  openedAsIntro.value = false;
  isOpen.value = true;
  await nextTick();
  closeButton.value?.focus();
}

function close() {
  isOpen.value = false;
  if (openedAsIntro.value) emit('intro-seen');
  openedAsIntro.value = false;
}

async function goTo(path: string) {
  close();
  await router.push(path);
}
</script>

<template>
  <button
    class="help-link"
    type="button"
    aria-label="Как работает приложение"
    title="Как это работает"
    aria-haspopup="dialog"
    @click="open"
  >
    <span aria-hidden="true">?</span>
    <strong>Как это работает</strong>
  </button>

  <Teleport to="body">
    <div v-if="isOpen" class="help-backdrop" @click.self="close">
      <section class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="how-it-works-title" @keydown.esc="close">
        <div class="help-dialog__heading">
          <div>
            <span class="eyebrow">Зачем нужны записи</span>
            <h2 id="how-it-works-title">Зачем нужна «Траектория»</h2>
          </div>
          <button ref="closeButton" class="help-dialog__close" type="button" aria-label="Закрыть объяснение" @click="close">×</button>
        </div>

        <p class="help-dialog__lead">
          Чтобы в конце недели решать не по общему впечатлению, а по своим записям: что повторялось, в какие дни было больше сил и что вы
          действительно сделали. После этого можно выбрать одно действие или условие на следующую неделю.
        </p>

        <ol class="help-steps">
          <li>
            <span>1</span>
            <div>
              <strong>Сегодня: коротко отметить день</strong>
              <p>Сон, состояние, действия и условия дня нужны, чтобы позже сравнить несколько дней. Заполнять всё не обязательно.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Факт дня: оставить пояснение</strong>
              <p>
                Запишите одну деталь, которая отличала этот день: например, болезнь, важный разговор или неожиданную нагрузку. Она поможет
                понять запись при разборе.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Неделя и месяц: сравнить записи</strong>
              <p>
                Здесь видно, что повторялось и какие результаты появились. Приложение не называет причины — вывод и следующий шаг выбираете
                вы.
              </p>
            </div>
          </li>
          <li>
            <span>4</span>
            <div>
              <strong>Журнал: сохранить важное отдельно</strong>
              <p>
                <b>Итог</b> — конкретное сделанное дело или полученный результат. <b>Событие</b> — важная для вас ситуация, которая
                произошла. <b>Важная мысль</b> — что вы поняли или стали видеть иначе.
              </p>
            </div>
          </li>
          <li>
            <span>5</span>
            <div>
              <strong>Эксперимент: проверить одно изменение</strong>
              <p>
                Выберите одно условие, отмечайте, получилось ли его соблюдать, а после срока сравните записи до и во время и запишите свой
                вывод.
              </p>
            </div>
          </li>
        </ol>

        <p class="help-dialog__note">
          Сами по себе записи не являются целью. Они нужны для одного решения: что оставить, что изменить или что проверить дальше.
        </p>

        <div class="help-dialog__actions">
          <button class="secondary-button" type="button" @click="goTo('/settings#daily-blocks')">Настроить записи</button>
          <button class="primary-button" type="button" @click="goTo('/')">Начать запись</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
