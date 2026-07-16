<script setup lang=ts>
import { useRouter } from 'vue-router';
import { useSessionStore } from '../stores/session';

defineProps<{ title: string; exportable?: boolean }>();
const emit = defineEmits(['export']);
const router = useRouter();
const session = useSessionStore();

function logout() {
  session.logout();
  void router.replace({ name: 'login' });
}

function goMenu() {
  void router.push('/menu');
}

function requestExport() {
  emit('export');
}
</script>

<template>
  <header class=secure-header>
    <button class='icon-button menu-button' type='button' aria-label='Main menu' @click='goMenu'></button>
    <h1>{{ title }}</h1>
    <div class='header-actions'>
      <button v-if='exportable' class='export-button' type='button' @click='requestExport'>Export</button>
      <button class='icon-button' type='button' aria-label='Return to login' @click='logout'>x</button>
    </div>
  </header>
</template>
