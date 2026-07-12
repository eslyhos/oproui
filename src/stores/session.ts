import { defineStore } from 'pinia';
import router from '../router';
import { getMeta } from '../db';

const SESSION_KEY = 'openrouter-ui-current-username';
const TEN_MINUTES = 10 * 60 * 1000;

export const useSessionStore = defineStore('session', {
  state: () => ({
    username: sessionStorage.getItem(SESSION_KEY) || '',
  }),
  getters: {
    namespace: (state) => state.username.trim(),
  },
  actions: {
    login(username: string) {
      const next = username.trim();
      if (!next) return;
      this.username = next;
      sessionStorage.setItem(SESSION_KEY, next);
    },
    logout() {
      this.username = '';
      sessionStorage.removeItem(SESSION_KEY);
    },
    async checkFocusExpiry() {
      if (!this.namespace) return;
      const meta = await getMeta(this.namespace);
      if (meta.lastSentAt && Date.now() - meta.lastSentAt > TEN_MINUTES) {
        this.logout();
        router.replace({ name: 'login' });
      }
    },
  },
});
