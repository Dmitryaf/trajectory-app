import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import TodayView from './views/TodayView.vue';
import ResultsView from './views/ResultsView.vue';
import EventsView from './views/EventsView.vue';
import WeekView from './views/WeekView.vue';
import MonthView from './views/MonthView.vue';
import SettingsView from './views/SettingsView.vue';
import './style.css';

registerSW({ immediate: true });

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: TodayView, meta: { title: 'Сегодня' } },
    { path: '/results', component: ResultsView, meta: { title: 'Результаты' } },
    { path: '/events', component: EventsView, meta: { title: 'Архив' } },
    { path: '/week', component: WeekView, meta: { title: 'Неделя' } },
    { path: '/month', component: MonthView, meta: { title: 'Месяц' } },
    { path: '/settings', component: SettingsView, meta: { title: 'Настройки' } }
  ]
});

router.afterEach((to) => {
  document.title = `${String(to.meta.title)} · Траектория`;
  window.scrollTo({ top: 0 });
});

createApp(App).use(createPinia()).use(router).mount('#app');
