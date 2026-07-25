<script setup lang=ts>
import { onMounted, onUnmounted } from 'vue';
import { RouterView } from 'vue-router';
import router from './router';
import { createSessionExpiryMonitor } from './session-expiry';
import { useSessionStore } from './stores/session';

const session = useSessionStore();
const expiryMonitor = createSessionExpiryMonitor(() => {
  if (!session.username) return;
  session.logout();
  void router.replace({ name: 'login' });
});

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') expiryMonitor.deactivate();
  else expiryMonitor.activate();
}

function activateIfVisible() {
  if (document.visibilityState === 'visible') expiryMonitor.activate();
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', expiryMonitor.deactivate);
  window.addEventListener('focus', activateIfVisible);
  window.addEventListener('pagehide', expiryMonitor.deactivate);
  window.addEventListener('pageshow', activateIfVisible);

  if (document.visibilityState === 'hidden') expiryMonitor.deactivate();
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('blur', expiryMonitor.deactivate);
  window.removeEventListener('focus', activateIfVisible);
  window.removeEventListener('pagehide', expiryMonitor.deactivate);
  window.removeEventListener('pageshow', activateIfVisible);
});
</script>

<template><RouterView /></template>
