<template>
  <div :class="['page-shell', 'media-page', { 'media-page-video': showVideoPlayer }]">
    <section v-if="loading" class="panel-card media-state">
      <el-icon class="is-loading media-state-icon"><Loading /></el-icon>
      <span>正在读取商品媒体...</span>
    </section>

    <section v-else-if="!product" class="panel-card media-state">
      <el-icon class="media-state-icon"><Picture /></el-icon>
      <h2>商品不存在</h2>
      <el-button type="primary" @click="goHome">返回列表</el-button>
    </section>

    <section v-else-if="showVideoPlayer" class="video-player-shell">
      <video
        :src="activeMediaUrl"
        class="fullscreen-video"
        controls
        autoplay
        playsinline
        preload="auto"
        webkit-playsinline="true"
      />

      <button class="overlay-back-button" type="button" aria-label="返回上一页" @click="goBack">
        <el-icon><Back /></el-icon>
      </button>

      <el-button class="video-detail-button" type="primary" @click="goDetail">进入详情页</el-button>
    </section>

    <template v-else>
      <header class="media-header panel-card">
        <button class="header-back-button" type="button" aria-label="返回上一页" @click="goBack">
          <el-icon><Back /></el-icon>
        </button>

        <div class="header-copy">
          <h1>{{ product.name }}</h1>
          <p>图片展示</p>
        </div>

        <el-button type="primary" plain @click="goDetail">查看详情</el-button>
      </header>

      <section v-if="activeMediaUrl" class="panel-card media-stage">
        <img :src="activeMediaUrl" class="media-view" alt="商品图片" />
      </section>

      <section v-else class="panel-card media-state">
        <el-icon class="media-state-icon"><Picture /></el-icon>
        <h2>还没有可展示的图片或视频</h2>
        <el-button type="primary" @click="goDetail">去补充资料</el-button>
      </section>

      <section class="panel-card media-info">
        <div>
          <p class="info-label">商品名称</p>
          <h2>{{ product.name }}</h2>
        </div>
        <p class="info-description">{{ product.description || '暂无商品描述' }}</p>
        <div class="info-meta">
          <span>{{ product.supplierName || '未填写供应商' }}</span>
          <span>{{ product.supplierPhone || '未填写电话' }}</span>
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
import { resolveFileUrl } from '../services/file-service'
import { getProductById } from '../services/product-store'
import { isVideoStoredFile } from '../types/product'
import type { Product, StoredFile } from '../types/product'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const product = ref<Product | null>(null)
const activeMediaType = ref<'image' | 'video'>('image')
const activeMediaUrl = ref('')

const productId = computed(() => String(route.params.id ?? ''))
const showVideoPlayer = computed(() => activeMediaType.value === 'video' && Boolean(activeMediaUrl.value) && Boolean(product.value))

function goHome() {
  router.replace('/')
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  goHome()
}

function goDetail() {
  if (!productId.value) {
    goHome()
    return
  }

  router.push(`/product/${productId.value}`)
}

function resolvePrimaryMedia(currentProduct: Product): StoredFile | null {
  const firstVideo = currentProduct.attachments.find((file) => isVideoStoredFile(file))
  if (firstVideo) {
    activeMediaType.value = 'video'
    return firstVideo
  }

  if (currentProduct.image) {
    activeMediaType.value = 'image'
    return currentProduct.image
  }

  activeMediaType.value = 'image'
  return null
}

async function loadProduct() {
  loading.value = true

  const currentProduct = await getProductById(productId.value)
  product.value = currentProduct

  if (!currentProduct) {
    activeMediaUrl.value = ''
    loading.value = false
    return
  }

  const primaryMedia = resolvePrimaryMedia(currentProduct)
  activeMediaUrl.value = await resolveFileUrl(primaryMedia)
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

.media-page-video {
  gap: 0;
}

.media-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
}

.header-back-button,
.overlay-back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 14px;
  color: var(--app-title);
  cursor: pointer;
}

.header-back-button {
  background: #f4f6fb;
}

.overlay-back-button {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 16px);
  left: 16px;
  z-index: 2;
  background: rgba(17, 19, 24, 0.52);
  color: #ffffff;
  backdrop-filter: blur(8px);
}

.header-back-button .el-icon,
.overlay-back-button .el-icon {
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

.video-player-shell {
  position: fixed;
  inset: 0;
  background: #000000;
}

.fullscreen-video {
  display: block;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  object-fit: contain;
  background: #000000;
}

.video-detail-button {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
  z-index: 2;
  min-height: 48px;
}

.media-stage {
  padding: 10px;
  background: #111318;
}

.media-view {
  display: block;
  width: 100%;
  max-height: calc(100vh - 280px);
  max-height: calc(100dvh - 280px);
  border-radius: 18px;
  object-fit: contain;
  background: #111318;
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

.info-description {
  margin: 0;
  color: var(--app-text-secondary);
  line-height: 1.6;
}

.info-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--app-text-secondary);
  font-size: 14px;
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
    max-height: calc(100vh - 320px);
    max-height: calc(100dvh - 320px);
  }
}
</style>
