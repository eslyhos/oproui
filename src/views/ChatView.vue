<script setup lang='ts'>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { latestTotalTokens } from '../chat-metadata';
import SecureHeader from '../components/SecureHeader.vue';
import { appendMessage, createChat, editMessageAndTruncate, getChat, getSettings } from '../db';
import { formatChatExport, formatLocalTimestamp, safeExportFilename } from '../export';
import { requestReply } from '../openrouter';
import { useSessionStore } from '../stores/session';
import type { Chat, ChatMessage, UserSettings } from '../types';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const chat = ref<Chat | null>(null);
const prompt = ref('');
const busy = ref(false);
const error = ref('');
const editingId = ref('');
const editDraft = ref('');
const messageList = ref<HTMLElement | null>(null);
const chatTitle = computed(() => chat.value?.title || 'New chat');
const totalTokens = computed(() => latestTotalTokens(chat.value?.messages ?? []));
const totalTokensText = computed(() => totalTokens.value === undefined
  ? 'Total tokens: unavailable'
  : `Total tokens: ${totalTokens.value.toLocaleString()}`);
function isUser(item: ChatMessage): boolean { return item.role === 'user'; }

function message(
  role: ChatMessage['role'],
  content: string,
  model: string,
  metadata: Pick<ChatMessage, 'provider' | 'reasoning' | 'totalTokens'> = {},
): ChatMessage {
  return { id: crypto.randomUUID(), role, content, model, createdAt: Date.now(), ...metadata };
}
async function scrollBottom() {
  await nextTick();
  messageList.value?.scrollTo({ top: messageList.value.scrollHeight });
}
async function load() {
  error.value = '';
  const id = typeof route.params.chatId === 'string' ? route.params.chatId : '';
  if (!id) { chat.value = null; return; }
  try {
    chat.value = (await getChat(session.username, id)) ?? null;
    if (!chat.value) error.value = 'Chat not found.';
    await scrollBottom();
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to load chat.'; }
}
function validate(settings: UserSettings): string {
  if (!settings.apiKey) return 'Add your OpenRouter API key in Settings before sending.';
  if (!settings.model) return 'Add an OpenRouter model name in Settings before sending.';
  return '';
}
async function complete(settings: UserSettings) {
  if (!chat.value) return;
  busy.value = true;
  error.value = '';
  await scrollBottom();
  try {
    const reply = await requestReply(settings, chat.value.messages);
    const assistantMessage = message('assistant', reply.content, reply.model, {
      provider: reply.provider,
      reasoning: reply.reasoning,
      totalTokens: reply.totalTokens,
    });
    await appendMessage(session.username, chat.value.id, assistantMessage);
    chat.value.messages.push(assistantMessage);
    chat.value.updatedAt = assistantMessage.createdAt;
    await scrollBottom();
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'OpenRouter request failed.'; }
  finally { busy.value = false; }
}
async function sendPrompt() {
  const content = prompt.value.trim();
  if (!content || busy.value) return;
  const settings = await getSettings(session.username);
  const problem = validate(settings);
  if (problem) { error.value = problem; return; }
  const userMessage = message('user', content, settings.model);
  prompt.value = '';
  if (!chat.value) {
    chat.value = await createChat(session.username, userMessage);
    await router.replace({ name: 'chat', params: { chatId: chat.value.id } });
  } else {
    await appendMessage(session.username, chat.value.id, userMessage);
    chat.value.messages.push(userMessage);
    chat.value.updatedAt = userMessage.createdAt;
  }
  await complete(settings);
}
function startEdit(item: ChatMessage) { editingId.value = item.id; editDraft.value = item.content; }
function cancelEdit() { editingId.value = ''; editDraft.value = ''; }
async function saveEdit(item: ChatMessage) {
  const content = editDraft.value.trim();
  if (!chat.value || !content || busy.value) return;
  const settings = await getSettings(session.username);
  const problem = validate(settings);
  if (problem) { error.value = problem; return; }
  const index = chat.value.messages.findIndex((entry) => entry.id === item.id);
  if (index < 0) return;
  const editedMessage = { ...item, content, model: settings.model };
  const updatedAt = Date.now();
  await editMessageAndTruncate(session.username, chat.value.id, editedMessage, updatedAt);
  chat.value.messages = chat.value.messages.slice(0, index + 1);
  chat.value.messages[index] = editedMessage;
  chat.value.updatedAt = updatedAt;
  editingId.value = '';
  await complete(settings);
}
function exportChat() {
  if (!chat.value) return;
  const url = URL.createObjectURL(new Blob([formatChatExport(chat.value)], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = safeExportFilename(chat.value.title);
  link.click();
  URL.revokeObjectURL(url);
}

watch(() => route.params.chatId, load);
onMounted(load);
</script>

<template>
  <div class='secure-page chat-page'>
    <SecureHeader :title='chatTitle' exportable @export='exportChat' />
    <div class='token-summary' aria-live='polite'>{{ totalTokensText }}</div>
    <main ref='messageList' class='message-list' aria-label='Chat messages'>
      <p v-if='!chat?.messages.length && !busy' class='empty-state'>Start a new chat.</p>
      <article v-for='item in chat?.messages || []' :key='item.id' class='message' :class='item.role'>
        <div class='message-meta'>
          <template v-if='!isUser(item)'>{{ item.role }} - {{ item.provider || 'Provider unknown' }} - {{ item.model }} - {{ formatLocalTimestamp(item.createdAt) }}</template>
          <template v-else>{{ item.role }} - {{ item.model }} - {{ formatLocalTimestamp(item.createdAt) }}</template>
        </div>
        <textarea v-if='editingId === item.id' v-model='editDraft' class='edit-textarea' rows='5' aria-label='Edit prompt'></textarea>
        <template v-else>
          <div v-if='!isUser(item) && item.reasoning' class='reasoning-section'>
            <div class='message-label'>Reasoning:</div>
            <p class='message-content reasoning-content'>{{ item.reasoning }}</p>
          </div>
          <div v-if='!isUser(item)' class='message-label response-label'>Response:</div>
          <p class='message-content'>{{ item.content }}</p>
        </template>
        <div v-if='isUser(item)' class='message-actions'>
          <button v-if='editingId !== item.id' type='button' @click='startEdit(item)'>Edit</button>
          <template v-else>
            <button type='button' :disabled='busy || !editDraft.trim()' @click='saveEdit(item)'>Save and regenerate</button>
            <button type='button' @click='cancelEdit'>Cancel</button>
          </template>
        </div>
      </article>
      <p v-if='busy' class='waiting' role='status'>Waiting for response</p>
    </main>
    <form class='composer' @submit.prevent='sendPrompt'>
      <p v-if='error' class='error composer-error' role='alert'>{{ error }}</p>
      <textarea v-model='prompt' rows='3' placeholder='Message OpenRouter' aria-label='Message' :disabled='busy'></textarea>
      <button class='primary-button send-button' type='submit' :disabled='busy || !prompt.trim()'>Send</button>
    </form>
  </div>
</template>
