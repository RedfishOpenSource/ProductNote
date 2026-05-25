<template>
  <div class="page-shell form-page">
    <div class="form-top-shell">
      <header class="page-header panel-card compact-card">
        <button class="header-back-button" type="button" aria-label="返回上一页" @click="goBack">
          <el-icon><Back /></el-icon>
        </button>
        <div class="header-copy">
          <h1 class="page-title">{{ isEditMode ? '编辑商品' : '新增商品' }}</h1>
        </div>
        <span class="header-side-spacer" aria-hidden="true" />
      </header>
    </div>

    <div class="form-scroll-shell">
      <div class="form-scroll-area">
        <div class="form-content">
          <section class="panel-card form-section compact-card">
            <div class="section-heading compact-heading">
              <h2>基本信息</h2>
              <p>先填写商品名称、价格和商品描述。</p>
            </div>

            <div class="field-grid">
              <label class="field-block">
                <span>商品名称</span>
                <el-input v-model="form.name" class="field-input" placeholder="请输入商品名称" />
              </label>
              <label class="field-block">
                <span>价格</span>
                <el-input v-model="form.priceText" class="field-input" inputmode="decimal" placeholder="请输入价格" />
                <p v-if="priceError" class="field-error">{{ priceError }}</p>
              </label>
            </div>

            <label class="field-block field-block-expanded">
              <span>商品描述</span>
              <el-input
                v-model="form.description"
                class="field-input"
                type="textarea"
                :rows="3"
                placeholder="例如：颜色、规格、适用场景"
              />
            </label>
          </section>

          <section class="panel-card form-section compact-card">
            <div class="section-heading compact-heading">
              <h2>商品图片</h2>
              <p>可添加多张图片，列表和搜索默认使用第一张。</p>
            </div>

            <div v-if="imagePreviews.length > 0" class="image-preview-grid compact-preview-box">
              <div v-for="(preview, index) in imagePreviews" :key="preview.file.path" class="image-preview-card">
                <img :src="preview.url" alt="商品图片" class="preview-image" />
                <span v-if="index === 0" class="cover-badge">封面</span>
                <el-button class="image-remove-button" link type="danger" @click="removeProductImage(preview.file)">删除</el-button>
              </div>
            </div>
            <div v-else class="preview-empty compact-preview-empty">
              <el-icon><Picture /></el-icon>
              <span>还没有上传图片</span>
            </div>

            <div class="media-button-grid compact-button-grid">
              <el-button type="primary" @click="takePhoto">
                <el-icon><Camera /></el-icon>
                拍照上传
              </el-button>
              <el-button @click="pickImage">
                <el-icon><Picture /></el-icon>
                选择图片
              </el-button>
            </div>
          </section>

          <section class="panel-card form-section compact-card">
            <div class="section-heading compact-heading">
              <h2>商品视频</h2>
              <p>支持手机拍摄短视频，也可以从相册或文件中选择视频。</p>
            </div>

            <div v-if="videoAttachments.length === 0" class="preview-empty video-empty compact-preview-empty">
              <el-icon><VideoCamera /></el-icon>
              <span>还没有添加商品视频</span>
            </div>
            <div v-else class="file-list compact-file-list">
              <div v-for="video in videoAttachments" :key="video.path" class="file-item compact-file-item">
                <button class="file-main" type="button" @click="previewStoredFile(video)">
                  <div>
                    <strong>{{ video.name }}</strong>
                    <span>{{ video.mimeType || '视频文件' }}</span>
                  </div>
                </button>
                <el-button link type="danger" @click="removeStoredFile(video)">删除</el-button>
              </div>
            </div>

            <div class="media-button-grid media-button-grid-spaced compact-button-grid">
              <el-button type="primary" @click="captureVideo">
                <el-icon><VideoCamera /></el-icon>
                拍摄视频
              </el-button>
              <el-button @click="pickVideos">
                <el-icon><VideoCamera /></el-icon>
                选择视频
              </el-button>
            </div>

            <p v-if="isWebPlatform" class="subtle-text section-note">网页端建议尽量使用较短的视频，视频过大时可能保存失败。</p>
          </section>

          <section class="panel-card form-section compact-card">
            <div class="section-heading compact-heading">
              <h2>附件</h2>
              <p>可保存票据、说明书等其他文件。</p>
            </div>

            <el-button @click="pickAttachments">
              <el-icon><Paperclip /></el-icon>
              选择附件
            </el-button>

            <div v-if="otherAttachments.length === 0" class="subtle-text">暂时没有其他附件</div>
            <div v-else class="file-list compact-file-list">
              <div v-for="attachment in otherAttachments" :key="attachment.path" class="file-item compact-file-item">
                <button class="file-main" type="button" @click="previewStoredFile(attachment)">
                  <div>
                    <strong>{{ attachment.name }}</strong>
                    <span>{{ attachment.mimeType || '未知类型' }}</span>
                  </div>
                </button>
                <el-button link type="danger" @click="removeStoredFile(attachment)">删除</el-button>
              </div>
            </div>
          </section>

          <section class="panel-card form-section compact-card">
            <div class="section-heading compact-heading">
              <h2>供应商信息</h2>
              <p>补充联系人信息，后面找货更方便。</p>
            </div>

            <div class="field-grid">
              <label class="field-block">
                <span>供应商名称</span>
                <el-input v-model="form.supplierName" class="field-input" placeholder="请输入供应商名称" />
              </label>
              <label class="field-block">
                <span>供应商电话</span>
                <el-input v-model="form.supplierPhone" class="field-input" inputmode="tel" placeholder="请输入供应商电话" />
              </label>
            </div>
          </section>

          <section class="action-stack">
            <el-button :loading="saving" size="large" type="primary" @click="saveCurrentProduct">
              {{ saving ? '保存中...' : '保存商品' }}
            </el-button>
            <el-button v-if="isEditMode" size="large" type="danger" plain @click="deleteCurrentProduct">删除商品</el-button>
          </section>
        </div>
      </div>
    </div>

    <input ref="imageInput" accept="image/*" class="hidden-input" multiple type="file" @change="handleImagesSelected" />
    <input ref="videoInput" accept="video/*" class="hidden-input" multiple type="file" @change="handleVideosSelected" />
    <input
      ref="videoCaptureInput"
      accept="video/*"
      capture="environment"
      class="hidden-input"
      type="file"
      @change="handleVideosSelected"
    />
    <input ref="attachmentInput" class="hidden-input" multiple type="file" @change="handleAttachmentsSelected" />
  </div>
</template>

<script setup lang="ts">
import { Back, Camera, Paperclip, Picture, VideoCamera } from '@element-plus/icons-vue'
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { consumePendingProductCreateDraft } from '../services/product-create-draft'
import { deleteStoredFile, openStoredFile, resolveFileUrl, saveFile, savePhotoBlob } from '../services/file-service'
import { createId } from '../services/id'
import { deleteProduct, getProductById, saveProduct } from '../services/product-store'
import { removeProductVisualIndex, upsertProductVisualIndex } from '../services/visual-search-service'
import { getPrimaryProductImage, hasVideoFileExtension, isVideoMimeType, isVideoStoredFile, normalizeProductImages } from '../types/product'
import type { Product, StoredFile } from '../types/product'

const router = useRouter()
const route = useRoute()

const imageInput = ref<HTMLInputElement | null>(null)
const videoInput = ref<HTMLInputElement | null>(null)
const videoCaptureInput = ref<HTMLInputElement | null>(null)
const attachmentInput = ref<HTMLInputElement | null>(null)
const imagePreviews = ref<Array<{ file: StoredFile; url: string }>>([])
const saving = ref(false)
const createdAt = ref('')
const removedFiles = ref<StoredFile[]>([])
const isWebPlatform = Capacitor.getPlatform() === 'web'

const form = reactive({
  name: '',
  priceText: '',
  description: '',
  supplierName: '',
  supplierPhone: '',
  image: null as StoredFile | null,
  images: [] as StoredFile[],
  attachments: [] as StoredFile[],
  model3d: null as Product['model3d'],
})

const productId = computed(() => String(route.params.id ?? ''))
const isEditMode = computed(() => Boolean(productId.value))
const priceError = computed(() => {
  const value = form.priceText.trim()
  if (!value) return ''
  return /^\d+(\.\d{1,2})?$/.test(value) ? '' : '价格只能填写数字，最多保留两位小数'
})
const attachmentGroups = computed(() => {
  const videos: StoredFile[] = []
  const others: StoredFile[] = []

  for (const file of form.attachments) {
    if (isVideoStoredFile(file)) {
      videos.push(file)
      continue
    }

    others.push(file)
  }

  return { videos, others }
})
const videoAttachments = computed(() => attachmentGroups.value.videos)
const otherAttachments = computed(() => attachmentGroups.value.others)

function showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
  const type = color === 'danger' ? 'error' : color
  ElMessage({
    message,
    type,
  })
}

function isVideoSource(name: string, mimeType: string): boolean {
  return isVideoMimeType(mimeType) || hasVideoFileExtension(name)
}

function isVideoFile(file: File): boolean {
  return isVideoSource(file.name, file.type)
}

function goBack() {
  router.push('/')
}

function pickImage() {
  imageInput.value?.click()
}

function pickVideos() {
  videoInput.value?.click()
}

function captureVideo() {
  videoCaptureInput.value?.click()
}

function pickAttachments() {
  attachmentInput.value?.click()
}

function syncPrimaryImage(): void {
  form.image = form.images[0] ?? null
}

async function refreshImagePreviews() {
  imagePreviews.value = await Promise.all(
    form.images.map(async (file) => ({
      file,
      url: await resolveFileUrl(file),
    })),
  )
}

function applyCreateDraft(): void {
  const draft = consumePendingProductCreateDraft()
  if (!draft) {
    return
  }

  form.name = draft.name ?? ''
  form.priceText = draft.priceText ?? ''
  form.description = draft.description ?? ''
  form.supplierName = draft.supplierName ?? ''
  form.supplierPhone = draft.supplierPhone ?? ''
  form.images = normalizeProductImages(draft.image, draft.images)
  syncPrimaryImage()
  form.attachments = [...(draft.attachments ?? [])]
}

function fillForm(product: Product) {
  form.name = product.name
  form.priceText = product.price === null ? '' : String(product.price)
  form.description = product.description
  form.supplierName = product.supplierName
  form.supplierPhone = product.supplierPhone
  form.images = normalizeProductImages(product.image, product.images)
  syncPrimaryImage()
  form.attachments = [...product.attachments]
  form.model3d = product.model3d
  createdAt.value = product.createdAt
}

async function loadProduct() {
  if (!isEditMode.value) {
    createdAt.value = new Date().toISOString()
    applyCreateDraft()
    await refreshImagePreviews()
    return
  }

  const product = await getProductById(productId.value)
  if (!product) {
    showToast('商品不存在', 'warning')
    router.replace('/')
    return
  }

  fillForm(product)
  await refreshImagePreviews()
}

async function addProductImages(files: StoredFile[]) {
  form.images.push(...files)
  syncPrimaryImage()
  await refreshImagePreviews()
}

async function addAttachmentFiles(files: File[]) {
  for (const file of files) {
    form.attachments.push(await saveFile(file, 'attachment'))
  }
}

async function takePhoto() {
  try {
    const photo = await CapacitorCamera.getPhoto({
      quality: 75,
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
    })

    if (!photo.webPath) return

    const response = await fetch(photo.webPath)
    const blob = await response.blob()
    const mimeType = blob.type || (photo.format ? `image/${photo.format}` : 'image/jpeg')
    const storedFile = await savePhotoBlob(blob, mimeType)
    await addProductImages([storedFile])
  } catch (error) {
    console.error(error)
    showToast('拍照失败，请改用选择图片', 'warning')
  }
}

async function handleImagesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''

  if (files.length === 0) return

  const imageFiles = await Promise.all(files.map((file) => saveFile(file, 'image')))
  await addProductImages(imageFiles)
  showToast(`已添加 ${imageFiles.length} 张图片`)
}

async function handleVideosSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''

  if (files.length === 0) return

  const videoFiles = files.filter((file) => isVideoFile(file))
  const ignoredCount = files.length - videoFiles.length

  if (videoFiles.length === 0) {
    showToast('请选择视频文件', 'warning')
    return
  }

  await addAttachmentFiles(videoFiles)

  if (ignoredCount > 0) {
    showToast(`已添加 ${videoFiles.length} 个视频，忽略 ${ignoredCount} 个非视频文件`, 'warning')
    return
  }

  showToast(`已添加 ${videoFiles.length} 个视频`)
}

async function handleAttachmentsSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''

  if (files.length === 0) return

  await addAttachmentFiles(files)

  const videoCount = files.filter((file) => isVideoFile(file)).length
  const attachmentCount = files.length - videoCount

  if (videoCount > 0 && attachmentCount > 0) {
    showToast(`已添加 ${attachmentCount} 个附件，${videoCount} 个视频`)
    return
  }

  if (videoCount > 0) {
    showToast(`已添加 ${videoCount} 个视频`)
    return
  }

  showToast(`已添加 ${attachmentCount} 个附件`)
}

function removeStoredFile(file: StoredFile) {
  const index = form.attachments.indexOf(file)
  if (index === -1) return

  const [removed] = form.attachments.splice(index, 1)
  if (removed) {
    removedFiles.value.push(removed)
  }
}

async function removeProductImage(file: StoredFile) {
  const index = form.images.indexOf(file)
  if (index === -1) return

  const [removed] = form.images.splice(index, 1)
  if (removed) {
    removedFiles.value.push(removed)
  }

  syncPrimaryImage()
  await refreshImagePreviews()
}

async function previewStoredFile(file: StoredFile) {
  try {
    await openStoredFile(file)
  } catch (error) {
    console.error(error)
    showToast('文件打开失败', 'warning')
  }
}

function parsePrice() {
  const value = form.priceText.trim()
  if (!value) return null
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function syncVisualIndex(product: Product) {
  if (getPrimaryProductImage(product)) {
    await upsertProductVisualIndex(product)
    return
  }

  await removeProductVisualIndex(product.id)
}

async function saveCurrentProduct() {
  if (!form.name.trim()) {
    showToast('请先填写商品名称', 'warning')
    return
  }

  if (priceError.value) {
    showToast(priceError.value, 'warning')
    return
  }

  saving.value = true

  try {
    const now = new Date().toISOString()
    const product: Product = {
      id: isEditMode.value ? productId.value : createId('product'),
      name: form.name.trim(),
      price: parsePrice(),
      description: form.description.trim(),
      supplierName: form.supplierName.trim(),
      supplierPhone: form.supplierPhone.trim(),
      image: form.images[0] ?? null,
      images: [...form.images],
      attachments: [...form.attachments],
      model3d: form.model3d,
      createdAt: createdAt.value || now,
      updatedAt: now,
    }

    await saveProduct(product)

    let successMessage = '商品已保存'
    try {
      await syncVisualIndex(product)
    } catch (error) {
      console.error(error)
      successMessage = '商品已保存，图片搜索会稍后准备'
    }

    for (const file of removedFiles.value) {
      await deleteStoredFile(file)
    }

    removedFiles.value = []
    showToast(successMessage)
    router.replace('/')
  } catch (error) {
    console.error(error)
    showToast('保存失败，请稍后重试', 'danger')
  } finally {
    saving.value = false
  }
}

async function deleteCurrentProduct() {
  if (!isEditMode.value) return

  const confirmed = window.confirm('确定删除这个商品吗？')
  if (!confirmed) return

  try {
    for (const file of form.images) {
      await deleteStoredFile(file)
    }
    for (const file of form.attachments) {
      await deleteStoredFile(file)
    }
    for (const file of removedFiles.value) {
      await deleteStoredFile(file)
    }
    await deleteStoredFile(form.model3d?.file ?? null)

    await deleteProduct(productId.value)
    await removeProductVisualIndex(productId.value)
    showToast('商品已删除')
    router.replace('/')
  } catch (error) {
    console.error(error)
    showToast('删除失败，请稍后重试', 'danger')
  }
}

onMounted(async () => {
  await loadProduct()
})
</script>

<style scoped>
.form-page {
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

.form-top-shell {
  flex-shrink: 0;
}

.form-scroll-shell {
  flex: 1;
  min-height: 0;
  margin: 0 -4px;
  border-radius: var(--app-radius);
  overflow: hidden;
  background: var(--app-bg);
}

.form-scroll-area {
  height: 100%;
  overflow-y: auto;
  padding: 0 4px calc(env(safe-area-inset-bottom, 0px) + 20px);
}

.form-content {
  display: grid;
  gap: 10px;
}

.compact-card {
  padding: 12px;
}

.page-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 0;
}

.header-back-button,
.header-side-spacer {
  width: 40px;
  height: 40px;
}

.header-back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.page-title {
  margin: 0;
  text-align: left;
  font-size: 20px;
}

.header-side-spacer {
  display: block;
}

.form-section {
  margin-bottom: 0;
}

.compact-heading {
  margin-bottom: 10px;
}

.compact-heading h2 {
  margin: 0;
  font-size: 18px;
  color: var(--app-title);
}

.compact-heading p {
  margin: 6px 0 0;
  color: var(--app-text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field-block {
  display: block;
}

.field-block-expanded {
  margin-top: 10px;
}

.field-block span {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: var(--app-text-secondary);
}

.field-error {
  margin: 6px 2px 0;
  color: var(--app-danger);
  font-size: 12px;
}

:deep(.field-input .el-input__wrapper),
:deep(.field-input .el-textarea__inner) {
  border-radius: 12px;
}

.compact-preview-box,
.compact-preview-empty {
  margin-bottom: 10px;
}

.image-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.image-preview-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border-radius: 14px;
  background: #f5f7fa;
}

.preview-image {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 14px;
}

.cover-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(17, 19, 24, 0.68);
  color: #ffffff;
  font-size: 11px;
}

.image-remove-button {
  position: absolute;
  right: 8px;
  bottom: 8px;
  min-height: 28px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 140px;
  border: 1px dashed var(--app-border);
  border-radius: 16px;
  color: var(--app-text-secondary);
  background: #f9fafc;
}

.preview-empty .el-icon {
  font-size: 34px;
}

.video-empty {
  min-height: 120px;
}

.compact-button-grid {
  gap: 8px;
}

.media-button-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.media-button-grid-spaced {
  margin-top: 10px;
}

.media-button-grid :deep(.el-button + .el-button) {
  margin-left: 0;
}

.subtle-text {
  margin-top: 10px;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.section-note {
  line-height: 1.45;
}

.compact-file-list {
  gap: 8px;
  margin-top: 10px;
}

.file-list {
  display: grid;
}

.compact-file-item {
  padding: 10px 12px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: #f9fafc;
}

.file-main {
  flex: 1;
  border: 0;
  padding: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.file-item strong,
.file-item span {
  display: block;
}

.file-item strong {
  font-size: 14px;
}

.file-item span {
  margin-top: 4px;
  color: var(--app-text-secondary);
  font-size: 12px;
}

.action-stack {
  display: grid;
  gap: 10px;
  margin-top: 4px;
}

.action-stack :deep(.el-button + .el-button) {
  margin-left: 0;
}

.hidden-input {
  display: none;
}

@media (max-width: 640px) {
  .field-grid,
  .image-preview-grid,
  .media-button-grid {
    grid-template-columns: 1fr;
  }

  .page-title {
    font-size: 18px;
  }

  .file-item {
    align-items: flex-start;
  }
}
</style>
