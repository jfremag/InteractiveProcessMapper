<template>
  <div class="app-shell">
    <header class="header">
      <div class="container header-inner">
        <h1>Interactive Process Mapper</h1>
        <nav class="nav-actions">
          <RouterLink to="/">Home</RouterLink>
          <RouterLink to="/map">Process map</RouterLink>
          <RouterLink to="/admin/themes">Theme settings</RouterLink>
          <label class="theme-switcher">
            <span class="theme-label">Theme</span>
            <select v-model="selectedThemeId">
              <option v-for="theme in themes" :key="theme.id" :value="theme.id">
                {{ theme.name }}
              </option>
            </select>
          </label>
        </nav>
      </div>
    </header>
    <main class="app-main">
      <div class="container">
        <div class="view-wrapper">
          <router-view />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useProcessStore } from './stores/processStore.js';
import { useThemeStore } from './stores/themeStore.js';

const processStore = useProcessStore();
const themeStore = useThemeStore();

const themes = computed(() => themeStore.themes);
const selectedThemeId = computed({
  get: () => themeStore.currentThemeId,
  set: (value) => themeStore.setCurrentTheme(value),
});

onMounted(() => {
  processStore.init();
});
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.app-main > .container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.view-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.theme-switcher {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: var(--pp-surface);
}

.theme-label {
  opacity: 0.8;
}

.theme-switcher select {
  border-radius: 6px;
  border: 1px solid var(--pp-border);
  padding: 0.2rem 0.5rem;
  background: var(--pp-surface);
  color: var(--pp-text);
  font-weight: 600;
}

@media (max-width: 900px) {
  .header-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .theme-switcher {
    color: inherit;
  }
}
</style>
