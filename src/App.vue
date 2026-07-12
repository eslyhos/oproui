<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { RouterView } from 'vue-router';
import { useSessionStore } from './stores/session';

const session = useSessionStore();

function onFocus() {
  void session.checkFocusExpiry();
}

onMounted(() => window.addEventListener('focus', onFocus));
onUnmounted(() => window.removeEventListener('focus', onFocus));
</script>

<template>
  <RouterView />
</template>
