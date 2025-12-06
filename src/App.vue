<template>
  <div>
    <header class="header">
      <div class="container">
        <h1>Interactive Process Mapper</h1>
        <nav class="nav-actions">
          <RouterLink to="/">Home</RouterLink>
        </nav>
      </div>
    </header>
    <main class="container">
      <router-view />
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
