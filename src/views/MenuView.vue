<script setup lang='ts'>
import { useRouter } from 'vue-router';

const router = useRouter();
function openChat() { void router.push({ name: 'chat' }); }
function openHistory() { void router.push({ name: 'history' }); }
function openSettings() { void router.push({ name: 'settings' }); }
</script>

<template>
  <main class='center-page'>
    <section class='card menu-card'>
      <h1>OproUI</h1>
      <nav class='main-menu' aria-label='Main menu'>
        <button type='button' @click='openChat'>New chat</button>
        <button type='button' @click='openHistory'>Chat history</button>
        <button type='button' @click='openSettings'>Settings</button>
      </nav>
    </section>
  </main>
</template>
