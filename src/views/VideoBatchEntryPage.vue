<template>
  <div class="page-shell video-entry-page">
    <div class="form-top-shell">
      <header class="page-header panel-card compact-card">
        <button class="header-back-button" type="button" aria-label="返回上一页" @click="goBack">
          <el-icon><Back /></el-icon>
        </button>
        <div class="header-copy">
          <h1 class="page-title">视频批量录入</h1>
        </div>
        <span class="header-side-spacer" aria-hidden="true" />
      </header>
    </div>

    <div class="form-scroll-shell">
      <div class="form-scroll-area">
        <div class="form-content">
          <!-- 第 1 步:选视频 -->
          <section v-if="stage === 'pick'" class="panel-card form-section compact-card">
            <div class="section-heading compact-heading">
              <h2>1. 选择视频</h2>
              <p>拍一段慢慢逛店的视频(每件商品停留 1~2 秒),系统自动抽帧去重,每帧生成一件商品草稿。</p>
            </div>

            <div class="media-button-grid compact-button-grid">
              <el-button type="primary" @click="pickFromGallery">
                <el-icon><VideoCamera /></el-icon>
                从相册选择
              </el-button>
              <el-button @click="recordNow">
                <el-icon><Camera /></el-icon>
                直接录制
              </el-button>
            </div>
            <p v-if="videoFileName" class="picked-name">已选择:{{ videoFileName }}</p>

            <label class="field-block">
              <span>抽帧间隔(秒,商品多可调小)</span>
              <el-input-number v-model="intervalSeconds" :min="1" :max="10" :step="1" />
            </label>

            <el-button
              type="primary"
              class="primary-action"
              :disabled="!videoFile || extracting"
              :loading="extracting"
              @click="startExtraction"
            >
              开始抽帧分析
            </el-button>
            <p v-if="extractError" class="field-error">{{ extractError }}</p>
          </section>

          <!-- 第 2 步:抽帧进度 -->
          <section v-if="stage === 'extracting'" class="panel-card form-section compact-card">
            <div class="section-heading compact-heading">
              <h2>2. 正在抽帧分析</h2>
              <p>扫描 {{ progressScanned }}s / {{ progressTotal }}s,已保留候选 {{ progressKept }} 帧</p>
            </div>
            <el-progress :percentage="progressPercent" :stroke-width="14" />
            <p class="muted-tip">去重规则:相邻画面变化超过阈值才算新商品,走过路过重复入镜的会被自动跳过。</p>
          </section>

          <!-- 第 3 步:候选编辑 -->
          <section v-if="stage === 'review'" class="panel-card form-section compact-card">
            <div class="section-heading compact-heading">
              <h2>3. 确认候选商品</h2>
              <p>共 {{ candidates.length }} 帧,已勾选 {{ selectedCount }} 件。名称是自动建议的,请核对修改。</p>
            </div>

            <div class="bulk-bar">
              <el-checkbox v-model="allChecked" @change="toggleAll">全选</el-checkbox>
              <span class="bulk-unit-label">默认单位</span>
              <el-input v-model="defaultUnit" class="bulk-unit-input" placeholder="个" />
              <el-button size="small" @click="applyDefaultUnit">套用</el-button>
            </div>

            <div class="candidate-list">
              <div v-for="candidate in candidates" :key="candidate.id" class="candidate-card" :class="{ off: !candidate.checked }">
                <el-checkbox v-model="candidate.checked" class="candidate-check" />
                <img class="candidate-thumb" :src="candidate.frame.dataUrl" alt="候选商品图" />
                <div class="candidate-fields">
                  <el-input v-model="candidate.name" placeholder="商品名称" size="small" />
                  <div class="candidate-row">
                    <el-input v-model="candidate.priceText" class="candidate-price" size="small" inputmode="decimal" placeholder="价格" />
                    <el-input v-model="candidate.quantityText" class="candidate-qty" size="small" inputmode="numeric" placeholder="库存" />
                    <el-input v-model="candidate.unit" class="candidate-unit" size="small" placeholder="个" />
                  </div>
                  <div class="candidate-row">
                    <el-select v-model="candidate.category" class="candidate-category" size="small" placeholder="分类" clearable>
                      <el-option v-for="item in AGENTMALL_CATEGORIES" :key="item" :label="item" :value="item" />
                    </el-select>
                    <el-button link type="danger" size="small" @click="removeCandidate(candidate.id)">删除</el-button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 第 4 步:完成 -->
          <section v-if="stage === 'done'" class="panel-card form-section compact-card">
            <div class="section-heading compact-heading">
              <h2>✅ 已入库 {{ savedCount }} 件商品</h2>
              <p>可立即导出 CSV 到店主端批量上架,或回列表继续。</p>
            </div>
            <div class="media-button-grid compact-button-grid">
              <el-button type="primary" @click="exportCsv">
                <el-icon><Download /></el-icon>
                导出 AgentMall CSV
              </el-button>
              <el-button @click="goBack">返回</el-button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- 底部操作栏(review 阶段) -->
    <div v-if="stage === 'review'" class="bottom-bar">
      <el-button
        type="primary"
        class="save-button"
        :loading="saving"
        :disabled="selectedCount === 0"
        @click="saveSelected"
      >
        入库所选({{ selectedCount }})
      </el-button>
    </div>

    <input ref="videoInput" accept="video/*" class="hidden-input" type="file" @change="handleVideoPicked" />
    <input ref="videoCaptureInput" accept="video/*" capture="environment" class="hidden-input" type="file" @change="handleVideoPicked" />
  </div>
</template>

<script setup lang="ts">
import { Back, Camera, Download, VideoCamera } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AGENTMALL_CATEGORIES, exportAgentMallCsv } from '../services/agentmall-export'
import { savePhotoBlob } from '../services/file-service'
import { createId } from '../services/id'
import { saveProduct } from '../services/product-store'
import { extractLabelsForFile } from '../services/visual-search-service'
import { extractCandidateFrames, suggestNameFromLabels } from '../services/video-entry-service'
import type { ExtractedFrame } from '../services/video-entry-service'
import type { Product, StoredFile } from '../types/product'

type Stage = 'pick' | 'extracting' | 'review' | 'done'

interface CandidateItem {
  id: string
  checked: boolean
  name: string
  priceText: string
  quantityText: string
  unit: string
  category: string
  file: StoredFile
  frame: ExtractedFrame
  autoNamed: boolean
}

const router = useRouter()

const stage = ref<Stage>('pick')
const videoFile = ref<File | null>(null)
const videoFileName = ref('')
const videoInput = ref<HTMLInputElement | null>(null)
const videoCaptureInput = ref<HTMLInputElement | null>(null)

const intervalSeconds = ref(2)
const extracting = ref(false)
const extractError = ref('')
const progressKept = ref(0)
const progressScanned = ref(0)
const progressTotal = ref(0)

const candidates = ref<CandidateItem[]>([])
const allChecked = ref(true)
const defaultUnit = ref('个')
const saving = ref(false)
const savedCount = ref(0)
const savedProducts: Product[] = []

const selectedCount = computed(() => candidates.value.filter((item) => item.checked).length)
const progressPercent = computed(() =>
  progressTotal.value > 0 ? Math.min(100, Math.round((progressScanned.value / progressTotal.value) * 100)) : 0,
)

function goBack(): void {
  router.back()
}

function pickFromGallery(): void {
  videoInput.value?.click()
}

function recordNow(): void {
  videoCaptureInput.value?.click()
}

function handleVideoPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    videoFile.value = file
    videoFileName.value = file.name
    extractError.value = ''
  }
  input.value = ''
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mime })
}

async function startExtraction(): Promise<void> {
  if (!videoFile.value || extracting.value) return
  extracting.value = true
  extractError.value = ''
  stage.value = 'extracting'
  progressKept.value = 0
  progressScanned.value = 0
  progressTotal.value = 0

  try {
    const objectUrl = URL.createObjectURL(videoFile.value)
    const frames = await extractCandidateFrames(objectUrl, {
      intervalSeconds: intervalSeconds.value,
      onProgress: (kept, scanned, total) => {
        progressKept.value = kept
        progressScanned.value = scanned
        progressTotal.value = total
      },
    })
    URL.revokeObjectURL(objectUrl)

    if (!frames.length) {
      throw new Error('没有提取到候选画面,试试把抽帧间隔调小')
    }

    const items: CandidateItem[] = []
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index]
      const blob = dataUrlToBlob(frame.dataUrl)
      const file = await savePhotoBlob(blob)
      items.push({
        id: createId('candidate'),
        checked: true,
        name: `候选商品 ${index + 1}`,
        priceText: '',
        quantityText: '',
        unit: defaultUnit.value || '个',
        category: '',
        file,
        frame,
        autoNamed: true,
      })
    }
    candidates.value = items
    stage.value = 'review'
    void enhanceNamesInBackground()
  } catch (error) {
    extractError.value = error instanceof Error ? error.message : '抽帧失败,请重试'
    stage.value = 'pick'
  } finally {
    extracting.value = false
  }
}

/** 安卓端:用视觉标签把"候选商品 N"替换成更有意义的名称(异步,不阻塞编辑) */
async function enhanceNamesInBackground(): Promise<void> {
  for (const item of candidates.value) {
    if (!item.autoNamed) continue
    try {
      const labels = await extractLabelsForFile(item.file)
      const texts = labels.map((label) => label.text)
      const suggested = suggestNameFromLabels(texts)
      if (suggested && item.autoNamed) {
        item.name = suggested
      }
    } catch {
      // 忽略单个失败
    }
  }
}

function removeCandidate(id: string): void {
  candidates.value = candidates.value.filter((item) => item.id !== id)
}

function toggleAll(checked: boolean | string | number): void {
  const value = checked === true
  candidates.value.forEach((item) => {
    item.checked = value
  })
}

function applyDefaultUnit(): void {
  const unit = defaultUnit.value.trim() || '个'
  candidates.value.forEach((item) => {
    if (item.checked) item.unit = unit
  })
}

async function saveSelected(): Promise<void> {
  if (saving.value) return
  const selected = candidates.value.filter((item) => item.checked)
  if (!selected.length) {
    ElMessage.warning('请先勾选要入库的商品')
    return
  }

  saving.value = true
  try {
    for (const item of selected) {
      const price = Number(item.priceText)
      const quantity = Number(item.quantityText)
      const now = new Date().toISOString()
      const product: Product = {
        id: createId('product'),
        name: item.name.trim() || `未命名商品 ${item.frame.timestampSeconds}s`,
        price: Number.isFinite(price) && price > 0 ? price : null,
        description: `视频 ${item.frame.timestampSeconds}s 处自动录入`,
        supplierName: '',
        supplierPhone: '',
        image: item.file,
        images: [item.file],
        attachments: [],
        model3d: null,
        createdAt: now,
        updatedAt: now,
        category: item.category,
        quantity: Number.isFinite(quantity) && quantity >= 0 ? Math.round(quantity) : null,
        unit: item.unit.trim() || '个',
        wholesalePrice: null,
      }
      await saveProduct(product)
      savedProducts.push(product)
    }

    savedCount.value = selected.length
    stage.value = 'done'
    ElMessage.success(`已入库 ${selected.length} 件商品`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '入库失败,请重试')
  } finally {
    saving.value = false
  }
}

async function exportCsv(): Promise<void> {
  try {
    await exportAgentMallCsv(savedProducts)
    ElMessage.success('CSV 已导出')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
  }
}
</script>

<style scoped>
.page-shell {
  min-height: 100%;
}
.form-top-shell {
  position: sticky;
  top: 0;
  z-index: 5;
}
.form-scroll-shell {
  padding-bottom: 120rpx;
}
.picked-name {
  margin: 12rpx 0 0;
  color: #666;
  font-size: 24rpx;
}
.primary-action {
  width: 100%;
  margin-top: 20rpx;
}
.muted-tip {
  color: #999;
  font-size: 22rpx;
  margin-top: 12rpx;
}
.field-error {
  color: #c81623;
  font-size: 24rpx;
}
.bulk-bar {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 16rpx;
}
.bulk-unit-label {
  font-size: 24rpx;
  color: #666;
}
.bulk-unit-input {
  width: 140rpx;
}
.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.candidate-card {
  display: flex;
  gap: 16rpx;
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx;
  align-items: flex-start;
}
.candidate-card.off {
  opacity: 0.5;
}
.candidate-check {
  margin-top: 6rpx;
}
.candidate-thumb {
  width: 140rpx;
  height: 140rpx;
  object-fit: cover;
  border-radius: 10rpx;
  flex-shrink: 0;
}
.candidate-fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.candidate-row {
  display: flex;
  gap: 10rpx;
  align-items: center;
}
.candidate-price {
  width: 140rpx;
}
.candidate-qty {
  width: 140rpx;
}
.candidate-unit {
  width: 120rpx;
}
.candidate-category {
  flex: 1;
}
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.save-button {
  width: 100%;
  background: #c81623;
  border-color: #c81623;
}
.hidden-input {
  display: none;
}
</style>
