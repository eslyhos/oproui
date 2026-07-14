<script setup lang="ts">
import { nextTick, onMounted, onUnmounted } from 'vue';
import { RouterView } from 'vue-router';
import { useSessionStore } from './stores/session';

const session = useSessionStore();

function onFocus() {
  void session.checkFocusExpiry();
}

let fullViewportHeight = 0;

function isEditable(element: Element | null): boolean {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
}

function syncViewport() {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const editableFocused = isEditable(document.activeElement);

  if (!editableFocused) fullViewportHeight = Math.max(fullViewportHeight, viewportHeight);
  if (!fullViewportHeight) fullViewportHeight = viewportHeight;

  document.documentElement.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`);
  document.documentElement.classList.toggle(
    'keyboard-visible',
    window.innerWidth <= 720 && editableFocused && viewportHeight < fullViewportHeight - 120,
  );
}

function onOrientationChange() {
  fullViewportHeight = 0;
  window.setTimeout(syncViewport, 100);
}

function onFocusChange() {
  void nextTick(syncViewport);
}

onMounted(() => {
  window.addEventListener('focus', onFocus);
  window.addEventListener('resize', syncViewport);
  window.addEventListener('orientationchange', onOrientationChange);
  document.addEventListener('focusin', onFocusChange);
  document.addEventListener('focusout', onFocusChange);
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
  syncViewport();
});

onUnmounted(() => {
  window.removeEventListener('focus', onFocus);
  window.removeEventListener('resize', syncViewport);
  window.removeEventListener('orientationchange', onOrientationChange);
  document.removeEventListener('focusin', onFocusChange);
  document.removeEventListener('focusout', onFocusChange);
  window.visualViewport?.removeEventListener('resize', syncViewport);
  window.visualViewport?.removeEventListener('scroll', syncViewport);
  document.documentElement.classList.remove('keyboard-visible');
  document.documentElement.style.removeProperty('--app-height');
});
</script>

<template>
  <RouterView />
</template>
