<template>
  <div class="app-shell">
    <header class="header">
      <div class="container header-inner">
        <h1>Interactive Process Mapper</h1>
        <nav class="nav-actions">
          <RouterLink to="/">Home</RouterLink>
        </nav>
      </div>
    </header>
    <main class="app-main">
      <div class="container">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useProcessStore } from './stores/processStore.js';

const processStore = useProcessStore();

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

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

@media (max-width: 900px) {
  .header-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>
