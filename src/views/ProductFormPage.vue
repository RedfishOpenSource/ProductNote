<template>
  <div class="page-shell form-shell">
    <header class="page-header panel-card">
      <el-button @click="goBack">
        <el-icon><Back /></el-icon>
        返回
      </el-button>
      <h1 class="page-title">{{ isEditMode ? '编辑商品' : '新增商品' }}</h1>
      <div class="header-spacer" />
    </header>

    <section class="panel-card form-section">
      <h2>基本信息</h2>
      <label class="field-block">
        <span>商品名称</span>
        <el-input v-model="form.name" class="field-input" placeholder="请输入商品名称" />
      </label>
      <label class="field-block">
        <span>价格</span>
        <el-input v-model="form.priceText" class="field-input" inputmode="decimal" placeholder="请输入价格" />
        <p v-if="priceError" class="field-error">{{ priceError }}</p>
      </label>
      <label class="field-block">
        <span>商品描述</span>
        <el-input
          v-model="form.description"
          class="field-input"
          type="textarea"
          :rows="4"
          placeholder="例如：颜色、规格、适用场景"
        />
      </label>
    </section>

    <section class="panel-card form-section">
      <h2>商品图片</h2>
      <div v-if="imagePreview" class="preview-box">
        <img :src="imagePreview" alt="商品图片" class="preview-image" />
      </div>
      <div v-else class="preview-empty">
        <el-icon><Picture /></el-icon>
        <span>还没有上传图片</span>
      </div>
      <div class="button-grid">
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

    <section class="panel-card form-section">
      <h2>附件</h2>
      <el-button @click="pickAttachments">
        <el-icon><Paperclip /></el-icon>
        选择附件
      </el-button>

      <div v-if="form.attachments.length === 0" class="subtle-text">暂时没有附件</div>
      <div v-else class="attachment-list">
        <div v-for="(attachment, index) in form.attachments" :key="`${attachment.path}-${index}`" class="attachment-item">
          <button class="attachment-main" type="button" @click="previewAttachment(attachment)">
            <div>
              <strong>{{ attachment.name }}</strong>
              <span>{{ attachment.mimeType || '未知类型' }}</span>
            </div>
          </button>
          <el-button link type="danger" @click="removeAttachment(index)">删除</el-button>
        </div>
      </div>
    </section>

    <section class="panel-card form-section">
      <h2>供应商信息</h2>
      <label class="field-block">
        <span>供应商名称</span>
        <el-input v-model="form.supplierName" class="field-input" placeholder="请输入供应商名称" />
      </label>
      <label class="field-block">
        <span>供应商电话</span>
        <el-input v-model="form.supplierPhone" class="field-input" inputmode="tel" placeholder="请输入供应商电话" />
      </label>
    </section>

    <section class="action-stack">
      <el-button :loading="saving" size="large" type="primary" @click="saveCurrentProduct">
        {{ saving ? '保存中...' : '保存商品' }}
      </el-button>
      <el-button v-if="isEditMode" size="large" type="danger" plain @click="deleteCurrentProduct">删除商品</el-button>
    </section>

    <input ref="imageInput" accept="image/*" class="hidden-input" type="file" @change="handleImageSelected" />
    <input ref="attachmentInput" class="hidden-input" multiple type="file" @change="handleAttachmentsSelected" />
  </div>
</template>

<script setup lang="ts">
import { Back, Camera, Paperclip, Picture } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { deleteStoredFile, openStoredFile, resolveFileUrl, saveFile, savePhotoBlob } from '../services/file-service'
import { createId } from '../services/id'
import { deleteProduct, getProductById, saveProduct } from '../services/product-store'
import { removeProductVisualIndex, upsertProductVisualIndex } from '../services/visual-search-service'
import type { Product, StoredFile } from '../types/product'

const router = useRouter()
const route = useRoute()

const imageInput = ref<HTMLInputElement | null>(null)
const attachmentInput = ref<HTMLInputElement | null>(null)
const imagePreview = ref('')
const saving = ref(false)
const createdAt = ref('')
const removedFiles = ref<StoredFile[]>([])

const form = reactive({
  name: '',
  priceText: '',
  description: '',
  supplierName: '',
  supplierPhone: '',
  image: null as StoredFile | null,
  attachments: [] as StoredFile[],
})

const productId = computed(() => String(route.params.id ?? ''))
const isEditMode = computed(() => Boolean(productId.value))
const priceError = computed(() => {
  const value = form.priceText.trim()
  if (!value) return ''
  return /^\d+(\.\d{1,2})?$/.test(value) ? '' : '价格只能填写数字，最多保留两位小数'
})

function showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
  const type = color === 'danger' ? 'error' : color
  ElMessage({
    message,
    type,
  })
}

function goBack() {
  router.push('/')
}

function pickImage() {
  imageInput.value?.click()
}

function pickAttachments() {
  attachmentInput.value?.click()
}

async function refreshImagePreview() {
  imagePreview.value = await resolveFileUrl(form.image)
}

function fillForm(product: Product) {
  form.name = product.name
  form.priceText = product.price === null ? '' : String(product.price)
  form.description = product.description
  form.supplierName = product.supplierName
  form.supplierPhone = product.supplierPhone
  form.image = product.image
  form.attachments = [...product.attachments]
  createdAt.value = product.createdAt
}

async function loadProduct() {
  if (!isEditMode.value) {
    createdAt.value = new Date().toISOString()
    return
  }

  const product = await getProductById(productId.value)
  if (!product) {
    showToast('商品不存在', 'warning')
    router.replace('/')
    return
  }

  fillForm(product)
  await refreshImagePreview()
}

async function replaceImage(file: StoredFile) {
  if (form.image) {
    removedFiles.value.push(form.image)
  }
  form.image = file
  await refreshImagePreview()
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
    await replaceImage(storedFile)
  } catch (error) {
    console.error(error)
    showToast('拍照失败，请改用选择图片', 'warning')
  }
}

async function handleImageSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) return

  const storedFile = await saveFile(file, 'image')
  await replaceImage(storedFile)
}

async function handleAttachmentsSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''

  if (files.length === 0) return

  for (const file of files) {
    form.attachments.push(await saveFile(file, 'attachment'))
  }

  showToast(`已添加 ${files.length} 个附件`)
}

function removeAttachment(index: number) {
  const [removed] = form.attachments.splice(index, 1)
  if (removed) {
    removedFiles.value.push(removed)
  }
}

async function previewAttachment(file: StoredFile) {
  try {
    await openStoredFile(file)
  } catch (error) {
    console.error(error)
    showToast('附件打开失败', 'warning')
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
  if (product.image) {
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
      image: form.image,
      attachments: [...form.attachments],
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
    await deleteStoredFile(form.image)
    for (const file of form.attachments) {
      await deleteStoredFile(file)
    }

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
.form-shell {
  padding-bottom: 40px;
}

.page-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
}

.page-title {
  text-align: center;
}

.header-spacer {
  width: 72px;
}

.form-section {
  margin-bottom: 14px;
}

.form-section h2 {
  margin: 0 0 14px;
  font-size: 20px;
  color: var(--app-title);
}

.field-block {
  display: block;
}

.field-block + .field-block {
  margin-top: 14px;
}

.field-block span {
  display: block;
  margin-bottom: 8px;
  font-size: 15px;
  color: var(--app-text-secondary);
}

.field-error {
  margin: 8px 2px 0;
  color: var(--app-danger);
  font-size: 13px;
}

:deep(.field-input .el-input__wrapper),
:deep(.field-input .el-textarea__inner) {
  border-radius: 14px;
}

.preview-box {
  margin-bottom: 14px;
}

.preview-image {
  width: 100%;
  min-height: 180px;
  max-height: 280px;
  object-fit: cover;
  border-radius: 18px;
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 180px;
  margin-bottom: 14px;
  border: 1px dashed var(--app-border);
  border-radius: 18px;
  color: var(--app-text-secondary);
  background: #f9fafc;
}

.preview-empty .el-icon {
  font-size: 40px;
}

.button-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.subtle-text {
  margin-top: 12px;
  color: var(--app-text-secondary);
}

.attachment-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.attachment-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: #f9fafc;
}

.attachment-main {
  flex: 1;
  border: 0;
  padding: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.attachment-item strong,
.attachment-item span {
  display: block;
}

.attachment-item span {
  margin-top: 4px;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.action-stack {
  display: grid;
  gap: 12px;
  margin-top: 22px;
}

.hidden-input {
  display: none;
}

@media (max-width: 640px) {
  .button-grid {
    grid-template-columns: 1fr;
  }

  .page-header {
    grid-template-columns: auto 1fr;
    row-gap: 10px;
  }

  .header-spacer {
    display: none;
  }

  .page-title {
    text-align: right;
    font-size: 20px;
  }
}
</style>
