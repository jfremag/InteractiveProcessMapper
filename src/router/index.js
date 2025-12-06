import { createRouter, createWebHistory } from 'vue-router';

const ProcessList = () => import('../components/ProcessList.vue');
const ProcessEditor = () => import('../components/ProcessEditor.vue');
const ProcessViewer = () => import('../components/ProcessViewer.vue');

const routes = [
  { path: '/', name: 'home', component: ProcessList },
  { path: '/editor/:id', name: 'editor', component: ProcessEditor },
  { path: '/viewer/:id', name: 'viewer', component: ProcessViewer },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
