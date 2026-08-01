<script setup lang='ts'>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import SecureHeader from '../components/SecureHeader.vue';
import { exportDatabaseBackup, replaceDatabaseFromBackup } from '../db';

const router = useRouter();
const fileInput = ref<HTMLInputElement>();
const busy = ref(false);
const status = ref('');
const error = ref('');
function openChat() { void router.push({ name: 'chat' }); }
function openHistory() { void router.push({ name: 'history' }); }
function openSettings() { void router.push({ name: 'settings' }); }

async function exportData() {
  busy.value = true;
  status.value = '';
  error.value = '';
  try {
    const backup = await exportDatabaseBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'opro-ui-backup.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    status.value = 'Database backup exported.';
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to export the database.';
  } finally { busy.value = false; }
}

function selectImport() { fileInput.value?.click(); }

async function importData(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  busy.value = true;
  status.value = '';
  error.value = '';
  try {
    let backup;
    try { backup = JSON.parse(await file.text()); }
    catch { throw new Error('The selected file does not contain valid JSON.'); }
    if (!window.confirm('Replace all current OproUI data with this backup? This cannot be undone.')) return;
    await replaceDatabaseFromBackup(backup);
    status.value = 'Database backup imported.';
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to import the database.';
  } finally { busy.value = false; }
}
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
          <button type='button' :disabled='busy' @click='exportData'>Export data</button>
          <button type='button' :disabled='busy' @click='selectImport'>Import data</button>
          <input ref='fileInput' class='visually-hidden' type='file' accept='.json,application/json' @change='importData'>
        </nav>
        <p v-if='error' class='error' role='alert'>{{ error }}</p>
        <p v-if='status' class='menu-status' role='status'>{{ status }}</p>
      </section>
    </main>
  </div>
</template>
