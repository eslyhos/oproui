import { createRouter, createWebHashHistory } from 'vue-router';
import LoginView from './views/LoginView.vue';
import ChatView from './views/ChatView.vue';
import SettingsView from './views/SettingsView.vue';
import { useSessionStore } from './stores/session';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'login', component: LoginView },
    { path: '/chat/:chatId?', name: 'chat', component: ChatView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const session = useSessionStore();
  if (!session.username && to.name !== 'login') return { name: 'login' };
  if (session.username && to.name === 'login') return { name: 'chat' };
  return true;
});

export default router;
