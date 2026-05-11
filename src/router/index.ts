import { createRouter, createWebHistory } from 'vue-router'
import ProductFormPage from '../views/ProductFormPage.vue'
import ProductListPage from '../views/ProductListPage.vue'

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
      path: '/product/:id',
      name: 'product-edit',
      component: ProductFormPage,
      props: true,
    },
  ],
})

export default router
