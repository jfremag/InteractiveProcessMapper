<template>
  <div class="theme-admin">
    <section class="panel themes-list">
      <div class="panel-header">
        <h2>Themes</h2>
      </div>
      <ul class="theme-items">
        <li v-for="theme in themes" :key="theme.id" class="theme-item">
          <div class="theme-name">{{ theme.name }}</div>
          <button
            class="ghost-button"
            :disabled="theme.id === selectedThemeId"
            @click="selectedThemeId = theme.id"
          >
            {{ theme.id === selectedThemeId ? 'Active' : 'Set active' }}
          </button>
        </li>
      </ul>
    </section>

    <section class="panel theme-editor">
      <div class="panel-header">
        <h2>Theme colors</h2>
        <button class="ghost-button" type="button" @click="resetTheme" :disabled="!currentTheme">
          Reset to defaults
        </button>
      </div>

      <div v-if="currentTheme" class="form-grid">
        <div v-for="field in coreVariables" :key="field.key" class="form-row">
          <label :for="field.key">{{ field.label }}</label>
          <input
            :id="field.key"
            type="color"
            :value="currentTheme.cssVars?.[field.key] || ''"
            @input="updateCssVar(field.key, $event.target.value)"
          />
        </div>
      </div>
      <p v-else class="muted">Select a theme to edit.</p>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useThemeStore } from '../stores/themeStore.js';

const themeStore = useThemeStore();

const defaultCssVars = {
  '--pp-bg': '#f5f7fb',
  '--pp-surface': '#ffffff',
  '--pp-border': '#d2d7e0',
  '--pp-primary': '#2563eb',
  '--pp-accent': '#ec4899',
  '--pp-text': '#111827',
  '--pp-muted-text': '#6b7280',
};

const coreVariables = [
  { key: '--pp-bg', label: 'Background' },
  { key: '--pp-surface', label: 'Surface' },
  { key: '--pp-border', label: 'Border' },
  { key: '--pp-primary', label: 'Primary' },
  { key: '--pp-accent', label: 'Accent' },
  { key: '--pp-text', label: 'Text' },
  { key: '--pp-muted-text', label: 'Muted text' },
];

const themes = computed(() => themeStore.themes);

const selectedThemeId = computed({
  get: () => themeStore.currentThemeId,
  set: (value) => themeStore.setCurrentTheme(value),
});

const currentTheme = computed(() => themeStore.currentTheme);

onMounted(() => {
  themeStore.initFromStorage();
});

function updateCssVar(key, value) {
  const theme = currentTheme.value;
  if (!theme) return;

  const updatedTheme = {
    ...theme,
    cssVars: {
      ...theme.cssVars,
      [key]: value,
    },
  };

  themeStore.upsertTheme(updatedTheme);
}

function resetTheme() {
  const theme = currentTheme.value;
  if (!theme) return;

  const updatedTheme = {
    ...theme,
    cssVars: {
      ...defaultCssVars,
    },
  };

  themeStore.upsertTheme(updatedTheme);
}
</script>

<style scoped>
.theme-admin {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.5rem;
  align-items: flex-start;
}

.panel {
  background: var(--pp-surface);
  border: 1px solid var(--pp-border);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.03);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.panel h2 {
  margin: 0;
  font-size: 1.1rem;
}

.theme-items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.theme-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--pp-border);
  border-radius: 10px;
  background: var(--pp-bg);
}

.theme-name {
  font-weight: 600;
}

.theme-editor .form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem 1rem;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--pp-border);
  border-radius: 10px;
  background: var(--pp-bg);
}

.form-row label {
  font-weight: 600;
  color: var(--pp-text);
}

.form-row input[type='color'] {
  width: 56px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--pp-border);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.ghost-button {
  background: transparent;
  border: 1px solid var(--pp-border);
  color: var(--pp-text);
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.ghost-button:hover:enabled {
  background: var(--pp-primary);
  color: #fff;
}

.ghost-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.muted {
  color: var(--pp-muted-text);
}

@media (max-width: 900px) {
  .theme-admin {
    grid-template-columns: 1fr;
  }
}
</style>
