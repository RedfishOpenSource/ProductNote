<template>
  <div
    class="page-shell product-list-page"
    @touchend="handlePageTouchEnd"
    @touchmove.passive="handlePageTouchMove"
    @touchstart.passive="handlePageTouchStart"
  >
    <div class="page-top-shell">
      <div v-if="searchOpen" class="search-mode-shell">
        <div class="search-mode-bar panel-card">
          <button class="icon-button" type="button" @click="closeSearch">
            <el-icon><Back /></el-icon>
          </button>
          <el-input
            ref="searchInput"
            v-model="searchText"
            class="search-mode-box"
            clearable
            placeholder="搜索商品名称、供应商或电话"
            :prefix-icon="Search"
            @keyup.enter="commitTextSearch"
          />
          <el-button class="photo-search-inline-button" :loading="searchingByPhoto" circle type="primary" @click="handlePhotoSearch">
            <el-icon><Camera /></el-icon>
          </el-button>
          <button class="search-submit-button" type="button" @click="commitTextSearch">搜索</button>
        </div>
      </div>

      <div v-else class="top-icon-bar panel-card">
        <button class="icon-button hamburger-button" type="button" aria-label="打开设置" @click="openSettings">
          <span />
          <span />
          <span />
        </button>

        <div class="view-mode-strip">
          <button
            class="view-icon-button"
            :class="{ active: viewMode === 'card' }"
            type="button"
            title="卡片展示"
            @click="selectViewMode('card')"
          >
            <el-icon><Grid /></el-icon>
          </button>
          <button
            class="view-icon-button"
            :class="{ active: viewMode === 'feed' }"
            type="button"
            title="短视频风格"
            @click="selectViewMode('feed')"
          >
            <el-icon><VideoCamera /></el-icon>
          </button>
        </div>

        <button class="icon-button" type="button" aria-label="打开搜索" @click="openSearch">
          <el-icon><Search /></el-icon>
        </button>
      </div>

      <div v-if="!showSearchHistoryPanel" class="summary-row">
        <span>共 {{ filteredProducts.length }} 件商品</span>
        <button v-if="hasActiveFilters" class="summary-action" type="button" @click="clearActiveFilters">
          <el-icon><CircleCloseFilled /></el-icon>
          清除搜索
        </button>
        <span v-else>显示全部商品</span>
      </div>

      <div v-if="photoSearchSummary && !showSearchHistoryPanel" class="photo-search-hint panel-card">
        {{ photoSearchSummary }}
      </div>
    </div>

    <div class="results-scroll-area">
      <section v-if="showSearchHistoryPanel" class="panel-card history-panel">
        <div class="history-panel-head">
          <h2>历史记录</h2>
          <button v-if="searchHistory.length" class="history-clear-button" type="button" @click="clearStoredSearchHistory">清空</button>
        </div>

        <p v-if="searchHistory.length === 0" class="subtle-note">还没有搜索记录，试试输入商品名、供应商电话，或者直接拍照搜索。</p>
        <div v-else class="history-chip-list">
          <div v-for="keyword in searchHistory" :key="keyword" class="history-chip-row">
            <button class="history-chip" type="button" @click="applySearchHistory(keyword)">
              {{ keyword }}
            </button>
            <button class="history-remove-button" type="button" @click="removeStoredHistoryItem(keyword)">×</button>
          </div>
        </div>
      </section>

      <template v-else>
        <div v-if="loading" class="loading-box panel-card">
          <el-icon class="is-loading loading-icon"><Loading /></el-icon>
          <span>正在读取商品数据...</span>
        </div>

        <div v-else-if="filteredProducts.length === 0" class="empty-box panel-card">
          <el-icon class="empty-icon"><Box /></el-icon>
          <h2>{{ emptyStateTitle }}</h2>
          <p>{{ emptyStateDescription }}</p>
          <el-button type="primary" @click="handleEmptyAction">{{ emptyStateActionLabel }}</el-button>
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
                    <span>{{ product.supplierName || '未填写供应商' }}</span>
                  </el-tag>
                  <el-tag class="meta-tag" effect="plain" round>
                    <span>{{ product.attachments.length }} 个附件</span>
                  </el-tag>
                  <el-tag v-if="productHasVideo(product)" class="meta-tag" effect="plain" round type="danger">
                    <span>含视频</span>
                  </el-tag>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div v-else class="feed-grid">
          <button
            v-for="product in filteredProducts"
            :key="product.id"
            class="feed-card panel-card"
            type="button"
            @click="goMedia(product.id)"
          >
            <div class="feed-media">
              <img v-if="imageMap[product.id]" :src="imageMap[product.id]" class="feed-image" alt="商品图片" />
              <div v-else class="feed-image placeholder-box feed-placeholder">
                <el-icon><Box /></el-icon>
              </div>

              <span v-if="matchMap[product.id]" class="match-badge feed-match-badge">{{ matchMap[product.id].matchLevel }}</span>
              <span v-if="productHasVideo(product)" class="feed-video-badge">
                <el-icon><VideoCamera /></el-icon>
                视频
              </span>
            </div>

            <div class="feed-body">
              <strong class="feed-price">{{ formatPrice(product.price) }}</strong>
              <h2>{{ product.name }}</h2>
              <p>{{ product.supplierName || '未填写供应商' }}</p>
            </div>
          </button>
        </div>
      </template>
    </div>

    <el-drawer
      v-model="settingsOpen"
      class="settings-drawer"
      direction="ltr"
      size="82%"
      :with-header="false"
      :close-on-click-modal="true"
      @closed="resetGesture"
      @touchend="handleDrawerTouchEnd"
      @touchmove.passive="handleDrawerTouchMove"
      @touchstart.passive="handleDrawerTouchStart"
    >
      <div
        class="settings-drawer-body"
        @touchend="handleDrawerTouchEnd"
        @touchmove.passive="handleDrawerTouchMove"
        @touchstart.passive="handleDrawerTouchStart"
      >
        <div class="settings-header panel-card">
          <h2 class="settings-title">设置</h2>
          <p class="settings-description">点击空白区域或在面板内向左滑动，可关闭设置抽屉。</p>
        </div>

        <section class="panel-card settings-section">
          <div class="settings-section-head">
            <h3>数据管理</h3>
            <p>导入会覆盖当前商品数据。</p>
          </div>
          <div class="settings-action-stack">
            <el-button class="settings-action" @click="handleExport">
              <el-icon><Download /></el-icon>
              导出数据
            </el-button>
            <el-button class="settings-action" @click="openImportPicker">
              <el-icon><Upload /></el-icon>
              导入数据
            </el-button>
          </div>
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
  Back,
  Box,
  Camera,
  CircleCloseFilled,
  Download,
  Grid,
  Loading,
  Plus,
  Search,
  Upload,
  VideoCamera,
} from '@element-plus/icons-vue'
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'
import { ElMessage } from 'element-plus'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { exportProducts, importProducts } from '../services/backup-service'
import { deleteStoredFile, readImportFile, resolveFileUrl, saveFile, savePhotoBlob } from '../services/file-service'
import {
  clearSearchHistory,
  getListViewMode,
  getSearchHistory,
  pushSearchHistory,
  removeSearchHistory,
  setListViewMode,
} from '../services/list-ui-store'
import { listProducts } from '../services/product-store'
import {
  ensureVisualIndexes,
  isVisualSearchSupported,
  searchProductsByStoredFile,
} from '../services/visual-search-service'
import { isVideoStoredFile } from '../types/product'
import type { Product, StoredFile, ViewMode } from '../types/product'
import type { VisualSearchResult } from '../types/visual-search'

type GestureArea = 'page' | 'drawer'
type SwipeDirection = 'left' | 'right'

type SearchInputHandle = {
  focus: () => void
}

const router = useRouter()
const products = ref<Product[]>([])
const loading = ref(true)
const searchOpen = ref(false)
const searchText = ref('')
const viewMode = ref<ViewMode>('card')
const searchHistory = ref<string[]>([])
const imageMap = ref<Record<string, string>>({})
const importInput = ref<HTMLInputElement | null>(null)
const photoSearchInput = ref<HTMLInputElement | null>(null)
const searchInput = ref<SearchInputHandle | null>(null)
const photoSearchResults = ref<VisualSearchResult[] | null>(null)
const photoSearchSummary = ref('')
const preparingVisualIndex = ref(false)
const searchingByPhoto = ref(false)
const settingsOpen = ref(false)
const gestureStartX = ref(0)
const gestureStartY = ref(0)
const gestureTracking = ref<GestureArea | null>(null)
const gestureHandled = ref(false)
const isWebPlatform = Capacitor.getPlatform() === 'web'

const drawerSwipeEdge = 24
const drawerSwipeThreshold = 40

const hasActiveFilters = computed(() => Boolean(searchText.value.trim() || photoSearchResults.value))
const showSearchHistoryPanel = computed(() => searchOpen.value && !hasActiveFilters.value)
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
const emptyStateTitle = computed(() => (hasActiveFilters.value ? '没有找到商品' : '还没有商品'))
const emptyStateDescription = computed(() => {
  if (hasActiveFilters.value) {
    return '换个关键词、清除图片搜索，或者试试别的展示方式。'
  }

  return '先点“新增商品”，把常卖商品录进去。'
})
const emptyStateActionLabel = computed(() => (hasActiveFilters.value ? '清除搜索' : '马上新增'))

function showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
  const type = color === 'danger' ? 'error' : color
  ElMessage({
    message,
    type,
  })
}

function productHasVideo(product: Product): boolean {
  return product.attachments.some((file) => isVideoStoredFile(file))
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

async function loadUiState() {
  const [storedViewMode, storedSearchHistory] = await Promise.all([getListViewMode(), getSearchHistory()])
  viewMode.value = storedViewMode
  searchHistory.value = storedSearchHistory
}

function goCreate() {
  router.push('/product/new')
}

function goEdit(id: string) {
  router.push(`/product/${id}`)
}

function goMedia(id: string) {
  router.push(`/product/${id}/media`)
}

function handleEmptyAction() {
  if (hasActiveFilters.value) {
    clearActiveFilters()
    return
  }

  goCreate()
}

function clearPhotoSearch(): void {
  photoSearchResults.value = null
  photoSearchSummary.value = ''
}

function clearActiveFilters() {
  searchText.value = ''
  clearPhotoSearch()
}

async function selectViewMode(mode: ViewMode): Promise<void> {
  if (viewMode.value === mode) {
    return
  }

  viewMode.value = mode
  await setListViewMode(mode)
}

async function openSearch() {
  searchOpen.value = true
  await nextTick()
  searchInput.value?.focus()
}

function closeSearch() {
  searchOpen.value = false
}

async function commitTextSearch() {
  const keyword = searchText.value.trim()
  if (!keyword) return

  searchText.value = keyword
  searchHistory.value = await pushSearchHistory(keyword)
}

async function applySearchHistory(keyword: string) {
  searchText.value = keyword
  await commitTextSearch()
}

async function removeStoredHistoryItem(keyword: string) {
  searchHistory.value = await removeSearchHistory(keyword)
}

async function clearStoredSearchHistory() {
  await clearSearchHistory()
  searchHistory.value = []
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

function startGesture(area: GestureArea, touch: Touch): void {
  gestureStartX.value = touch.clientX
  gestureStartY.value = touch.clientY
  gestureTracking.value = area
  gestureHandled.value = false
}

function hasPassedSwipeThreshold(deltaX: number, direction: SwipeDirection): boolean {
  if (direction === 'right') {
    return deltaX > drawerSwipeThreshold
  }

  return deltaX < -drawerSwipeThreshold
}

function shouldHandleHorizontalSwipe(
  event: TouchEvent,
  area: GestureArea,
  direction: SwipeDirection,
): Touch | null {
  if (gestureTracking.value !== area || gestureHandled.value || event.touches.length !== 1) {
    return null
  }

  const touch = event.touches[0]
  const deltaX = touch.clientX - gestureStartX.value
  const deltaY = touch.clientY - gestureStartY.value
  const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY)

  if (!isHorizontalSwipe || !hasPassedSwipeThreshold(deltaX, direction)) {
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
  if (!shouldHandleHorizontalSwipe(event, 'page', 'right')) {
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
  if (!shouldHandleHorizontalSwipe(event, 'drawer', 'left')) {
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
    clearActiveFilters()
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

  if (searchOpen.value) {
    await commitTextSearch()
  }

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
  await Promise.all([loadData(), loadUiState()])
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
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
  overflow: hidden;
}

.page-top-shell {
  flex-shrink: 0;
  display: grid;
  gap: 12px;
}

.top-icon-bar,
.search-mode-bar {
  display: grid;
  align-items: center;
  gap: 10px;
  padding: 12px;
}

.top-icon-bar {
  grid-template-columns: 48px minmax(0, 1fr) 48px;
}

.search-mode-shell {
  display: grid;
  gap: 12px;
}

.search-mode-bar {
  grid-template-columns: 44px minmax(0, 1fr) 44px auto;
}

.icon-button {
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

.icon-button .el-icon,
.view-icon-button .el-icon {
  font-size: 20px;
}

.hamburger-button {
  flex-direction: column;
  gap: 4px;
}

.hamburger-button span {
  display: block;
  width: 16px;
  height: 1.5px;
  border-radius: 999px;
  background: currentColor;
}

.view-mode-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 4px;
  border-radius: 18px;
  background: #f4f6fb;
}

.view-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
}

.view-icon-button.active {
  background: #ffffff;
  color: var(--app-primary);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.18);
}

:deep(.search-mode-box .el-input__wrapper) {
  border-radius: 18px;
  background: #f4f6fb;
  box-shadow: none;
  padding: 8px 14px;
}

.photo-search-inline-button {
  width: 44px;
  height: 44px;
}

.search-submit-button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.results-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 4px calc(env(safe-area-inset-bottom, 0px) + 32px);
  margin: 0 -4px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 0 2px;
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
  cursor: pointer;
}

.photo-search-hint {
  padding: 12px 16px;
  color: var(--app-primary-dark);
  font-size: 14px;
}

.history-panel {
  padding: 18px;
}

.history-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.history-panel-head h2 {
  margin: 0;
  font-size: 22px;
  color: var(--app-title);
}

.history-clear-button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  font-size: 14px;
  cursor: pointer;
}

.subtle-note {
  margin: 14px 0 0;
  color: var(--app-text-secondary);
  line-height: 1.6;
}

.history-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}

.history-chip-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 6px 10px 6px 14px;
  border-radius: 999px;
  background: #f4f6fb;
}

.history-chip,
.history-remove-button {
  border: 0;
  background: transparent;
  color: var(--app-title);
  cursor: pointer;
}

.history-chip {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-remove-button {
  color: var(--app-text-secondary);
  font-size: 16px;
  line-height: 1;
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


.feed-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.feed-card {
  width: 100%;
  border: 0;
  padding: 0;
  overflow: hidden;
  text-align: left;
  background: #ffffff;
  cursor: pointer;
}

.feed-media {
  position: relative;
  aspect-ratio: 3 / 4;
  background: #f5f7fa;
}

.feed-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-placeholder {
  width: 100%;
  height: 100%;
}

.feed-match-badge,
.feed-video-badge {
  position: absolute;
  top: 10px;
}

.feed-match-badge {
  left: 10px;
}

.feed-video-badge {
  right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(31, 45, 61, 0.62);
  color: #ffffff;
  font-size: 12px;
}

.feed-body {
  display: grid;
  gap: 8px;
  padding: 12px;
}

.feed-price {
  color: var(--app-danger);
  font-size: 16px;
}

.feed-body h2 {
  margin: 0;
  color: var(--app-title);
  font-size: 16px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.feed-body p {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: 13px;
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

.settings-action-stack {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.settings-action {
  width: 100%;
  min-height: 48px;
  margin: 0;
}

.settings-action-stack :deep(.el-button + .el-button) {
  margin-left: 0;
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
  touch-action: pan-y;
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
  .search-mode-bar {
    grid-template-columns: 40px minmax(0, 1fr) 40px auto;
  }

  .history-chip-list {
    gap: 10px;
  }

  .history-chip {
    max-width: 140px;
  }
}
</style>
