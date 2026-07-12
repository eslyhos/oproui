<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Chat } from '../types';
import { useSessionStore } from '../stores/session';

const props = defineProps<{
  chats: Chat[];
  activeChatId?: string;
  collapsed: boolean;
}>();

const emit = defineEmits<{
  newChat: [];
  selectChat: [id: string];
  renameChat: [id: string, title: string];
  deleteChat: [id: string];
  toggle: [];
}>();

const router = useRouter();
const session = useSessionStore();
const editingId = ref('');
const draftTitle = ref('');

const sidebarClass = computed(() => ['sidebar', props.collapsed ? 'sidebar-collapsed' : '']);

function startRename(chat: Chat) {
  editingId.value = chat.id;
  draftTitle.value = chat.title;
}

function saveRename(chat: Chat) {
  emit('renameChat', chat.id, draftTitle.value);
  editingId.value = '';
}

function logout() {
  session.logout();
  router.replace({ name: 'login' });
}
</script>

<template>
  <aside :class="sidebarClass" aria-label="Application sidebar">
    <div class="sidebar-top">
      <button class="icon-button" type="button" :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="emit('toggle')">
        <span aria-hidden="true">{{ collapsed ? '>' : '<' }}</span>
      </button>
      <button class="icon-button" type="button" title="New chat" aria-label="New chat" @click="emit('newChat')">
        <span aria-hidden="true">+</span>
      </button>
    </div>

    <div class="chat-list" aria-label="Chat history">
      <div
        v-for="chat in chats"
        :key="chat.id"
        class="chat-row"
        :class="{ active: chat.id === activeChatId }"
        :title="collapsed ? chat.title : undefined"
      >
        <button v-if="editingId !== chat.id" class="chat-select" type="button" @click="emit('selectChat', chat.id)">
          <span class="chat-mark" aria-hidden="true">#</span>
          <span v-if="!collapsed" class="chat-title">{{ chat.title }}</span>
        </button>
        <input
          v-if="!collapsed && editingId === chat.id"
          v-model="draftTitle"
          class="rename-input"
          aria-label="Chat title"
          @keyup.enter="saveRename(chat)"
          @blur="saveRename(chat)"
        />
        <span v-if="!collapsed" class="chat-actions">
          <button class="mini-button" type="button" title="Rename chat" aria-label="Rename chat" @click="startRename(chat)">Edit</button>
          <button class="mini-button danger" type="button" title="Delete chat" aria-label="Delete chat" @click="emit('deleteChat', chat.id)">Del</button>
        </span>
      </div>
    </div>

    <div class="sidebar-bottom">
      <button class="nav-button" type="button" title="Settings" aria-label="Settings" @click="router.push({ name: 'settings' })">
        <span aria-hidden="true">S</span>
        <span v-if="!collapsed">Settings</span>
      </button>
      <button class="nav-button" type="button" title="Log out" aria-label="Log out" @click="logout">
        <span aria-hidden="true">X</span>
        <span v-if="!collapsed">Log out</span>
      </button>
    </div>
  </aside>
</template>
