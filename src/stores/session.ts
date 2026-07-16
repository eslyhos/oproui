import { defineStore } from 'pinia';

export const useSessionStore = defineStore('session', {
  state: () => ({ username: '' }),
  actions: {
    login(value: string) { this.username = value.trim(); },
    logout() { this.username = ''; },
  },
});
