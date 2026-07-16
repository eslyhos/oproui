<script setup lang='ts'>
import { useRouter } from 'vue-router';
import SecureHeader from '../components/SecureHeader.vue';

const router = useRouter();
function openChat() { void router.push({ name: 'chat' }); }
function openHistory() { void router.push({ name: 'history' }); }
function openSettings() { void router.push({ name: 'settings' }); }
</script>

<template>
  <div class='secure-page'>
    <SecureHeader title='OproUI' />
    <main class='page-content menu-content'>
      <section class='card menu-card'>
        <nav class='main-menu' aria-label='Main menu'>
          <button type='button' @click='openChat'>New chat</button>
          <button type='button' @click='openHistory'>Chat history</button>
          <button type='button' @click='openSettings'>Settings</button>
        </nav>
      </section>
    </main>
  </div>
</template>
