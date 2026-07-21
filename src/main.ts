import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import './style.css';

registerSW({ immediate: true });

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/TodayView.vue'), meta: { title: 'Сегодня' } },
    { path: '/results', component: () => import('./views/ResultsView.vue'), meta: { title: 'Итоги' } },
    { path: '/events', component: () => import('./views/EventsView.vue'), meta: { title: 'События' } },
    { path: '/week', component: () => import('./views/WeekView.vue'), meta: { title: 'Неделя' } },
    { path: '/month', component: () => import('./views/MonthView.vue'), meta: { title: 'Месяц' } },
    { path: '/trends', component: () => import('./views/TrendsView.vue'), meta: { title: 'Тренды' } },
    { path: '/more', component: () => import('./views/MoreView.vue'), meta: { title: 'Журнал' } },
    { path: '/settings', component: () => import('./views/SettingsView.vue'), meta: { title: 'Настройки' } }
  ]
});

router.afterEach((to) => {
  document.title = `${String(to.meta.title)} · Траектория`;
  window.scrollTo({ top: 0 });
});

createApp(App).use(createPinia()).use(router).mount('#app');
