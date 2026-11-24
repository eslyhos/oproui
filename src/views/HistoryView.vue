<script setup lang='ts'>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SecureHeader from '../components/SecureHeader.vue';
import { deleteChat, getChats, renameChat } from '../db';
import { useSessionStore } from '../stores/session';
import type { ChatSummary } from '../types';

const router = useRouter();
const session = useSessionStore();
const chats = ref<ChatSummary[]>([]);
const editingId = ref('');
const draft = ref('');
const error = ref('');

async function load() {
  try { chats.value = await getChats(session.username); }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to load chat history.'; }
}
function openChat(id: string) { void router.push({ name: 'chat', params: { chatId: id } }); }
function startRename(chat: ChatSummary) { editingId.value = chat.id; draft.value = chat.title; }
async function saveRename(id: string) {
  await renameChat(session.username, id, draft.value);
  editingId.value = '';
  await load();
}
async function remove(chat: ChatSummary) {
  if (!window.confirm(`Delete ${chat.title}?`)) return;
  await deleteChat(session.username, chat.id);
  await load();
}

onMounted(load);
</script>

<template>
  <div class='secure-page'>
    <SecureHeader title='Chat history' />
    <main class='page-content history-content'>
      <p v-if='error' class='error' role='alert'>{{ error }}</p>
      <p v-else-if='!chats.length' class='empty-state'>No past chats.</p>
      <ul v-else class='history-list'>
        <li v-for='chat in chats' :key='chat.id' class='history-item'>
          <button v-if='editingId !== chat.id' class='history-title' type='button' @click='openChat(chat.id)'>{{ chat.title }}</button>
          <input v-else v-model='draft' class='title-input' aria-label='Chat title' @keyup.enter='saveRename(chat.id)'>
          <div class='row-actions'>
            <button v-if='editingId !== chat.id' type='button' @click='startRename(chat)'>Edit title</button>
            <button v-else type='button' @click='saveRename(chat.id)'>Save</button>
            <button class='danger-button' type='button' @click='remove(chat)'>Delete</button>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>
