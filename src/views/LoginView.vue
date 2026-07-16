<script setup lang='ts'>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from '../stores/session';

const username = ref('');
const router = useRouter();
const session = useSessionStore();

function submit() {
  session.login(username.value);
  if (session.username) void router.replace({ name: 'menu' });
}
</script>

<template>
  <main class='center-page'>
    <form class='card login-card' @submit.prevent='submit'>
      <h1>OproUI</h1>
      <label for='username'>Username</label>
      <input id='username' v-model='username' type='password' autocomplete='current-password' autofocus required>
      <button class='primary-button' type='submit' :disabled='!username.trim()'>Login</button>
    </form>
  </main>
</template>
