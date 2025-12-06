import { createRouter, createWebHistory } from 'vue-router';
import ProcessList from '../components/ProcessList.vue';
import ProcessEditor from '../components/ProcessEditor.vue';
import ProcessViewer from '../components/ProcessViewer.vue';

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
