import { createRouter, createWebHistory } from 'vue-router';

const ProcessList = () => import('../components/ProcessList.vue');
const ProcessEditor = () => import('../components/ProcessEditor.vue');
const ProcessViewer = () => import('../components/ProcessViewer.vue');
const ThemeAdmin = () => import('../components/ThemeAdmin.vue');

const routes = [
  { path: '/', name: 'home', component: ProcessList },
  { path: '/editor/:id', name: 'editor', component: ProcessEditor },
  { path: '/viewer/:id', name: 'viewer', component: ProcessViewer },
  { path: '/admin/themes', name: 'theme-admin', component: ThemeAdmin },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
