import { createApp, watch } from 'vue';
import { createPinia } from 'pinia';
import router from './router/index.js';
import App from './App.vue';
import './assets/main.css';
import { useThemeStore } from './stores/themeStore.js';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

const themeStore = useThemeStore(pinia);
themeStore.initFromStorage();

function applyTheme(theme) {
  if (!theme?.cssVars) return;
  const rootStyle = document.documentElement.style;
  Object.entries(theme.cssVars).forEach(([key, value]) => {
    rootStyle.setProperty(key, value);
  });
}

watch(
  () => themeStore.currentTheme,
  (theme) => {
    applyTheme(theme);
  },
  { immediate: true }
);

app.mount('#app');
