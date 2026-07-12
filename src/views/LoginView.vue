<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from '../stores/session';

const username = ref('');
const router = useRouter();
const session = useSessionStore();

function submit() {
  session.login(username.value);
  if (session.username) router.replace({ name: 'chat' });
}
</script>

<template>
  <main class="login-page">
    <form class="login-form" @submit.prevent="submit">
      <input v-model="username" type="text" autocomplete="username" autofocus aria-label="Username" placeholder="Username" />
    </form>
  </main>
</template>
