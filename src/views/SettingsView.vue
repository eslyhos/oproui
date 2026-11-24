<script setup lang='ts'>
import { onMounted, ref } from 'vue';
import SecureHeader from '../components/SecureHeader.vue';
import { getSettings, saveSettings } from '../db';
import { useSessionStore } from '../stores/session';

const session = useSessionStore();
const apiKey = ref('');
const preset = ref('');
const model = ref('openrouter/auto');
const status = ref('');
const error = ref('');

onMounted(async () => {
  try {
    const settings = await getSettings(session.username);
    apiKey.value = settings.apiKey;
    preset.value = settings.preset;
    model.value = settings.model;
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to load settings.'; }
});

async function submit() {
  if (!model.value.trim()) return;
  status.value = '';
  error.value = '';
  try {
    await saveSettings(session.username, { apiKey: apiKey.value.trim(), preset: preset.value.trim(), model: model.value.trim() });
    status.value = 'Saved';
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to save settings.'; }
}
</script>

<template>
  <div class='secure-page'>
    <SecureHeader title='Settings' />
    <main class='page-content'>
      <form class='card settings-form' @submit.prevent='submit'>
        <label for='api-key'>OpenRouter API key</label>
        <input id='api-key' v-model='apiKey' type='password' autocomplete='off'>
        <label for='preset'>Preset name</label>
        <input id='preset' v-model='preset' type='text' autocomplete='off' placeholder='Optional'>
        <label for='model'>Model name</label>
        <input id='model' v-model='model' type='text' autocomplete='off' required>
        <p v-if='error' class='error' role='alert'>{{ error }}</p>
        <div class='form-actions'>
          <button class='primary-button' type='submit' :disabled='!model.trim()'>Save</button>
          <span role='status'>{{ status }}</span>
        </div>
      </form>
    </main>
  </div>
</template>
