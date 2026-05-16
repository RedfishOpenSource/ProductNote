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

      <button
        class="video-detail-preview"
        type="button"
        @click="openDetailSheet"
        @touchcancel="handlePreviewTouchEnd"
        @touchend="handlePreviewTouchEnd"
        @touchmove="handlePreviewTouchMove"
        @touchstart="handlePreviewTouchStart"
      >
        <div class="video-detail-heading">
          <strong>{{ product.name }}</strong>
          <span class="video-detail-price">{{ formatPrice(product.price) }}</span>
        </div>
        <div class="video-detail-footer">
          <span class="video-detail-supplier">{{ product.supplierName || '未填写供应商' }}</span>
          <span class="video-detail-action">
            <el-icon><ArrowUp /></el-icon>
            点击展开
          </span>
        </div>
      </button>

      <button v-if="detailSheetOpen" class="detail-sheet-backdrop" type="button" aria-label="关闭详情" @click="closeDetailSheet" />

      <section :class="['detail-sheet', { 'is-open': detailSheetOpen, 'is-dragging': detailSheetDragging }]" :style="detailSheetStyle">
        <div
          class="detail-sheet-header"
          @touchcancel="handleDetailSheetTouchEnd"
          @touchend="handleDetailSheetTouchEnd"
          @touchmove="handleDetailSheetTouchMove"
          @touchstart="handleDetailSheetTouchStart"
        >
          <span class="detail-sheet-handle" aria-hidden="true" />
          <div class="detail-sheet-hero">
            <span class="detail-sheet-tag">商品详情</span>
            <div class="detail-sheet-title-row">
              <h2>{{ product.name }}</h2>
              <p>{{ formatPrice(product.price) }}</p>
            </div>
            <span class="detail-sheet-subtitle">{{ product.supplierName || '未填写供应商' }}</span>
          </div>
        </div>

        <div class="detail-sheet-body">
          <section class="detail-sheet-section">
            <h3>商品描述</h3>
            <p class="detail-sheet-description">{{ product.description || '暂无商品描述' }}</p>
          </section>
          <div class="detail-sheet-meta">
            <div>
              <span>供应商</span>
              <strong>{{ product.supplierName || '未填写供应商' }}</strong>
            </div>
            <div>
              <span>联系电话</span>
              <strong>{{ product.supplierPhone || '未填写电话' }}</strong>
            </div>
            <div>
              <span>附件数量</span>
              <strong>{{ product.attachments.length }} 个附件</strong>
            </div>
          </div>
          <el-button plain @click="goDetail">进入完整详情页</el-button>
        </div>
      </section>
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
import { ArrowUp, Back, Loading, Picture } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resolveFileUrl } from '../services/file-service'
import { formatPrice } from '../services/product-format'
import { getProductById } from '../services/product-store'
import { isVideoStoredFile } from '../types/product'
import type { Product, StoredFile } from '../types/product'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const product = ref<Product | null>(null)
const activeMediaType = ref<'image' | 'video'>('image')
const activeMediaUrl = ref('')
const detailSheetOpen = ref(false)
const detailSheetDragging = ref(false)
const detailSheetDragOffsetY = ref(0)
const detailSheetGestureAxis = ref<'x' | 'y' | null>(null)
const detailSheetGestureStartX = ref(0)
const detailSheetGestureStartY = ref(0)
const previewGestureAxis = ref<'x' | 'y' | null>(null)
const previewGestureStartX = ref(0)
const previewGestureStartY = ref(0)

const gestureAxisThreshold = 8
const previewOpenThreshold = 32
const detailSheetDismissThreshold = 120
const detailSheetMaxDragOffset = 420

const productId = computed(() => String(route.params.id ?? ''))
const showVideoPlayer = computed(() => activeMediaType.value === 'video' && Boolean(activeMediaUrl.value) && Boolean(product.value))
const detailSheetStyle = computed(() => ({
  '--detail-sheet-offset': `${detailSheetOpen.value ? detailSheetDragOffsetY.value : 100}%`,
  '--detail-sheet-transition': detailSheetDragging.value ? 'none' : 'transform 220ms ease-out',
}))

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

function resetDetailSheetPosition(): void {
  detailSheetDragging.value = false
  detailSheetDragOffsetY.value = 0
}

function openDetailSheet(): void {
  resetDetailSheetPosition()
  detailSheetOpen.value = true
}

function closeDetailSheet(): void {
  resetDetailSheetPosition()
  detailSheetOpen.value = false
}

function resetDetailSheetGesture(): void {
  detailSheetGestureAxis.value = null
  resetDetailSheetPosition()
}

function resetPreviewGesture(): void {
  previewGestureAxis.value = null
}

function resolveGestureAxis(deltaX: number, deltaY: number): 'x' | 'y' | null {
  if (Math.abs(deltaX) < gestureAxisThreshold && Math.abs(deltaY) < gestureAxisThreshold) {
    return null
  }

  return Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
}

function handlePreviewTouchStart(event: TouchEvent): void {
  if (event.touches.length !== 1) {
    resetPreviewGesture()
    return
  }

  const touch = event.touches[0]
  previewGestureStartX.value = touch.clientX
  previewGestureStartY.value = touch.clientY
  previewGestureAxis.value = null
}

function handlePreviewTouchMove(event: TouchEvent): void {
  if (event.touches.length !== 1) {
    return
  }

  const touch = event.touches[0]
  const deltaX = touch.clientX - previewGestureStartX.value
  const deltaY = touch.clientY - previewGestureStartY.value

  if (!previewGestureAxis.value) {
    previewGestureAxis.value = resolveGestureAxis(deltaX, deltaY)
  }

  if (previewGestureAxis.value === 'y' && deltaY < -previewOpenThreshold) {
    openDetailSheet()
    resetPreviewGesture()
  }
}

function handlePreviewTouchEnd(): void {
  resetPreviewGesture()
}

function handleDetailSheetTouchStart(event: TouchEvent): void {
  if (!detailSheetOpen.value || event.touches.length !== 1) {
    resetDetailSheetGesture()
    return
  }

  const touch = event.touches[0]
  detailSheetGestureStartX.value = touch.clientX
  detailSheetGestureStartY.value = touch.clientY
  detailSheetGestureAxis.value = null
  detailSheetDragging.value = false
}

function handleDetailSheetTouchMove(event: TouchEvent): void {
  if (!detailSheetOpen.value || event.touches.length !== 1) {
    return
  }

  const touch = event.touches[0]
  const deltaX = touch.clientX - detailSheetGestureStartX.value
  const deltaY = touch.clientY - detailSheetGestureStartY.value

  if (!detailSheetGestureAxis.value) {
    detailSheetGestureAxis.value = resolveGestureAxis(deltaX, deltaY)
  }

  if (detailSheetGestureAxis.value !== 'y' || deltaY <= 0) {
    return
  }

  event.preventDefault()
  detailSheetDragging.value = true
  detailSheetDragOffsetY.value = Math.min(deltaY, detailSheetMaxDragOffset)
}

function handleDetailSheetTouchEnd(): void {
  if (!detailSheetDragging.value) {
    resetDetailSheetGesture()
    return
  }

  if (detailSheetDragOffsetY.value > detailSheetDismissThreshold) {
    closeDetailSheet()
    return
  }

  resetDetailSheetGesture()
  detailSheetOpen.value = true
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

  activeMediaType.value = 'image'
  return currentProduct.image ?? null
}

async function loadProduct(): Promise<void> {
  loading.value = true
  closeDetailSheet()

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
  overflow: hidden;
}

.fullscreen-video {
  display: block;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  object-fit: contain;
  background: #000000;
}

.video-detail-preview {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
  z-index: 2;
  display: grid;
  gap: 6px;
  width: auto;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 20px;
  background: rgba(15, 18, 24, 0.1);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.14);
  backdrop-filter: blur(4px);
  color: #ffffff;
  text-align: left;
}

.video-detail-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.video-detail-heading strong {
  min-width: 0;
  overflow: hidden;
  color: #ffffff;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.video-detail-price {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.video-detail-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.video-detail-supplier {
  min-width: 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.82);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}

.video-detail-action {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.94);
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}

.video-detail-action .el-icon {
  font-size: 12px;
}

.detail-sheet-backdrop {
  position: absolute;
  inset: 0;
  z-index: 3;
  border: 0;
  background: rgba(4, 7, 12, 0.38);
}

.detail-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: min(56vh, 56dvh);
  max-height: min(88vh, 88dvh);
  border-radius: 32px 32px 0 0;
  background: rgba(248, 249, 252, 0.98);
  box-shadow: 0 -14px 40px rgba(0, 0, 0, 0.18);
  color: var(--app-title);
  transform: translate3d(0, 100%, 0);
  transition: var(--detail-sheet-transition, transform 220ms ease-out);
  will-change: transform;
}

.detail-sheet.is-open {
  transform: translate3d(0, var(--detail-sheet-offset, 0px), 0);
}

.detail-sheet.is-dragging {
  transition: none;
}

.detail-sheet-header {
  padding: 12px 18px 18px;
  touch-action: none;
}

.detail-sheet-handle {
  display: block;
  width: 48px;
  height: 5px;
  margin: 0 auto 16px;
  border-radius: 999px;
  background: rgba(17, 19, 24, 0.14);
}

.detail-sheet-hero {
  display: grid;
  gap: 12px;
}

.detail-sheet-tag {
  display: inline-flex;
  width: fit-content;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(64, 158, 255, 0.12);
  color: var(--app-primary-dark);
  font-size: 12px;
}

.detail-sheet-title-row {
  display: grid;
  gap: 8px;
}

.detail-sheet-title-row h2 {
  margin: 0;
  font-size: 26px;
  line-height: 1.25;
}

.detail-sheet-title-row p {
  margin: 0;
  color: var(--app-primary);
  font-size: 18px;
  font-weight: 700;
}

.detail-sheet-subtitle {
  color: var(--app-text-secondary);
  font-size: 14px;
}

.detail-sheet-body {
  display: grid;
  gap: 16px;
  overflow-y: auto;
  padding: 0 18px calc(env(safe-area-inset-bottom, 0px) + 24px);
  overscroll-behavior: contain;
}

.detail-sheet-section,
.detail-sheet-meta div {
  background: rgba(255, 255, 255, 0.96);
  box-shadow: inset 0 0 0 1px rgba(17, 19, 24, 0.04);
}

.detail-sheet-section {
  padding: 18px;
  border-radius: 22px;
}

.detail-sheet-section h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.detail-sheet-description {
  margin: 0;
  color: var(--app-text-secondary);
  line-height: 1.75;
}

.detail-sheet-meta {
  display: grid;
  gap: 12px;
}

.detail-sheet-meta div {
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 22px;
}

.detail-sheet-meta span {
  color: var(--app-text-secondary);
  font-size: 13px;
}

.detail-sheet-meta strong {
  color: var(--app-title);
  font-size: 16px;
}

.detail-sheet :deep(.el-button) {
  min-height: 50px;
  border-radius: 18px;
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
  .video-detail-preview {
    left: 10px;
    right: 10px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 6px);
    padding: 9px 10px;
  }

  .video-detail-heading strong {
    font-size: 14px;
  }

  .video-detail-price,
  .video-detail-supplier,
  .video-detail-action {
    font-size: 10px;
  }

  .detail-sheet {
    min-height: min(58vh, 58dvh);
    max-height: min(90vh, 90dvh);
  }

  .detail-sheet-title-row h2 {
    font-size: 24px;
  }

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
