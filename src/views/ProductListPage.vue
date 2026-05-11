<template>
  <div
    class="page-shell product-list-page"
    @touchend="handlePageTouchEnd"
    @touchmove.passive="handlePageTouchMove"
    @touchstart.passive="handlePageTouchStart"
  >
    <div class="page-top-shell">
      <header class="page-header panel-card">
        <h1 class="page-title">商品管理</h1>
      </header>

      <div class="sticky-search-panel">
        <div class="search-row">
          <el-input
            v-model="searchText"
            class="search-box"
            clearable
            placeholder="搜索商品名称、供应商或电话"
            :prefix-icon="Search"
          />
          <el-button class="photo-search-button" :loading="searchingByPhoto" type="primary" @click="handlePhotoSearch">
            <el-icon><Camera /></el-icon>
          </el-button>
        </div>

        <div class="toolbar-grid panel-card">
          <div class="toolbar-row toolbar-row-bottom">
            <el-button class="tool-button" @click="openSettings">
              <el-icon><Setting /></el-icon>
              设置
            </el-button>
            <el-radio-group v-model="viewMode" class="view-mode-group">
              <el-radio-button label="card">
                <span class="view-mode-label">
                  <el-icon><Grid /></el-icon>
                  卡片
                </span>
              </el-radio-button>
              <el-radio-button label="list">
                <span class="view-mode-label">
                  <el-icon><Menu /></el-icon>
                  列表
                </span>
              </el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <div class="summary-row">
          <span>共 {{ filteredProducts.length }} 件商品</span>
          <button v-if="photoSearchResults" class="summary-action" type="button" @click="clearPhotoSearch">
            <el-icon><CircleCloseFilled /></el-icon>
            清除图片搜索
          </button>
          <span v-else>{{ searchText ? '已按搜索词过滤' : '显示全部商品' }}</span>
        </div>

        <div v-if="photoSearchSummary" class="photo-search-hint panel-card">
          {{ photoSearchSummary }}
        </div>
      </div>
    </div>

    <div class="results-scroll-area">
      <div v-if="loading" class="loading-box panel-card">
        <el-icon class="is-loading loading-icon"><Loading /></el-icon>
        <span>正在读取商品数据...</span>
      </div>

      <div v-else-if="filteredProducts.length === 0" class="empty-box panel-card">
        <el-icon class="empty-icon"><Box /></el-icon>
        <h2>还没有商品</h2>
        <p>先点“新增商品”，把常卖商品录进去。</p>
        <el-button type="primary" @click="goCreate">马上新增</el-button>
      </div>

      <div v-else-if="viewMode === 'card'" class="card-grid">
        <button
          v-for="product in filteredProducts"
          :key="product.id"
          class="product-card panel-card"
          type="button"
          @click="goEdit(product.id)"
        >
          <div class="product-card-top">
            <img v-if="imageMap[product.id]" :src="imageMap[product.id]" class="product-image" alt="商品图片" />
            <div v-else class="product-image placeholder-box">
              <el-icon><Box /></el-icon>
            </div>

            <div class="product-main">
              <div class="product-headline">
                <div>
                  <div class="headline-row">
                    <h3>{{ product.name }}</h3>
                    <span v-if="matchMap[product.id]" class="match-badge">{{ matchMap[product.id].matchLevel }}</span>
                  </div>
                  <p class="description-line">{{ product.description || '暂无商品描述' }}</p>
                </div>
                <strong class="price-text">{{ formatPrice(product.price) }}</strong>
              </div>
              <div class="chip-row">
                <el-tag class="meta-tag" effect="plain" round>
                  <el-icon><OfficeBuilding /></el-icon>
                  <span>{{ product.supplierName || '未填写供应商' }}</span>
                </el-tag>
                <el-tag class="meta-tag" effect="plain" round>
                  <el-icon><Document /></el-icon>
                  <span>{{ product.attachments.length }} 个附件</span>
                </el-tag>
              </div>
            </div>
          </div>
        </button>
      </div>

      <div v-else class="list-box panel-card">
        <button
          v-for="product in filteredProducts"
          :key="product.id"
          class="list-item"
          type="button"
          @click="goEdit(product.id)"
        >
          <div class="thumb-box">
            <img v-if="imageMap[product.id]" :src="imageMap[product.id]" alt="商品图片" />
            <div v-else class="placeholder-box small-placeholder">
              <el-icon><Box /></el-icon>
            </div>
          </div>
          <div class="list-main">
            <h2>{{ product.name }}</h2>
            <p>{{ product.description || '暂无商品描述' }}</p>
            <p>{{ product.supplierName || '未填写供应商' }} · {{ product.supplierPhone || '未填写电话' }}</p>
          </div>
          <div class="list-end">
            <span class="price-note">{{ formatPrice(product.price) }}</span>
            <span v-if="matchMap[product.id]" class="match-badge list-badge">{{ matchMap[product.id].matchLevel }}</span>
          </div>
        </button>
      </div>
    </div>

    <el-drawer v-model="settingsOpen" class="settings-drawer" direction="ltr" size="82%" :with-header="false">
      <div
        class="settings-drawer-body"
        @touchend="handleDrawerTouchEnd"
        @touchmove.passive="handleDrawerTouchMove"
        @touchstart.passive="handleDrawerTouchStart"
      >
        <div class="settings-header panel-card">
          <h2 class="settings-title">设置</h2>
          <p class="settings-description">从屏幕左侧边缘右滑可打开，面板内右滑可关闭。</p>
        </div>

        <section class="panel-card settings-section">
          <div class="settings-section-head">
            <h3>数据管理</h3>
            <p>导入会覆盖当前商品数据。</p>
          </div>
          <el-button class="settings-action" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出数据
          </el-button>
          <el-button class="settings-action" @click="openImportPicker">
            <el-icon><Upload /></el-icon>
            导入数据
          </el-button>
        </section>
      </div>
    </el-drawer>

    <input
      ref="importInput"
      accept=".json,application/json"
      class="hidden-input"
      type="file"
      @change="handleImport"
    />
    <input
      ref="photoSearchInput"
      accept="image/*"
      class="hidden-input"
      type="file"
      @change="handlePhotoSearchFileSelected"
    />

    <button class="floating-add-button" type="button" @click="goCreate">
      <el-icon><Plus /></el-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  Box,
  Camera,
  CircleCloseFilled,
  Document,
  Download,
  Grid,
  Loading,
  Menu,
  OfficeBuilding,
  Plus,
  Search,
  Setting,
  Upload,
} from '@element-plus/icons-vue'
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { exportProducts, importProducts } from '../services/backup-service'
import { deleteStoredFile, readImportFile, resolveFileUrl, saveFile, savePhotoBlob } from '../services/file-service'
import { listProducts } from '../services/product-store'
import {
  ensureVisualIndexes,
  isVisualSearchSupported,
  searchProductsByStoredFile,
} from '../services/visual-search-service'
import type { Product, StoredFile, ViewMode } from '../types/product'
import type { VisualSearchResult } from '../types/visual-search'

const router = useRouter()
const products = ref<Product[]>([])
const loading = ref(true)
const searchText = ref('')
const viewMode = ref<ViewMode>('card')
const imageMap = ref<Record<string, string>>({})
const importInput = ref<HTMLInputElement | null>(null)
const photoSearchInput = ref<HTMLInputElement | null>(null)
const photoSearchResults = ref<VisualSearchResult[] | null>(null)
const photoSearchSummary = ref('')
const preparingVisualIndex = ref(false)
const searchingByPhoto = ref(false)
const settingsOpen = ref(false)
const gestureStartX = ref(0)
const gestureStartY = ref(0)
const gestureTracking = ref<'page' | 'drawer' | null>(null)
const gestureHandled = ref(false)
const isWebPlatform = Capacitor.getPlatform() === 'web'

const drawerSwipeEdge = 24
const drawerSwipeThreshold = 56

const textFilteredProducts = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return products.value

  return products.value.filter((product) => {
    return [product.name, product.description, product.supplierName, product.supplierPhone]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const filteredProducts = computed(() => {
  if (!photoSearchResults.value) return textFilteredProducts.value

  const map = new Map(textFilteredProducts.value.map((product) => [product.id, product]))
  return photoSearchResults.value
    .map((item) => map.get(item.productId))
    .filter((item): item is Product => Boolean(item))
})

const matchMap = computed(() => {
  return Object.fromEntries((photoSearchResults.value ?? []).map((item) => [item.productId, item])) as Record<
    string,
    VisualSearchResult
  >
})

function showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
  const type = color === 'danger' ? 'error' : color
  ElMessage({
    message,
    type,
  })
}

function formatPrice(price: number | null) {
  if (price === null || Number.isNaN(price)) return '未填写价格'
  return `¥ ${price.toFixed(2)}`
}

async function refreshImages() {
  const entries = await Promise.all(
    products.value.map(async (product) => {
      return [product.id, await resolveFileUrl(product.image)] as const
    }),
  )

  imageMap.value = Object.fromEntries(entries)
}

async function prepareVisualSearch(notify = false) {
  if (!isVisualSearchSupported() || products.value.length === 0 || preparingVisualIndex.value) return

  preparingVisualIndex.value = true
  if (notify) {
    showToast('正在准备图片搜索，请稍候')
  }

  try {
    await ensureVisualIndexes(products.value)
  } catch (error) {
    console.error(error)
    if (notify) {
      showToast('图片搜索准备失败，请稍后重试', 'danger')
    }
  } finally {
    preparingVisualIndex.value = false
  }
}

async function loadData() {
  loading.value = true
  products.value = await listProducts()
  await refreshImages()
  loading.value = false
  void prepareVisualSearch(false)
}

function goCreate() {
  router.push('/product/new')
}

function goEdit(id: string) {
  router.push(`/product/${id}`)
}

function resetGesture(): void {
  gestureTracking.value = null
  gestureHandled.value = false
}

function openSettings(): void {
  settingsOpen.value = true
}

function closeSettings(): void {
  settingsOpen.value = false
}

function startGesture(area: 'page' | 'drawer', touch: Touch): void {
  gestureStartX.value = touch.clientX
  gestureStartY.value = touch.clientY
  gestureTracking.value = area
  gestureHandled.value = false
}

function shouldHandleHorizontalSwipe(event: TouchEvent, area: 'page' | 'drawer'): Touch | null {
  if (gestureTracking.value !== area || gestureHandled.value || event.touches.length !== 1) {
    return null
  }

  const touch = event.touches[0]
  const deltaX = touch.clientX - gestureStartX.value
  const deltaY = touch.clientY - gestureStartY.value

  if (Math.abs(deltaX) <= Math.abs(deltaY) || deltaX < drawerSwipeThreshold) {
    return null
  }

  return touch
}

function openImportPicker(): void {
  importInput.value?.click()
}

function openPhotoSearchPicker(): void {
  photoSearchInput.value?.click()
}

function clearPhotoSearch(): void {
  photoSearchResults.value = null
  photoSearchSummary.value = ''
}

function handlePageTouchStart(event: TouchEvent): void {
  if (settingsOpen.value || event.touches.length !== 1) {
    resetGesture()
    return
  }

  const touch = event.touches[0]
  if (touch.clientX > drawerSwipeEdge) {
    resetGesture()
    return
  }

  startGesture('page', touch)
}

function handlePageTouchMove(event: TouchEvent): void {
  if (!shouldHandleHorizontalSwipe(event, 'page')) {
    return
  }

  openSettings()
  gestureHandled.value = true
}

function handlePageTouchEnd(): void {
  if (gestureTracking.value === 'page') {
    resetGesture()
  }
}

function handleDrawerTouchStart(event: TouchEvent): void {
  if (!settingsOpen.value || event.touches.length !== 1) {
    resetGesture()
    return
  }

  startGesture('drawer', event.touches[0])
}

function handleDrawerTouchMove(event: TouchEvent): void {
  if (!shouldHandleHorizontalSwipe(event, 'drawer')) {
    return
  }

  closeSettings()
  gestureHandled.value = true
}

function handleDrawerTouchEnd(): void {
  if (gestureTracking.value === 'drawer') {
    resetGesture()
  }
}

async function handleExport(): Promise<void> {
  try {
    await exportProducts(products.value)
    closeSettings()
    showToast('备份文件已导出')
  } catch (error) {
    console.error(error)
    showToast('导出失败，请稍后重试', 'danger')
  }
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) return

  const confirmed = window.confirm('导入会覆盖当前商品数据，确定继续吗？')
  if (!confirmed) return

  try {
    const content = await readImportFile(file)
    const count = await importProducts(content)
    closeSettings()
    clearPhotoSearch()
    await loadData()
    showToast(`已导入 ${count} 件商品`)
  } catch (error) {
    console.error(error)
    showToast('导入失败，请检查备份文件', 'danger')
  }
}

async function applyPhotoSearch(tempFile: StoredFile, emptySummary: string): Promise<void> {
  const results = await searchProductsByStoredFile(tempFile, products.value)
  photoSearchResults.value = results
  photoSearchSummary.value = results.length ? '已按图片匹配，最像的是这些商品' : emptySummary

  if (results.length === 0) {
    showToast('没有找到相似商品', 'warning')
    return
  }

  showToast('已完成图片搜索')
}

async function runPhotoSearch(
  createTempFile: () => Promise<StoredFile | null>,
  emptySummary: string,
): Promise<void> {
  searchingByPhoto.value = true
  let tempFile: StoredFile | null = null

  try {
    tempFile = await createTempFile()
    if (!tempFile) return
    await applyPhotoSearch(tempFile, emptySummary)
  } catch (error) {
    console.error(error)
    showToast('图片搜索失败，请稍后重试', 'danger')
  } finally {
    if (tempFile) {
      await deleteStoredFile(tempFile)
    }
    searchingByPhoto.value = false
  }
}

async function handlePhotoSearchFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file || searchingByPhoto.value) return

  await runPhotoSearch(async () => saveFile(file, 'image'), '没有找到足够相似的商品，请换张图片再试试')
}

async function handlePhotoSearch(): Promise<void> {
  if (!isVisualSearchSupported()) {
    showToast('当前环境暂不支持图片搜索', 'warning')
    return
  }

  if (products.value.length === 0) {
    showToast('请先录入带图片的商品', 'warning')
    return
  }

  if (searchingByPhoto.value) return

  if (isWebPlatform) {
    openPhotoSearchPicker()
    return
  }

  await runPhotoSearch(async () => {
    await prepareVisualSearch(true)

    const photo = await CapacitorCamera.getPhoto({
      quality: 75,
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
    })

    if (!photo.webPath) {
      return null
    }

    const response = await fetch(photo.webPath)
    const blob = await response.blob()
    const mimeType = blob.type || (photo.format ? `image/${photo.format}` : 'image/jpeg')
    return savePhotoBlob(blob, mimeType)
  }, '没有找到足够相似的商品，请换个角度再拍一次')
}

onMounted(async () => {
  await loadData()
})
</script>

<style scoped>
.product-list-page {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: 128px;
  overflow: hidden;
}

.page-top-shell {
  flex-shrink: 0;
}

.page-header {
  margin-bottom: 0;
}

.sticky-search-panel {
  margin: 0 -4px;
  padding: 12px 4px 8px;
  background: var(--app-bg);
}

.results-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 4px 88px;
  margin: 0 -4px;
}

.search-row {
  display: grid;
  grid-template-columns: 1fr 56px;
  gap: 10px;
  align-items: center;
}

.search-box {
  margin-bottom: 16px;
}

:deep(.search-box .el-input__wrapper) {
  border-radius: 18px;
  box-shadow: var(--app-shadow);
  padding: 6px 14px;
}

.photo-search-button {
  height: 48px;
  margin: 0 0 16px;
  border-radius: 18px;
}

.toolbar-grid {
  padding: 14px;
  margin-bottom: 14px;
}

.toolbar-row {
  display: grid;
  grid-template-columns: 116px minmax(0, 1fr);
  gap: 12px;
}

.toolbar-row-bottom {
  align-items: stretch;
}

.tool-button {
  min-height: 48px;
}

.view-mode-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

:deep(.view-mode-group .el-radio-button__inner) {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}

.view-mode-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 4px 2px 0;
  color: var(--app-text-secondary);
  font-size: 14px;
}

.summary-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  font-size: 14px;
}

.photo-search-hint {
  margin-top: 12px;
  padding: 12px 16px;
  color: var(--app-primary-dark);
  font-size: 14px;
}

.loading-box,
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 220px;
  padding: 20px;
  text-align: center;
}

.loading-icon {
  font-size: 28px;
}

.empty-icon {
  font-size: 54px;
  color: var(--app-primary);
}

.card-grid {
  display: grid;
  gap: 14px;
}

.product-card {
  width: 100%;
  border: 0;
  text-align: left;
  background: #ffffff;
  cursor: pointer;
}

.product-card-top {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 14px;
}

.product-image {
  width: 88px;
  height: 88px;
  border-radius: 16px;
  object-fit: cover;
  background: #f5f7fa;
}

.placeholder-box {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-muted);
}

.product-main {
  min-width: 0;
}

.product-headline {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.headline-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.product-headline h3 {
  margin: 0;
  font-size: 18px;
  color: var(--app-title);
}

.match-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(64, 158, 255, 0.14);
  color: var(--app-primary-dark);
  font-size: 12px;
  white-space: nowrap;
}

.price-text {
  color: var(--app-danger);
  font-size: 18px;
  white-space: nowrap;
}

.description-line {
  margin: 8px 0 10px;
  color: var(--app-text-secondary);
  line-height: 1.5;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-tag :deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.list-box {
  overflow: hidden;
  padding: 0;
}

.list-item {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  border-bottom: 1px solid rgba(220, 223, 230, 0.8);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.list-item:last-child {
  border-bottom: 0;
}

.thumb-box {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  overflow: hidden;
}

.thumb-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.small-placeholder {
  width: 100%;
  height: 100%;
  background: #f5f7fa;
}

.list-main {
  min-width: 0;
}

.list-main h2 {
  margin: 0;
  color: var(--app-title);
  font-size: 16px;
}

.list-main p {
  margin: 6px 0 0;
  color: var(--app-text-secondary);
  line-height: 1.4;
}

.list-end {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.list-badge {
  font-size: 11px;
}

.price-note {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-danger);
}

.settings-header {
  margin-bottom: 12px;
}

.settings-title {
  margin: 0;
  color: var(--app-title);
  font-size: 22px;
}

.settings-description {
  margin: 10px 0 0;
  color: var(--app-text-secondary);
  line-height: 1.5;
}

.settings-section-head h3 {
  margin: 0;
  color: var(--app-title);
  font-size: 18px;
}

.settings-section-head p {
  margin: 8px 0 0;
  color: var(--app-text-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.settings-action {
  width: 100%;
  min-height: 48px;
  margin-top: 12px;
}

.hidden-input {
  display: none;
}

:deep(.settings-drawer) {
  max-width: 420px;
}

:deep(.settings-drawer .el-drawer__body) {
  padding: 16px;
  background: var(--app-bg);
}

.settings-drawer-body {
  min-height: 100%;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
}

.floating-add-button {
  position: fixed;
  right: 20px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 20px);
  z-index: 9999;
  width: 56px;
  height: 56px;
  border: 0;
  border-radius: 18px;
  background: var(--app-primary);
  color: #ffffff;
  box-shadow: 0 10px 20px rgba(64, 158, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  cursor: pointer;
}

@media (max-width: 640px) {
  .toolbar-row {
    grid-template-columns: 104px minmax(0, 1fr);
  }

  .list-item {
    grid-template-columns: 56px minmax(0, 1fr);
  }

  .list-end {
    grid-column: 2;
    align-items: flex-start;
  }
}
</style>
