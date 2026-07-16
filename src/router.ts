import { createRouter, createWebHashHistory } from 'vue-router';
import LoginView from './views/LoginView.vue';
import MenuView from './views/MenuView.vue';
import ChatView from './views/ChatView.vue';
import HistoryView from './views/HistoryView.vue';
import SettingsView from './views/SettingsView.vue';
import { useSessionStore } from './stores/session';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'login', component: LoginView },
    { path: '/menu', name: 'menu', component: MenuView, meta: { session: true } },
    { path: '/chat/:chatId?', name: 'chat', component: ChatView, meta: { secure: true } },
    { path: '/history', name: 'history', component: HistoryView, meta: { secure: true } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { secure: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const session = useSessionStore();
  if ((to.meta.session || to.meta.secure) && !session.username) return { name: 'login' };
  if (to.name === 'login' && session.username) return { name: 'menu' };
  return true;
});

export default router;
