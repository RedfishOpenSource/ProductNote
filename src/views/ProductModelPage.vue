<template>
  <div class="page-shell model-page">
    <header class="page-header panel-card model-page-header">
      <button class="header-back-button" type="button" aria-label="返回上一页" @click="goBack">
        <el-icon><Back /></el-icon>
      </button>
      <div class="header-copy">
        <h1 class="page-title">{{ product?.name || '3D 模型' }}</h1>
        <p v-if="product?.model3d">{{ product.model3d.sourceType === 'video' ? '短视频生成' : '多图生成' }}</p>
      </div>
      <el-button v-if="productId" type="primary" plain @click="goEdit">编辑商品</el-button>
    </header>

    <section v-if="loading" class="panel-card model-state">
      <el-icon class="is-loading model-state-icon"><Loading /></el-icon>
      <span>正在加载 3D 模型...</span>
    </section>

    <section v-else-if="!product || !product.model3d || !modelUrl" class="panel-card model-state">
      <el-icon class="model-state-icon"><Box /></el-icon>
      <h2>还没有 3D 模型</h2>
      <el-button type="primary" @click="goEdit">返回商品编辑页</el-button>
    </section>

    <template v-else>
      <section class="panel-card model-stage">
        <ProductModelViewer :src="modelUrl" />
      </section>

      <section class="panel-card model-meta">
        <div>
          <span class="meta-label">模型文件</span>
          <strong>{{ product.model3d.file.name }}</strong>
        </div>
        <div>
          <span class="meta-label">生成时间</span>
          <strong>{{ formatDateTime(product.model3d.generatedAt) }}</strong>
        </div>
        <div>
          <span class="meta-label">生成方式</span>
          <strong>{{ product.model3d.sourceType === 'video' ? '短视频建模' : '多图建模' }}</strong>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Back, Box, Loading } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProductModelViewer from '../components/ProductModelViewer.vue'
import { resolveFileUrl } from '../services/file-service'
import { getProductById } from '../services/product-store'
import type { Product } from '../types/product'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const product = ref<Product | null>(null)
const modelUrl = ref('')

const productId = computed(() => String(route.params.id ?? ''))

function formatDateTime(value: string): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

function goBack(): void {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.replace('/')
}

function goEdit(): void {
  if (!productId.value) {
    router.replace('/')
    return
  }

  router.push(`/product/${productId.value}`)
}

async function loadModelPage(): Promise<void> {
  loading.value = true
  const currentProduct = await getProductById(productId.value)
  product.value = currentProduct
  modelUrl.value = currentProduct?.model3d ? await resolveFileUrl(currentProduct.model3d.file) : ''
  loading.value = false
}

onMounted(async () => {
  await loadModelPage()
})
</script>

<style scoped>
.model-page {
  display: grid;
  gap: 12px;
}

.model-page-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.header-back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: #f4f6fb;
  color: var(--app-title);
  cursor: pointer;
}

.header-back-button .el-icon {
  font-size: 20px;
}

.header-copy {
  min-width: 0;
}

.header-copy p {
  margin: 6px 0 0;
  color: var(--app-text-secondary);
  font-size: 12px;
}

.model-state {
  display: grid;
  justify-items: center;
  gap: 12px;
  min-height: 280px;
  text-align: center;
}

.model-state-icon {
  font-size: 40px;
  color: var(--app-primary);
}

.model-stage,
.model-meta {
  padding: 12px;
}

.model-meta {
  display: grid;
  gap: 12px;
}

.model-meta div {
  display: grid;
  gap: 4px;
}

.meta-label {
  color: var(--app-text-secondary);
  font-size: 12px;
}

@media (max-width: 640px) {
  .model-page-header {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .model-page-header :deep(.el-button) {
    grid-column: 1 / -1;
    width: 100%;
  }
}
</style>
