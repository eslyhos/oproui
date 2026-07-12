<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppSidebar from '../components/AppSidebar.vue';
import { createChat, deleteChat, getChats, getSettings, renameChat, saveSettings } from '../db';
import { useSessionStore } from '../stores/session';
import type { Chat } from '../types';

const session = useSessionStore();
const router = useRouter();
const chats = ref<Chat[]>([]);
const collapsed = ref(localStorage.getItem('openrouter-ui-sidebar-collapsed') === 'true');
const apiKey = ref('');
const preset = ref('openrouter/auto');
const saved = ref(false);

function setCollapsed(value: boolean) {
  collapsed.value = value;
  localStorage.setItem('openrouter-ui-sidebar-collapsed', String(value));
}

async function load() {
  const settings = await getSettings(session.namespace);
  chats.value = await getChats(session.namespace);
  apiKey.value = settings.apiKey;
  preset.value = settings.preset;
}

async function submit() {
  await saveSettings({
    namespace: session.namespace,
    apiKey: apiKey.value.trim(),
    preset: preset.value.trim() || 'openrouter/auto',
  });
  saved.value = true;
  window.setTimeout(() => (saved.value = false), 1800);
}

async function newChat() {
  const chat = await createChat(session.namespace);
  await router.push({ name: 'chat', params: { chatId: chat.id } });
}

async function rename(id: string, title: string) {
  await renameChat(id, title);
  await load();
}

async function removeChat(id: string) {
  await deleteChat(id);
  await load();
}

onMounted(load);
</script>

<template>
  <div class="app-shell">
    <AppSidebar
      :chats="chats"
      :collapsed="collapsed"
      @toggle="setCollapsed(!collapsed)"
      @new-chat="newChat"
      @select-chat="(id) => router.push({ name: 'chat', params: { chatId: id } })"
      @rename-chat="rename"
      @delete-chat="removeChat"
    />
    <main class="settings-page">
      <form class="settings-panel" @submit.prevent="submit">
        <h1>Settings</h1>
        <label for="api-key">OpenRouter API key</label>
        <input id="api-key" v-model="apiKey" type="password" autocomplete="off" />
        <label for="preset">OpenRouter preset</label>
        <input id="preset" v-model="preset" type="text" autocomplete="off" placeholder="openrouter/auto" />
        <div class="settings-actions">
          <button type="submit">Save</button>
          <span v-if="saved" role="status">Saved</span>
        </div>
      </form>
    </main>
  </div>
</template>
