<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppSidebar from '../components/AppSidebar.vue';
import {
  addMessage,
  createChat,
  deleteChat,
  deleteMessagesAfter,
  getChat,
  getChats,
  getMessages,
  getSettings,
  renameChat,
  setLastSentAt,
  updateMessage,
} from '../db';
import { requestReply } from '../openrouter';
import { useSessionStore } from '../stores/session';
import type { Chat, Message } from '../types';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const chats = ref<Chat[]>([]);
const currentChat = ref<Chat | null>(null);
const messages = ref<Message[]>([]);
const prompt = ref('');
const busy = ref(false);
const error = ref('');
const editingId = ref('');
const editDraft = ref('');
const collapsed = ref(localStorage.getItem('openrouter-ui-sidebar-collapsed') === 'true');
const messageList = ref<HTMLElement | null>(null);

const activeChatId = computed(() => typeof route.params.chatId === 'string' ? route.params.chatId : '');
const totalTokens = computed(() => messages.value.reduce((sum, message) => sum + (message.totalTokens ?? 0), 0));

function setCollapsed(value: boolean) {
  collapsed.value = value;
  localStorage.setItem('openrouter-ui-sidebar-collapsed', String(value));
}

async function loadChats() {
  chats.value = await getChats(session.namespace);
}

async function ensureChat() {
  await loadChats();
  const routeChatId = activeChatId.value;
  if (routeChatId) {
    const chat = await getChat(routeChatId);
    if (chat?.namespace === session.namespace) {
      currentChat.value = chat;
      messages.value = await getMessages(chat.id);
      return;
    }
  }

  const chat = chats.value[0] ?? (await createChat(session.namespace));
  await router.replace({ name: 'chat', params: { chatId: chat.id } });
}

async function reloadCurrent() {
  if (!currentChat.value) return;
  currentChat.value = (await getChat(currentChat.value.id)) ?? currentChat.value;
  messages.value = await getMessages(currentChat.value.id);
  await loadChats();
  await nextTick();
  messageList.value?.scrollTo({ top: messageList.value.scrollHeight });
}

async function newChat() {
  const chat = await createChat(session.namespace);
  await loadChats();
  await router.push({ name: 'chat', params: { chatId: chat.id } });
}

async function selectChat(id: string) {
  await router.push({ name: 'chat', params: { chatId: id } });
}

async function removeChat(id: string) {
  await deleteChat(id);
  await loadChats();
  if (id === currentChat.value?.id) {
    const next = chats.value[0] ?? (await createChat(session.namespace));
    await router.replace({ name: 'chat', params: { chatId: next.id } });
  }
}

async function rename(id: string, title: string) {
  await renameChat(id, title);
  await loadChats();
  if (id === currentChat.value?.id) currentChat.value = (await getChat(id)) ?? currentChat.value;
}

async function sendWithHistory(history: Message[]) {
  if (!currentChat.value) return;
  const settings = await getSettings(session.namespace);
  if (!settings.apiKey) {
    error.value = 'Add your OpenRouter API key in Settings before sending.';
    return;
  }

  busy.value = true;
  error.value = '';
  try {
    const reply = await requestReply(settings.apiKey, settings.preset, history);
    await addMessage(currentChat.value.id, 'assistant', reply.content, {
      model: reply.model,
      totalTokens: reply.totalTokens,
    });
    await reloadCurrent();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'The OpenRouter request failed.';
  } finally {
    busy.value = false;
  }
}

async function sendPrompt() {
  const content = prompt.value.trim();
  if (!content || !currentChat.value || busy.value) return;
  prompt.value = '';
  const userMessage = await addMessage(currentChat.value.id, 'user', content);
  await setLastSentAt(session.namespace, userMessage.createdAt);
  await reloadCurrent();
  await sendWithHistory(messages.value);
}

function startEdit(message: Message) {
  editingId.value = message.id;
  editDraft.value = message.content;
}

async function saveEdit(message: Message) {
  const content = editDraft.value.trim();
  if (!content || busy.value) return;
  const updated: Message = { ...message, content };
  await updateMessage(updated);
  await deleteMessagesAfter(updated.chatId, updated.createdAt);
  editingId.value = '';
  await reloadCurrent();
  await setLastSentAt(session.namespace, Date.now());
  await sendWithHistory(messages.value);
}

function cancelEdit() {
  editingId.value = '';
  editDraft.value = '';
}

function formatStamp(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function exportChat() {
  if (!currentChat.value) return;
  const text = messages.value
    .map((message) => [
      ...(message.model ? [`[${message.model}]`] : []),
      `[${formatStamp(message.createdAt)}]`,
      `[${message.role === 'user' ? session.username : 'Reply'}]`,
      `[${message.content}]`,
    ].join('\n'))
    .join('\n\n');
  const exportText = totalTokens.value > 0 ? `${text}\n\n[total_tokens: ${totalTokens.value}]` : text;
  const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${currentChat.value.title.replace(/[^\w.-]+/g, '_') || 'chat'}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

watch(() => route.params.chatId, ensureChat);
onMounted(ensureChat);
</script>

<template>
  <div class="app-shell">
    <AppSidebar
      :chats="chats"
      :active-chat-id="currentChat?.id"
      :collapsed="collapsed"
      @toggle="setCollapsed(!collapsed)"
      @new-chat="newChat"
      @select-chat="selectChat"
      @rename-chat="rename"
      @delete-chat="removeChat"
    />

    <main class="chat-page">
      <header class="chat-header">
        <h1>{{ currentChat?.title || 'Chat' }}</h1>
        <div class="chat-header-actions">
          <div v-if="totalTokens > 0" class="token-total" title="Total tokens">total_tokens: {{ totalTokens }}</div>
          <button type="button" class="icon-text-button" title="Export current chat" aria-label="Export current chat" @click="exportChat">
            <span aria-hidden="true">Download</span>
            <span>Export</span>
          </button>
        </div>
      </header>

      <section ref="messageList" class="message-list" aria-label="Current chat messages">
        <div v-if="messages.length === 0" class="empty-state">No messages yet.</div>
        <article v-for="message in messages" :key="message.id" class="message" :class="message.role">
          <div class="message-meta">
            <span v-if="message.model">{{ message.model }} - </span>{{ message.role === 'user' ? session.username : 'Reply' }} - {{ formatStamp(message.createdAt) }}
          </div>
          <textarea
            v-if="editingId === message.id"
            v-model="editDraft"
            class="edit-area"
            aria-label="Edit message"
            rows="5"
          />
          <p v-else class="message-content">{{ message.content }}</p>
          <div v-if="message.role === 'user'" class="message-actions">
            <button v-if="editingId !== message.id" type="button" class="text-button" @click="startEdit(message)">Edit</button>
            <template v-else>
              <button type="button" class="text-button" :disabled="busy" @click="saveEdit(message)">Regenerate</button>
              <button type="button" class="text-button" @click="cancelEdit">Cancel</button>
            </template>
          </div>
        </article>
      </section>

      <form class="composer" @submit.prevent="sendPrompt">
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <textarea
          v-model="prompt"
          rows="4"
          placeholder="Type a text prompt"
          aria-label="Text prompt"
          @keydown.enter.stop
        />
        <button type="submit" :disabled="busy || !prompt.trim()">{{ busy ? 'Sending' : 'Send' }}</button>
      </form>
    </main>
  </div>
</template>

