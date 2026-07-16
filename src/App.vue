<script setup lang=ts>
import { onMounted, onUnmounted } from 'vue';
import { RouterView } from 'vue-router';

function syncViewport() {
  document.documentElement.style.setProperty('--app-height', `${Math.round(window.visualViewport?.height ?? window.innerHeight)}px`);
}
onMounted(() => {
  syncViewport();
  window.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('resize', syncViewport);
});
onUnmounted(() => {
  window.removeEventListener('resize', syncViewport);
  window.visualViewport?.removeEventListener('resize', syncViewport);
});
</script>

<template><RouterView /></template>
