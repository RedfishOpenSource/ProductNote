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
      :class="['settings-drawer', { 'is-dragging': drawerDragging }]"
      :style="drawerStyle"
      direction="ltr"
      size="82%"
      :with-header="false"
      :close-on-click-modal="true"
      @closed="resetGesture"
    >
      <div
        class="settings-drawer-body"
        @touchcancel="handleDrawerTouchEnd"
        @touchend="handleDrawerTouchEnd"
        @touchmove="handleDrawerTouchMove"
        @touchstart="handleDrawerTouchStart"
      >
        <div class="settings-header panel-card">
          <span class="settings-swipe-handle" aria-hidden="true" />
          <h2 class="settings-title">设置</h2>
          <p class="settings-description">点击空白区域，或在面板里向左滑动后松手，即可关闭设置抽屉。</p>
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

    <el-drawer v-model="createEntryOpen" class="create-entry-drawer" direction="btt" size="auto" :with-header="false">
      <div class="create-entry-body">
        <span class="settings-swipe-handle" aria-hidden="true" />
        <div class="create-entry-head">
          <h2>新增商品</h2>
          <p>可使用相机快速录入，也可直接语音预填。</p>
        </div>

        <div class="create-entry-grid">
          <button
            class="create-entry-card"
            type="button"
            :disabled="createEntryBusy"
            @touchcancel.prevent="handleCreateCameraTouchCancel"
            @touchend.prevent="handleCreateCameraTouchEnd"
            @touchstart.prevent="handleCreateCameraTouchStart"
            @mousedown="handleCreateCameraMouseStart"
            @mouseleave="handleCreateCameraMouseLeave"
            @mouseup="handleCreateCameraMouseEnd"
            @contextmenu.prevent
            @click="handleCreateCameraClick"
          >
            <strong>相机</strong>
            <span>点按拍照，长按拍视频</span>
          </button>
          <button class="create-entry-card" type="button" :disabled="createEntryBusy" @click="startAiCreate">
            <strong>{{ createEntryBusy ? '识别中...' : 'AI 录入' }}</strong>
            <span>语音转文字并预填字段</span>
          </button>
        </div>
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
    <input
      ref="createPhotoCaptureInput"
      accept="image/*"
      capture="environment"
      class="hidden-input"
      type="file"
      @change="handleCreatePhotoCaptured"
    />
    <input
      ref="createVideoCaptureInput"
      accept="video/*"
      capture="environment"
      class="hidden-input"
      type="file"
      @change="handleCreateVideoCaptured"
    />

    <button class="floating-add-button" type="button" @click="openCreateEntry">
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
import { buildDraftFromSpeechText } from '../services/local-ai-entry-service'
import { isOfflineSpeechSupported, startOfflineSpeechRecognition } from '../services/offline-speech-service'
import { clearPendingProductCreateDraft, setPendingProductCreateDraft } from '../services/product-create-draft'
import type { ProductCreateDraft } from '../services/product-create-draft'
import { formatPrice } from '../services/product-format'
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
import { getPrimaryProductImage, isVideoStoredFile } from '../types/product'
import type { Product, StoredFile, ViewMode } from '../types/product'
import type { VisualSearchResult } from '../types/visual-search'

type SwipeAxis = 'x' | 'y'

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
const createPhotoCaptureInput = ref<HTMLInputElement | null>(null)
const createVideoCaptureInput = ref<HTMLInputElement | null>(null)
const searchInput = ref<SearchInputHandle | null>(null)
const photoSearchResults = ref<VisualSearchResult[] | null>(null)
const photoSearchSummary = ref('')
const preparingVisualIndex = ref(false)
const searchingByPhoto = ref(false)
const settingsOpen = ref(false)
const createEntryOpen = ref(false)
const createEntryBusy = ref(false)
const createCameraLongPressTimer = ref<number | null>(null)
const createCameraLongPressTriggered = ref(false)
const createCameraSuppressClick = ref(false)
const createCameraTouchActive = ref(false)
const pageGestureStartX = ref(0)
const pageGestureStartY = ref(0)
const pageGestureAxis = ref<SwipeAxis | null>(null)
const pageGestureActive = ref(false)
const drawerGestureStartX = ref(0)
const drawerGestureStartY = ref(0)
const drawerGestureAxis = ref<SwipeAxis | null>(null)
const drawerDragging = ref(false)
const drawerDragOffsetX = ref(0)
const drawerPanelWidth = ref(0)
const isWebPlatform = Capacitor.getPlatform() === 'web'

const drawerSwipeEdge = 24
const drawerSwipeThreshold = 40
const drawerDragStartThreshold = 8
const drawerCloseThreshold = 72
const createCameraLongPressThreshold = 420

const drawerStyle = computed(() => ({
  '--settings-drawer-offset': `${drawerDragOffsetX.value}px`,
  '--settings-drawer-transition': drawerDragging.value ? 'none' : 'transform 180ms ease-out',
}))

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

function showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success'): void {
  const type = color === 'danger' ? 'error' : color
  ElMessage({
    message,
    type,
  })
}

function productHasVideo(product: Product): boolean {
  return product.attachments.some((file) => isVideoStoredFile(file))
}

async function refreshImages(): Promise<void> {
  const entries = await Promise.all(
    products.value.map(async (product) => {
      return [product.id, await resolveFileUrl(getPrimaryProductImage(product))] as const
    }),
  )

  imageMap.value = Object.fromEntries(entries)
}

async function prepareVisualSearch(notify = false): Promise<void> {
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

async function loadData(): Promise<void> {
  loading.value = true
  products.value = await listProducts()
  await refreshImages()
  loading.value = false
  void prepareVisualSearch(false)
}

async function loadUiState(): Promise<void> {
  const [storedViewMode, storedSearchHistory] = await Promise.all([getListViewMode(), getSearchHistory()])
  viewMode.value = storedViewMode
  searchHistory.value = storedSearchHistory
}

function clearCreateCameraTimer(): void {
  if (createCameraLongPressTimer.value !== null) {
    window.clearTimeout(createCameraLongPressTimer.value)
    createCameraLongPressTimer.value = null
  }
}

function resetCreateCameraInteraction(): void {
  clearCreateCameraTimer()
  createCameraLongPressTriggered.value = false
}

function closeCreateEntry(): void {
  resetCreateCameraInteraction()
  createCameraSuppressClick.value = false
  createCameraTouchActive.value = false
  createEntryOpen.value = false
}

function openCreateEntry(): void {
  closeSettings()
  createEntryOpen.value = true
}

function startCreateWithDraft(draft: ProductCreateDraft | null = null): void {
  if (draft) {
    setPendingProductCreateDraft(draft)
  } else {
    clearPendingProductCreateDraft()
  }

  closeCreateEntry()
  router.push('/product/new')
}

function openFileInput(input: HTMLInputElement | null): void {
  input?.click()
}

function consumeSelectedFile(event: Event): File | null {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return null
  }

  const file = target.files?.[0] ?? null
  target.value = ''
  return file
}

async function saveCapturedPhoto(webPath: string, format?: string): Promise<StoredFile> {
  const response = await fetch(webPath)
  const blob = await response.blob()
  const mimeType = blob.type || (format ? `image/${format}` : 'image/jpeg')
  return savePhotoBlob(blob, mimeType)
}

async function openCreatePhotoCapture(): Promise<void> {
  if (isWebPlatform) {
    openFileInput(createPhotoCaptureInput.value)
    return
  }

  createEntryBusy.value = true

  try {
    const photo = await CapacitorCamera.getPhoto({
      quality: 75,
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
    })

    if (!photo.webPath) {
      return
    }

    const image = await saveCapturedPhoto(photo.webPath, photo.format)
    startCreateWithDraft({ image, images: [image] })
  } catch (error) {
    console.error(error)
    showToast('拍照新建失败，请稍后重试', 'danger')
  } finally {
    createEntryBusy.value = false
  }
}

function openCreateVideoCapture(): void {
  openFileInput(createVideoCaptureInput.value)
}

function releaseCreateCameraClickSuppression(): void {
  window.setTimeout(() => {
    createCameraSuppressClick.value = false
    createCameraTouchActive.value = false
  }, 0)
}

function handleCreateCameraPressStart(): void {
  if (createEntryBusy.value) return

  resetCreateCameraInteraction()
  createCameraSuppressClick.value = true
  createCameraLongPressTimer.value = window.setTimeout(() => {
    createCameraLongPressTimer.value = null
    createCameraLongPressTriggered.value = true
  }, createCameraLongPressThreshold)
}

async function finishCreateCameraPress(options: { allowPhoto: boolean; allowVideo: boolean }): Promise<void> {
  if (createEntryBusy.value) {
    return
  }

  const longPressTriggered = createCameraLongPressTriggered.value
  resetCreateCameraInteraction()

  if (longPressTriggered && options.allowVideo) {
    openCreateVideoCapture()
    releaseCreateCameraClickSuppression()
    return
  }

  if (options.allowPhoto) {
    await openCreatePhotoCapture()
  }

  releaseCreateCameraClickSuppression()
}

function handleCreateCameraTouchStart(): void {
  createCameraTouchActive.value = true
  handleCreateCameraPressStart()
}

async function handleCreateCameraTouchEnd(): Promise<void> {
  await finishCreateCameraPress({ allowPhoto: true, allowVideo: true })
}

async function handleCreateCameraTouchCancel(): Promise<void> {
  await finishCreateCameraPress({ allowPhoto: false, allowVideo: true })
}

function handleCreateCameraMouseStart(): void {
  if (createCameraTouchActive.value) {
    return
  }

  handleCreateCameraPressStart()
}

async function handleCreateCameraMouseEnd(): Promise<void> {
  if (createCameraTouchActive.value) {
    return
  }

  await finishCreateCameraPress({ allowPhoto: true, allowVideo: true })
}

function handleCreateCameraMouseLeave(): void {
  if (createCameraTouchActive.value) {
    return
  }

  resetCreateCameraInteraction()
  releaseCreateCameraClickSuppression()
}

async function handleCreateCameraClick(): Promise<void> {
  if (createEntryBusy.value) return

  if (createCameraSuppressClick.value || createCameraTouchActive.value) {
    return
  }

  await openCreatePhotoCapture()
}

async function createVideoCoverBlob(file: File): Promise<Blob> {
  const sourceUrl = URL.createObjectURL(file)

  try {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true

    await new Promise<void>((resolve, reject) => {
      const handleLoaded = () => {
        cleanup()
        resolve()
      }
      const handleError = () => {
        cleanup()
        reject(new Error('无法读取视频内容'))
      }
      const cleanup = () => {
        video.removeEventListener('loadeddata', handleLoaded)
        video.removeEventListener('error', handleError)
      }

      video.addEventListener('loadeddata', handleLoaded)
      video.addEventListener('error', handleError)
      video.src = sourceUrl
      video.load()
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, video.videoWidth)
    canvas.height = Math.max(1, video.videoHeight)
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('当前设备不支持生成视频封面')
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
          return
        }

        reject(new Error('无法生成视频封面'))
      }, 'image/jpeg', 0.92)
    })
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

async function startCreateFromImageFile(file: File, failureMessage: string): Promise<void> {
  try {
    const image = await saveFile(file, 'image')
    startCreateWithDraft({ image, images: [image] })
  } catch (error) {
    console.error(error)
    showToast(failureMessage, 'danger')
  }
}

async function handleCreatePhotoCaptured(event: Event): Promise<void> {
  const file = consumeSelectedFile(event)
  if (!file) return

  await startCreateFromImageFile(file, '拍照新建失败，请稍后重试')
}

async function handleCreateVideoCaptured(event: Event): Promise<void> {
  const file = consumeSelectedFile(event)
  if (!file) return

  createEntryBusy.value = true

  try {
    const [coverBlob, videoAttachment] = await Promise.all([createVideoCoverBlob(file), saveFile(file, 'attachment')])
    const image = await savePhotoBlob(coverBlob, 'image/jpeg')
    startCreateWithDraft({
      image,
      images: [image],
      attachments: [videoAttachment],
    })
  } catch (error) {
    console.error(error)
    showToast('拍视频新建失败，请稍后重试', 'danger')
  } finally {
    createEntryBusy.value = false
  }
}

async function startAiCreate(): Promise<void> {
  if (!isOfflineSpeechSupported()) {
    showToast('当前环境暂不支持语音录入', 'warning')
    return
  }

  createEntryBusy.value = true
  showToast('请开始说话，系统会自动预填商品信息')

  try {
    const result = await startOfflineSpeechRecognition('请说出商品名称、价格、描述和供应商信息')
    startCreateWithDraft(buildDraftFromSpeechText(result.text))
    showToast('已根据语音内容预填表单')
  } catch (error) {
    console.error(error)
    showToast(error instanceof Error ? error.message : 'AI 录入失败，请稍后重试', 'warning')
  } finally {
    createEntryBusy.value = false
  }
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

  openCreateEntry()
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

function resetPageGesture(): void {
  pageGestureActive.value = false
  pageGestureAxis.value = null
}

function resetDrawerGesture(): void {
  drawerGestureAxis.value = null
  drawerDragging.value = false
  drawerDragOffsetX.value = 0
  drawerPanelWidth.value = 0
}

function resetGesture(): void {
  resetPageGesture()
  resetDrawerGesture()
}

function openSettings(): void {
  closeCreateEntry()
  resetDrawerGesture()
  settingsOpen.value = true
}

function closeSettings(): void {
  settingsOpen.value = false
}

function lockGestureAxis(deltaX: number, deltaY: number): SwipeAxis | null {
  if (Math.abs(deltaX) < drawerDragStartThreshold && Math.abs(deltaY) < drawerDragStartThreshold) {
    return null
  }

  return Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
}

function resolveDrawerPanelWidth(event: TouchEvent): number {
  const currentTarget = event.currentTarget
  return currentTarget instanceof HTMLElement ? currentTarget.clientWidth : 0
}

function openImportPicker(): void {
  importInput.value?.click()
}

function openPhotoSearchPicker(): void {
  photoSearchInput.value?.click()
}

function handlePageTouchStart(event: TouchEvent): void {
  if (settingsOpen.value || event.touches.length !== 1) {
    resetPageGesture()
    return
  }

  const touch = event.touches[0]
  if (touch.clientX > drawerSwipeEdge) {
    resetPageGesture()
    return
  }

  pageGestureStartX.value = touch.clientX
  pageGestureStartY.value = touch.clientY
  pageGestureAxis.value = null
  pageGestureActive.value = true
}

function handlePageTouchMove(event: TouchEvent): void {
  if (!pageGestureActive.value || event.touches.length !== 1) {
    return
  }

  const touch = event.touches[0]
  const deltaX = touch.clientX - pageGestureStartX.value
  const deltaY = touch.clientY - pageGestureStartY.value

  if (!pageGestureAxis.value) {
    pageGestureAxis.value = lockGestureAxis(deltaX, deltaY)
  }

  if (pageGestureAxis.value !== 'x' || deltaX <= 0) {
    return
  }

  if (deltaX > drawerSwipeThreshold) {
    openSettings()
    resetPageGesture()
  }
}

function handlePageTouchEnd(): void {
  resetPageGesture()
}

function handleDrawerTouchStart(event: TouchEvent): void {
  if (!settingsOpen.value || event.touches.length !== 1) {
    resetDrawerGesture()
    return
  }

  const touch = event.touches[0]
  drawerGestureStartX.value = touch.clientX
  drawerGestureStartY.value = touch.clientY
  drawerGestureAxis.value = null
  drawerDragging.value = false
  drawerPanelWidth.value = resolveDrawerPanelWidth(event)
}

function handleDrawerTouchMove(event: TouchEvent): void {
  if (!settingsOpen.value || event.touches.length !== 1) {
    return
  }

  const touch = event.touches[0]
  const deltaX = touch.clientX - drawerGestureStartX.value
  const deltaY = touch.clientY - drawerGestureStartY.value

  if (!drawerGestureAxis.value) {
    drawerGestureAxis.value = lockGestureAxis(deltaX, deltaY)
  }

  if (drawerGestureAxis.value !== 'x') {
    return
  }

  if (deltaX >= 0) {
    drawerDragging.value = false
    drawerDragOffsetX.value = 0
    return
  }

  event.preventDefault()
  drawerDragging.value = true
  drawerDragOffsetX.value = Math.max(deltaX, -(drawerPanelWidth.value || Number.MAX_SAFE_INTEGER))
}

function handleDrawerTouchEnd(): void {
  if (!drawerGestureAxis.value) {
    resetDrawerGesture()
    return
  }

  if (drawerGestureAxis.value !== 'x' || !drawerDragging.value) {
    resetDrawerGesture()
    return
  }

  const draggedDistance = Math.abs(drawerDragOffsetX.value)
  const widthThreshold = drawerPanelWidth.value > 0 ? drawerPanelWidth.value * 0.25 : 0
  const shouldClose = draggedDistance >= Math.max(drawerCloseThreshold, widthThreshold)

  if (!shouldClose) {
    resetDrawerGesture()
    return
  }

  drawerDragging.value = false
  closeSettings()
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
  const file = consumeSelectedFile(event)
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

    return saveCapturedPhoto(photo.webPath, photo.format)
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
  gap: 10px;
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
  overflow: hidden;
}

.page-top-shell {
  flex-shrink: 0;
  display: grid;
  gap: 8px;
}

.top-icon-bar,
.search-mode-bar {
  display: grid;
  align-items: center;
  gap: 8px;
  padding: 10px;
}

.top-icon-bar {
  grid-template-columns: 40px minmax(0, 1fr) 40px;
}

.search-mode-shell {
  display: grid;
  gap: 8px;
}

.search-mode-bar {
  grid-template-columns: 40px minmax(0, 1fr) 40px auto;
}

.icon-button {
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

.icon-button .el-icon,
.view-icon-button .el-icon {
  font-size: 18px;
}

.hamburger-button {
  flex-direction: column;
  gap: 3px;
}

.hamburger-button span {
  display: block;
  width: 14px;
  height: 1.5px;
  border-radius: 999px;
  background: currentColor;
}

.view-mode-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 3px;
  border-radius: 16px;
  background: #f4f6fb;
}

.view-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
}

.view-icon-button.active {
  background: #ffffff;
  color: var(--app-primary);
  box-shadow: 0 4px 10px rgba(64, 158, 255, 0.16);
}

:deep(.search-mode-box .el-input__wrapper) {
  border-radius: 16px;
  background: #f4f6fb;
  box-shadow: none;
  padding: 6px 12px;
}

.photo-search-inline-button {
  width: 40px;
  height: 40px;
}

.search-submit-button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  font-size: 14px;
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
  gap: 8px;
  margin: 0 2px;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.summary-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  font-size: 13px;
  cursor: pointer;
}

.photo-search-hint {
  padding: 10px 14px;
  color: var(--app-primary-dark);
  font-size: 13px;
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
  gap: 10px;
}

.product-card {
  width: 100%;
  border: 0;
  padding: 12px;
  text-align: left;
  background: #ffffff;
  cursor: pointer;
}

.product-card-top {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 10px;
}

.product-image {
  width: 72px;
  height: 72px;
  border-radius: 14px;
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
  gap: 8px;
}

.headline-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.product-headline h3 {
  margin: 0;
  font-size: 16px;
  color: var(--app-title);
}

.match-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(64, 158, 255, 0.14);
  color: var(--app-primary-dark);
  font-size: 11px;
  white-space: nowrap;
}

.price-text {
  color: var(--app-danger);
  font-size: 16px;
  white-space: nowrap;
}

.description-line {
  margin: 4px 0 8px;
  color: var(--app-text-secondary);
  font-size: 13px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.meta-tag {
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
}

.meta-tag :deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
  touch-action: pan-y;
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

:deep(.create-entry-drawer .el-drawer) {
  border-radius: 24px 24px 0 0;
}

:deep(.create-entry-drawer .el-drawer__body) {
  padding: 16px;
  background: var(--app-bg);
}

.create-entry-body {
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
}

.create-entry-head h2 {
  margin: 0;
  color: var(--app-title);
  font-size: 20px;
}

.create-entry-head p {
  margin: 8px 0 0;
  color: var(--app-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.create-entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.create-entry-card {
  display: grid;
  gap: 6px;
  width: 100%;
  min-height: 92px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  padding: 14px;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
}

.create-entry-card:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.create-entry-card strong {
  color: var(--app-title);
  font-size: 15px;
}

.create-entry-card span {
  color: var(--app-text-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.hidden-input {
  display: none;
}

:deep(.settings-drawer) {
  max-width: 420px;
}

:deep(.settings-drawer .el-drawer) {
  transform: translate3d(var(--settings-drawer-offset, 0px), 0, 0);
  transition: var(--settings-drawer-transition, transform 180ms ease-out);
  will-change: transform;
}

:deep(.settings-drawer .el-drawer__body) {
  padding: 16px;
  background: var(--app-bg);
}

:deep(.settings-drawer.is-dragging .el-drawer__body) {
  overflow: hidden;
}

:deep(.settings-drawer.is-dragging .settings-section) {
  pointer-events: none;
}

.settings-drawer-body {
  min-height: 100%;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
  touch-action: pan-y;
  overscroll-behavior: contain;
}


.settings-swipe-handle {
  display: block;
  width: 44px;
  height: 5px;
  margin: 0 auto 12px;
  border-radius: 999px;
  background: rgba(17, 19, 24, 0.16);
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
    grid-template-columns: 36px minmax(0, 1fr) 36px auto;
  }

  .create-entry-grid {
    grid-template-columns: 1fr;
  }

  .product-card {
    padding: 10px;
  }

  .product-card-top {
    grid-template-columns: 68px 1fr;
    gap: 8px;
  }

  .product-image {
    width: 68px;
    height: 68px;
  }

  .history-chip-list {
    gap: 10px;
  }

  .history-chip {
    max-width: 140px;
  }
}
</style>
