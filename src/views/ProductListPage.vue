<template>
  <ion-page>
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>商品管理</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="page-shell">
        <div class="sticky-search-panel">
          <div class="search-row">
            <ion-searchbar
              v-model="searchText"
              class="search-box"
              placeholder="搜索商品名称、供应商或电话"
              show-clear-button="focus"
            />
            <ion-button class="photo-search-button" @click="handlePhotoSearch">
              <ion-icon :icon="cameraOutline" />
            </ion-button>
          </div>

          <div class="toolbar-grid panel-card">
            <div class="toolbar-row">
              <ion-button expand="block" class="tool-button" @click="goCreate">
                <ion-icon :icon="addOutline" slot="start" />
                新增商品
              </ion-button>
              <ion-button expand="block" fill="outline" class="tool-button" @click="handleExport">
                <ion-icon :icon="cloudDownloadOutline" slot="start" />
                导出数据
              </ion-button>
            </div>
            <div class="toolbar-row">
              <ion-button expand="block" fill="outline" class="tool-button" @click="openImportPicker">
                <ion-icon :icon="cloudUploadOutline" slot="start" />
                导入数据
              </ion-button>
              <ion-segment v-model="viewMode" class="view-segment">
                <ion-segment-button value="card">
                  <ion-icon :icon="gridOutline" />
                  <ion-label>卡片</ion-label>
                </ion-segment-button>
                <ion-segment-button value="list">
                  <ion-icon :icon="listOutline" />
                  <ion-label>列表</ion-label>
                </ion-segment-button>
              </ion-segment>
            </div>
          </div>

          <div class="summary-row">
            <span>共 {{ filteredProducts.length }} 件商品</span>
            <button v-if="photoSearchResults" class="summary-action" type="button" @click="clearPhotoSearch">
              <ion-icon :icon="closeCircleOutline" />
              清除图片搜索
            </button>
            <span v-else>{{ searchText ? '已按搜索词过滤' : '显示全部商品' }}</span>
          </div>

          <div v-if="photoSearchSummary" class="photo-search-hint panel-card">
            {{ photoSearchSummary }}
          </div>
        </div>

        <div v-if="loading" class="loading-box panel-card">
          <ion-spinner name="crescent" />
          <span>正在读取商品数据...</span>
        </div>

        <div v-else-if="filteredProducts.length === 0" class="empty-box panel-card">
          <ion-icon :icon="albumsOutline" class="empty-icon" />
          <h2>还没有商品</h2>
          <p>先点“新增商品”，把常卖商品录进去。</p>
          <ion-button @click="goCreate">马上新增</ion-button>
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
                <ion-icon :icon="barcodeOutline" />
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
                  <ion-chip>
                    <ion-icon :icon="storefrontOutline" />
                    <ion-label>{{ product.supplierName || '未填写供应商' }}</ion-label>
                  </ion-chip>
                  <ion-chip>
                    <ion-icon :icon="personOutline" />
                    <ion-label>{{ product.attachments.length }} 个附件</ion-label>
                  </ion-chip>
                </div>
              </div>
            </div>
          </button>
        </div>

        <ion-list v-else class="list-box panel-card">
          <ion-item
            v-for="product in filteredProducts"
            :key="product.id"
            button
            detail
            lines="full"
            @click="goEdit(product.id)"
          >
            <ion-thumbnail slot="start" class="thumb-box">
              <img v-if="imageMap[product.id]" :src="imageMap[product.id]" alt="商品图片" />
              <div v-else class="placeholder-box small-placeholder">
                <ion-icon :icon="barcodeOutline" />
              </div>
            </ion-thumbnail>
            <ion-label>
              <h2>{{ product.name }}</h2>
              <p>{{ product.description || '暂无商品描述' }}</p>
              <p>{{ product.supplierName || '未填写供应商' }} · {{ product.supplierPhone || '未填写电话' }}</p>
            </ion-label>
            <div slot="end" class="list-end">
              <ion-note class="price-note">{{ formatPrice(product.price) }}</ion-note>
              <span v-if="matchMap[product.id]" class="match-badge list-badge">{{ matchMap[product.id].matchLevel }}</span>
            </div>
          </ion-item>
        </ion-list>

        <input
          ref="importInput"
          accept=".json,application/json"
          class="hidden-input"
          type="file"
          @change="handleImport"
        />
      </div>

      <button class="floating-add-button" type="button" @click="goCreate">
        <ion-icon :icon="addOutline" />
      </button>

      <ion-toast
        :color="toastColor"
        :duration="1800"
        :is-open="toastOpen"
        :message="toastMessage"
        @didDismiss="toastOpen = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonThumbnail,
  IonTitle,
  IonToast,
  IonToolbar,
  onIonViewWillEnter,
} from '@ionic/vue'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import {
  addOutline,
  albumsOutline,
  barcodeOutline,
  cameraOutline,
  closeCircleOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  gridOutline,
  listOutline,
  personOutline,
  storefrontOutline,
} from 'ionicons/icons'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { exportProducts, importProducts } from '../services/backup-service'
import { deleteStoredFile, readImportFile, resolveFileUrl, savePhotoBlob } from '../services/file-service'
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
const toastOpen = ref(false)
const toastMessage = ref('')
const toastColor = ref<'success' | 'warning' | 'danger'>('success')
const photoSearchResults = ref<VisualSearchResult[] | null>(null)
const photoSearchSummary = ref('')
const preparingVisualIndex = ref(false)
const searchingByPhoto = ref(false)

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
  toastMessage.value = message
  toastColor.value = color
  toastOpen.value = true
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

function openImportPicker() {
  importInput.value?.click()
}

function clearPhotoSearch() {
  photoSearchResults.value = null
  photoSearchSummary.value = ''
}

async function handleExport() {
  try {
    await exportProducts(products.value)
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
    clearPhotoSearch()
    await loadData()
    showToast(`已导入 ${count} 件商品`)
  } catch (error) {
    console.error(error)
    showToast('导入失败，请检查备份文件', 'danger')
  }
}

async function handlePhotoSearch() {
  if (!isVisualSearchSupported()) {
    showToast('图片搜索仅支持 Android 真机', 'warning')
    return
  }

  if (products.value.length === 0) {
    showToast('请先录入带图片的商品', 'warning')
    return
  }

  if (searchingByPhoto.value) return

  searchingByPhoto.value = true
  let tempFile: StoredFile | null = null

  try {
    await prepareVisualSearch(true)

    const photo = await Camera.getPhoto({
      quality: 75,
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
    })

    if (!photo.webPath) return

    const response = await fetch(photo.webPath)
    const blob = await response.blob()
    const mimeType = blob.type || (photo.format ? `image/${photo.format}` : 'image/jpeg')
    tempFile = await savePhotoBlob(blob, mimeType)

    const results = await searchProductsByStoredFile(tempFile, products.value)
    photoSearchResults.value = results
    photoSearchSummary.value = results.length
      ? '已按图片匹配，最像的是这些商品'
      : '没有找到足够相似的商品，请换个角度再拍一次'

    if (results.length === 0) {
      showToast('没有找到相似商品', 'warning')
    } else {
      showToast('已完成图片搜索')
    }
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

onMounted(async () => {
  await loadData()
})

onIonViewWillEnter(async () => {
  await loadData()
})
</script>

<style scoped>
.page-shell {
  padding: 16px 16px 128px;
}

.sticky-search-panel {
  position: sticky;
  top: 0;
  z-index: 30;
  margin: -4px -4px 12px;
  padding: 4px 4px 8px;
  background: var(--app-bg);
}

.search-row {
  display: grid;
  grid-template-columns: 1fr 56px;
  gap: 10px;
  align-items: center;
}

.search-box {
  --background: #ffffff;
  --border-radius: 18px;
  --box-shadow: var(--app-shadow);
  margin-bottom: 16px;
}

.photo-search-button {
  min-height: 48px;
  margin: 0 0 16px;
  --border-radius: 18px;
}

.toolbar-grid {
  padding: 14px;
  margin-bottom: 14px;
}

.toolbar-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.toolbar-row + .toolbar-row {
  margin-top: 12px;
}

.tool-button {
  min-height: 48px;
  font-size: 16px;
}

.view-segment {
  background: #f5f7fa;
  border-radius: 14px;
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
  color: var(--ion-color-primary);
  font-size: 14px;
}

.photo-search-hint {
  margin-top: 12px;
  padding: 12px 16px;
  color: var(--ion-color-primary-shade);
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

.empty-icon {
  font-size: 54px;
  color: var(--ion-color-primary);
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
  color: var(--ion-color-medium);
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
  color: var(--ion-color-primary-shade);
  font-size: 12px;
  white-space: nowrap;
}

.price-text {
  color: var(--ion-color-danger);
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

.list-box {
  overflow: hidden;
}

.thumb-box {
  --size: 56px;
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
  color: var(--ion-color-danger);
}

.hidden-input {
  display: none;
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
  background: var(--ion-color-primary);
  color: #ffffff;
  box-shadow: 0 10px 20px rgba(64, 158, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}
</style>
