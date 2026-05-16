import { createRouter, createWebHistory } from 'vue-router'
import ProductFormPage from '../views/ProductFormPage.vue'
import ProductListPage from '../views/ProductListPage.vue'
import ProductMediaPage from '../views/ProductMediaPage.vue'
import ProductModelPage from '../views/ProductModelPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'products',
      component: ProductListPage,
    },
    {
      path: '/product/new',
      name: 'product-create',
      component: ProductFormPage,
    },
    {
      path: '/product/:id/media',
      name: 'product-media',
      component: ProductMediaPage,
    },
    {
      path: '/product/:id/model',
      name: 'product-model',
      component: ProductModelPage,
    },
    {
      path: '/product/:id',
      name: 'product-edit',
      component: ProductFormPage,
    },
  ],
})

export default router
