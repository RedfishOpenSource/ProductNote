<template>
  <div class="page-shell media-page">
    <section v-if="loading" class="panel-card media-state">
      <el-icon class="is-loading media-state-icon"><Loading /></el-icon>
      <span>正在读取商品媒体...</span>
    </section>

    <section v-else-if="!product" class="panel-card media-state">
      <el-icon class="media-state-icon"><Picture /></el-icon>
      <h2>商品不存在</h2>
      <el-button type="primary" @click="goHome">返回列表</el-button>
    </section>

    <template v-else>
      <header class="media-header panel-card">
        <button class="header-back-button" type="button" aria-label="返回上一页" @click="goBack">
          <el-icon><Back /></el-icon>
        </button>

        <div class="header-copy">
          <h1>{{ product.name }}</h1>
          <p>{{ mediaSummary }}</p>
        </div>

        <el-button type="primary" plain @click="goDetail">查看详情</el-button>
      </header>

      <section v-if="mediaItems.length > 0" class="panel-card media-stage">
        <SwipeCarousel :items="mediaItems" aria-label="商品媒体轮播">
          <template #default="{ item }">
            <div class="media-slide">
              <img v-if="item.type === 'image'" :src="item.url" class="media-view" alt="商品图片" />
              <video v-else :src="item.url" class="media-view media-video" controls playsinline preload="metadata" />
              <span class="media-type-badge">{{ item.type === 'video' ? '视频' : '图片' }}</span>
            </div>
          </template>
        </SwipeCarousel>
      </section>

      <section v-else class="panel-card media-state">
        <el-icon class="media-state-icon"><Picture /></el-icon>
        <h2>还没有可展示的图片或视频</h2>
        <el-button type="primary" @click="goDetail">去补充资料</el-button>
      </section>

      <section class="panel-card media-info">
        <div class="info-head">
          <div>
            <p class="info-label">商品名称</p>
            <h2>{{ product.name }}</h2>
          </div>
          <strong class="info-price">{{ formatPrice(product.price) }}</strong>
        </div>

        <p class="info-description">{{ productDescription }}</p>

        <div class="info-chip-row">
          <span class="info-chip">{{ productSupplierName }}</span>
          <span class="info-chip">{{ productSupplierPhone }}</span>
          <span class="info-chip">{{ mediaSummary }}</span>
          <span class="info-chip">{{ attachmentCountLabel }}</span>
        </div>

        <el-button type="primary" @click="goDetail">进入详情页</el-button>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Back, Loading, Picture } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SwipeCarousel from '../components/SwipeCarousel.vue'
import { resolveFileUrl } from '../services/file-service'
import { formatPrice } from '../services/product-format'
import { getProductById } from '../services/product-store'
import { isVideoStoredFile } from '../types/product'
import type { Product, StoredFile } from '../types/product'

type MediaItem = {
  key: string
  type: 'image' | 'video'
  file: StoredFile
  url: string
}

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const product = ref<Product | null>(null)
const mediaItems = ref<MediaItem[]>([])

const productId = computed(() => String(route.params.id ?? ''))
const productDescription = computed(() => product.value?.description || '暂无商品描述')
const productSupplierName = computed(() => product.value?.supplierName || '未填写供应商')
const productSupplierPhone = computed(() => product.value?.supplierPhone || '未填写电话')
const imageCount = computed(() => mediaItems.value.filter((item) => item.type === 'image').length)
const videoCount = computed(() => mediaItems.value.filter((item) => item.type === 'video').length)
const attachmentCountLabel = computed(() => `${product.value?.attachments.length ?? 0} 个附件`)
const mediaSummary = computed(() => {
  if (mediaItems.value.length === 0) {
    return '暂无图片或视频'
  }

  const segments: string[] = []

  if (videoCount.value > 0) {
    segments.push(`${videoCount.value} 个视频`)
  }

  if (imageCount.value > 0) {
    segments.push(`${imageCount.value} 张图片`)
  }

  return segments.join(' · ')
})

function goHome(): void {
  router.replace('/')
}

function goBack(): void {
  if (window.history.length > 1) {
    router.back()
    return
  }

  goHome()
}

function goDetail(): void {
  if (!productId.value) {
    goHome()
    return
  }

  router.push(`/product/${productId.value}`)
}

function buildMediaFiles(currentProduct: Product): StoredFile[] {
  const videoFiles = currentProduct.attachments.filter((file) => isVideoStoredFile(file))
  return [...videoFiles, ...currentProduct.images]
}

async function loadProduct(): Promise<void> {
  loading.value = true

  const currentProduct = await getProductById(productId.value)
  product.value = currentProduct

  if (!currentProduct) {
    mediaItems.value = []
    loading.value = false
    return
  }

  mediaItems.value = await Promise.all(
    buildMediaFiles(currentProduct).map(async (file) => ({
      key: file.path,
      type: isVideoStoredFile(file) ? 'video' : 'image',
      file,
      url: await resolveFileUrl(file),
    })),
  )

  loading.value = false
}

onMounted(async () => {
  await loadProduct()
})
</script>

<style scoped>
.media-page {
  display: grid;
  gap: 14px;
}

.media-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
}

.header-back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 14px;
  background: #f4f6fb;
  color: var(--app-title);
  cursor: pointer;
}

.header-back-button .el-icon {
  font-size: 22px;
}

.header-copy {
  min-width: 0;
}

.header-copy h1 {
  margin: 0;
  color: var(--app-title);
  font-size: 20px;
}

.header-copy p {
  margin: 6px 0 0;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.media-stage {
  padding: 12px;
  background: #111318;
}

.media-slide {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 22px;
  background: #111318;
}

.media-view {
  display: block;
  width: 100%;
  min-height: clamp(260px, 58vh, 680px);
  max-height: clamp(260px, 70vh, 760px);
  object-fit: contain;
  background: #111318;
}

.media-video {
  background: #000000;
}

.media-type-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-size: 12px;
  backdrop-filter: blur(10px);
}

.media-state {
  display: grid;
  justify-items: center;
  gap: 12px;
  min-height: 240px;
  padding: 24px;
  text-align: center;
}

.media-state-icon {
  font-size: 40px;
  color: var(--app-primary);
}

.media-info {
  display: grid;
  gap: 16px;
}

.info-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.info-label {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.media-info h2 {
  margin: 6px 0 0;
  color: var(--app-title);
  font-size: 22px;
}

.info-price {
  flex-shrink: 0;
  color: var(--app-primary);
  font-size: 18px;
}

.info-description {
  margin: 0;
  color: var(--app-text-secondary);
  line-height: 1.7;
}

.info-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.info-chip {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: #f4f6fb;
  color: var(--app-text-secondary);
  font-size: 13px;
}

@media (max-width: 640px) {
  .media-header {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .media-header :deep(.el-button) {
    grid-column: 1 / -1;
    width: 100%;
  }

  .media-view {
    min-height: 240px;
    max-height: 60vh;
  }

  .info-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .info-price {
    font-size: 17px;
  }
}
</style>
