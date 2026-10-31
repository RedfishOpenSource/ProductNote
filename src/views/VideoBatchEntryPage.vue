<template>
  <div class="page-shell video-entry-page">
    <header class="page-header panel-card">
      <el-button aria-label="返回商品列表" :disabled="saving" @click="goBack"><el-icon><Back /></el-icon></el-button>
      <h1 class="page-title">视频批量录入</h1>
    </header>

    <main class="form-content">
      <section v-if="stage === 'pick'" class="panel-card form-section">
        <h2>1. 选择视频</h2>
        <p>全程本地处理，不上传视频。缓慢拍摄货架；抽帧只是候选画面，不会自动检测一帧中有几件商品。</p>
        <div class="action-grid">
          <el-button type="primary" @click="videoInput?.click()"><el-icon><VideoCamera /></el-icon>从相册选择</el-button>
          <el-button @click="videoCaptureInput?.click()"><el-icon><Camera /></el-icon>直接录制</el-button>
        </div>
        <p v-if="videoFileName" class="picked-name">已选择：{{ videoFileName }}</p>
        <label class="field-block"><span>抽帧间隔（秒）</span><el-input-number v-model="intervalSeconds" :min="1" :max="10" /></label>
        <p class="muted-tip">每次最多 60 张候选图；长视频建议分段。Web/安卓解码能力取决于设备，优先使用 MP4/H.264。</p>
        <el-button type="primary" :disabled="!videoFile || extracting" @click="startExtraction">开始抽帧分析</el-button>
        <p v-if="extractError" role="alert" class="field-error">{{ extractError }}</p>
      </section>

      <section v-if="stage === 'extracting'" class="panel-card form-section">
        <h2>2. 正在抽帧分析</h2>
        <p>扫描 {{ Math.floor(progressScanned) }}s / {{ Math.ceil(progressTotal) }}s，保留 {{ progressKept }} 张候选图</p>
        <el-progress :percentage="progressPercent" :stroke-width="14" />
        <p class="muted-tip">相邻保留画面过于相似时跳过，不能保证去除所有重复或拍全所有商品。</p>
        <el-button @click="cancelExtraction">取消分析</el-button>
      </section>

      <section v-if="stage === 'review'" class="panel-card form-section" :aria-busy="saving">
        <h2>3. 确认候选商品</h2>
        <p>共 {{ candidates.length }} 张，待入库已选 {{ selectedCount }} 件，已保存 {{ savedCount }} 件<span v-if="dedupLog.length">，已去重 {{ dedupLog.length }} 件</span><span v-if="analyzingSimilarity">，画面相似度分析中…</span>。</p>
        <p class="muted-tip">{{ namingSupported ? '标签仅为名称建议，请核实。' : '当前设备未提供语义标签，已自动赋「待命名-编号」占位名（不是识别结果），入库后请在商品列表改名核实。' }}价格、库存可留空表示未知；不会从视频猜测。</p>
        <p v-if="frameLimitReached" role="status" class="warning-tip">已达到 60 张候选上限，视频后段可能未扫描，请分段补录。</p>
        <div class="bulk-bar">
          <el-checkbox v-model="allChecked" :indeterminate="partlyChecked" :disabled="saving || !editableCount">全选</el-checkbox>
          <label class="bulk-unit-label" for="default-unit">默认单位</label>
          <el-input id="default-unit" v-model="defaultUnit" class="bulk-unit-input" maxlength="16" :disabled="saving" />
          <el-button size="small" :disabled="saving" @click="applyDefaultUnit">套用到所选</el-button>
          <el-button size="small" :disabled="saving" @click="resetVideo">换视频</el-button>
        </div>

        <div class="candidate-list">
          <article v-for="(candidate, index) in candidates" :key="candidate.id" class="candidate-card" :class="{ off: !candidate.checked && !candidate.saved }" :data-candidate-id="candidate.id">
            <div class="candidate-image">
              <img :src="candidate.frame.dataUrl" :alt="`候选画面 ${index + 1}`" />
              <span>{{ candidate.frame.timestampSeconds }}s</span>
            </div>
            <div class="candidate-fields">
              <div class="candidate-heading">
                <el-checkbox v-model="candidate.checked" :disabled="saving || candidate.saved" :aria-label="`选择候选 ${index + 1}`">{{ candidate.saved ? '已入库' : `候选 ${index + 1}` }}</el-checkbox>
                <el-button link type="danger" :disabled="saving || candidate.saved" @click="removeCandidate(candidate.id)">删除候选</el-button>
              </div>
              <label class="field-block"><span>商品名称 *</span><el-input v-model="candidate.name" :disabled="saving || candidate.saved" placeholder="核对后填写商品名称" maxlength="100" @input="candidate.autoNamed = false; candidate.error = ''; candidate.duplicate = null" /></label>
              <div class="candidate-row">
                <label class="field-block"><span>价格（元）</span><el-input v-model="candidate.priceText" :disabled="saving || candidate.saved" inputmode="decimal" placeholder="未知可留空" @input="candidate.error = ''" /></label>
                <label class="field-block"><span>库存</span><el-input v-model="candidate.quantityText" :disabled="saving || candidate.saved" inputmode="numeric" placeholder="未知可留空" @input="candidate.error = ''" /></label>
                <label class="field-block"><span>单位</span><el-input v-model="candidate.unit" :disabled="saving || candidate.saved" maxlength="16" placeholder="个" /></label>
              </div>
              <div class="candidate-row category-row">
                <label class="field-block"><span>分类</span><el-select v-model="candidate.category" :disabled="saving || candidate.saved" placeholder="待确认" clearable><el-option v-for="item in AGENTMALL_CATEGORIES" :key="item" :label="item" :value="item" /></el-select></label>
                <label class="field-block"><span>批发价（元）</span><el-input v-model="candidate.wholesalePriceText" :disabled="saving || candidate.saved" inputmode="decimal" placeholder="可选，不含在 CSV 中" @input="candidate.error = ''" /></label>
              </div>
              <p v-if="candidate.error" role="alert" class="field-error">{{ candidate.error }}</p>
              <p v-if="candidate.duplicate" role="status" class="duplicate-tip">与{{ candidate.duplicate.matchedLabel }}「{{ candidate.duplicate.matchedName }}」重复，本次未入库；改名后可重新入库。</p>
              <p v-if="candidate.similarExisting.length || candidate.similarBatch.length" role="status" class="similar-tip">画面相似：{{ similarText(candidate) }}。是否入库由您勾选决定。</p>
            </div>
          </article>
        </div>
        <p v-if="!candidates.length">暂无候选，请换视频重试。</p>
        <p v-if="saveError" role="alert" class="field-error">{{ saveError }}</p>
      </section>

      <section v-if="dedupLog.length && (stage === 'review' || stage === 'done')" class="panel-card form-section" aria-label="去重报告">
        <h2>去重报告（{{ dedupLog.length }} 件未入库）</h2>
        <p class="muted-tip">按商品名称精确匹配判定重复；重复候选未写入商品，改名后可重新入库。</p>
        <ul class="dedup-list">
          <li v-for="entry in dedupLog" :key="entry.seq">候选 {{ entry.candidateIndex }}「{{ entry.candidateName }}」与{{ entry.matchedLabel }}「{{ entry.matchedName }}」重复</li>
        </ul>
      </section>

      <section v-if="stage === 'done'" class="panel-card form-section">
        <h2>已入库 {{ savedCount }} 件商品</h2>
        <p>CSV 只传名称、分类、价格、库存和单位，不含图片或批发价。未填数据导入销售端前须补齐；微信端导入尚未联调。</p>
        <p class="warning-tip">AgentMall 旧导入器尚不完整支持表头、引号和换行，且空数值会变成零。目前请把 CSV 视为待核对清单，不要直接整文件粘贴上架。</p>
        <div class="action-grid">
          <el-button type="primary" :loading="exporting" @click="exportCsv"><el-icon><Download /></el-icon>导出 AgentMall CSV</el-button>
          <el-button @click="goBack">返回商品列表</el-button>
        </div>
      </section>
    </main>

    <footer v-if="stage === 'review'" class="bottom-bar">
      <el-button v-if="savedCount" :disabled="saving" :loading="exporting" @click="exportCsv">导出已入库</el-button>
      <el-button type="primary" :loading="saving" :disabled="!selectedCount || exporting" @click="saveSelected">入库所选（{{ selectedCount }}）</el-button>
    </footer>
    <input ref="videoInput" accept="video/*" class="hidden-input" type="file" @change="handleVideoPicked" />
    <input ref="videoCaptureInput" accept="video/*" capture="environment" class="hidden-input" type="file" @change="handleVideoPicked" />
  </div>
</template>

<script setup lang="ts">
import { Back, Camera, Download, VideoCamera } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { AGENTMALL_CATEGORIES, exportAgentMallCsv } from '../services/agentmall-export'
import { deleteStoredFile, savePhotoBlob } from '../services/file-service'
import { createId } from '../services/id'
import { parseOptionalPrice, parseOptionalQuantity } from '../services/product-entry-fields'
import { getProductById, listProducts, saveProduct } from '../services/product-store'
import {
  calculateImageSimilarity,
  extractLabelsForFile,
  findSimilarProductsByImage,
  IMAGE_SIMILARITY_THRESHOLD,
  isSemanticLabelingSupported,
  storedFileFromDataUrl,
  type SimilarProductHint,
} from '../services/visual-search-service'
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
  wholesalePriceText: string
  unit: string
  category: string
  file: StoredFile | null
  frame: ExtractedFrame
  autoNamed: boolean
  saved: boolean
  error: string
  createdAt: string
  duplicate: DuplicateMatch | null
  /** 上次写入结果不确定（可能已按固定 ID 落库），重试时必须豁免名称去重。 */
  saveFailed: boolean
  similarExisting: SimilarProductHint[]
  similarBatch: BatchSimilarRef[]
}
interface BatchSimilarRef {
  index: number
  name: string
}
/** 去重报告条目：记录候选与哪条商品重复，不静默丢弃。 */
interface DuplicateMatch {
  seq: number
  candidateIndex: number
  candidateName: string
  matchedLabel: string
  matchedName: string
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
const defaultUnit = ref('个')
const saving = ref(false)
const exporting = ref(false)
const saveError = ref('')
const savedProducts = ref<Product[]>([])
const dedupLog = ref<DuplicateMatch[]>([])
let dedupSeq = 0
const analyzingSimilarity = ref(false)
const namingSupported = isSemanticLabelingSupported()
let controller: AbortController | null = null
let generation = 0
let disposed = false
// 只清理尚未移交商品存储的临时图片；写入结果不确定时保守保留。
const temporaryFiles = new Map<string, StoredFile>()
const protectedPaths = new Set<string>()
const imageWrites = new Map<string, Promise<StoredFile>>()
const selectedCount = computed(() => candidates.value.filter((item) => item.checked && !item.saved).length)
const editableCount = computed(() => candidates.value.filter((item) => !item.saved).length)
const savedCount = computed(() => savedProducts.value.length)
const frameLimitReached = computed(() => progressKept.value >= 60)
const allChecked = computed({
  get: () => editableCount.value > 0 && selectedCount.value === editableCount.value,
  set: (value: boolean) => candidates.value.forEach((item) => { if (!item.saved) item.checked = value }),
})
const partlyChecked = computed(() => selectedCount.value > 0 && selectedCount.value < editableCount.value)
const progressPercent = computed(() => progressTotal.value ? Math.min(100, Math.round(progressScanned.value / progressTotal.value * 100)) : 0)

function goBack(): void { void router.push('/') }
function cancelExtraction(): void { controller?.abort() }
function handleVideoPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name)) {
    extractError.value = '请选择视频文件'; return
  }
  videoFile.value = file
  videoFileName.value = file.name
  extractError.value = ''
}
/** 占位名取自候选固定 ID 的随机段：跨批次唯一，不会误触发同名去重；重试沿用同一 ID，占位名稳定。 */
function defaultCandidateName(id: string): string {
  return `待命名-${(id.split('-').pop() ?? '000000').toUpperCase()}`
}
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',')
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  return new Blob([bytes], { type: /:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg' })
}
async function ensureImage(item: CandidateItem): Promise<StoredFile> {
  if (item.file) return item.file
  const pending = imageWrites.get(item.id)
  if (pending) return pending
  const write = (async () => {
    const file = await savePhotoBlob(dataUrlToBlob(item.frame.dataUrl))
    if (disposed || !candidates.value.includes(item)) {
      await deleteStoredFile(file)
      throw new DOMException('候选已移除', 'AbortError')
    }
    item.file = file
    temporaryFiles.set(file.path, file)
    return file
  })()
  imageWrites.set(item.id, write)
  try { return await write } finally { imageWrites.delete(item.id) }
}
async function cleanupImages(): Promise<void> {
  const files = [...temporaryFiles.values()]
  temporaryFiles.clear()
  await Promise.all(files.filter((file) => !protectedPaths.has(file.path)).map((file) => deleteStoredFile(file)))
}
async function startExtraction(): Promise<void> {
  if (!videoFile.value || extracting.value) return
  const run = ++generation
  controller = new AbortController()
  const signal = controller.signal
  extracting.value = true
  extractError.value = ''
  stage.value = 'extracting'
  progressKept.value = progressScanned.value = progressTotal.value = 0
  let url = ''
  try {
    url = URL.createObjectURL(videoFile.value)
    const frames = await extractCandidateFrames(url, {
      intervalSeconds: intervalSeconds.value, signal,
      onProgress: (kept, scanned, total) => { progressKept.value = kept; progressScanned.value = scanned; progressTotal.value = total },
    })
    if (disposed || signal.aborted || run !== generation) return
    if (!frames.length) throw new Error('没有提取到候选画面，请换视频重试')
    candidates.value = frames.map((frame) => {
      const id = createId('product')
      return {
        id, checked: true, name: defaultCandidateName(id), priceText: '', quantityText: '', wholesalePriceText: '',
        unit: defaultUnit.value.trim() || '个', category: '', file: null, frame, autoNamed: true, saved: false, error: '', createdAt: '', duplicate: null, saveFailed: false, similarExisting: [], similarBatch: [],
      }
    })
    stage.value = 'review'
    void enhanceNames(run)
    void analyzeSimilarities(run)
  } catch (error) {
    if (disposed) return
    extractError.value = error instanceof Error && error.name === 'AbortError' ? '' : error instanceof Error ? error.message : '抽帧失败'
    stage.value = 'pick'
  } finally {
    if (url) URL.revokeObjectURL(url)
    controller = null
    extracting.value = false
  }
}
async function enhanceNames(run: number): Promise<void> {
  if (!namingSupported) return
  for (const item of candidates.value) {
    if (disposed || generation !== run || saving.value || stage.value !== 'review') return
    if (!item.autoNamed || item.saved) continue
    try {
      const originalName = item.name
      const file = await ensureImage(item)
      const labels = await extractLabelsForFile(file)
      if (disposed || run !== generation || saving.value || !candidates.value.includes(item)) return
      const suggested = suggestNameFromLabels([...labels].sort((a, b) => b.confidence - a.confidence).map((label) => label.text))
      if (suggested && item.autoNamed && !item.saved && item.name === originalName) item.name = suggested
    } catch { /* 建议失败不阻塞人工录入。 */ }
  }
}
/** 画面相似度仅提示不改勾选：与已有商品及本批次先出现候选对比，是否入库由用户勾选决定。 */
async function analyzeSimilarities(run: number): Promise<void> {
  if (!candidates.value.length) return
  analyzingSimilarity.value = true
  let existing: Product[] = []
  try {
    existing = await listProducts()
  } catch {
    existing = []
  }
  for (let index = 0; index < candidates.value.length; index += 1) {
    if (disposed || generation !== run || stage.value !== 'review') break
    const item = candidates.value[index]
    if (item.saved) continue
    const frameFile = storedFileFromDataUrl(item.frame.dataUrl, `frame-${item.frame.timestampSeconds}s.jpg`)
    try {
      const hints = await findSimilarProductsByImage(frameFile, existing)
      if (disposed || generation !== run) break
      item.similarExisting = hints
    } catch {
      item.similarExisting = []
    }
    const batch: BatchSimilarRef[] = []
    for (let before = 0; before < index; before += 1) {
      const other = candidates.value[before]
      if (other.saved) continue
      try {
        const score = await calculateImageSimilarity(frameFile, storedFileFromDataUrl(other.frame.dataUrl, `frame-${other.frame.timestampSeconds}s.jpg`))
        if (score >= IMAGE_SIMILARITY_THRESHOLD) batch.push({ index: before + 1, name: other.name })
      } catch { /* 忽略单对失败 */ }
    }
    if (disposed || generation !== run) break
    item.similarBatch = batch
  }
  if (!disposed && generation === run) analyzingSimilarity.value = false
}

function similarText(item: CandidateItem): string {
  const parts = item.similarExisting.map((hint) => `已有商品「${hint.productName}」相似度 ${Math.round(hint.score * 100)}%`)
  parts.push(...item.similarBatch.map((ref) => `与本批次候选 ${ref.index}「${ref.name}」画面相似`))
  return parts.join('；')
}

async function removeCandidate(id: string): Promise<void> {
  if (saving.value) return
  const item = candidates.value.find((candidate) => candidate.id === id)
  if (!item || item.saved) return
  generation += 1
  candidates.value = candidates.value.filter((candidate) => candidate.id !== id)
  if (item.file && !protectedPaths.has(item.file.path)) {
    temporaryFiles.delete(item.file.path)
    await deleteStoredFile(item.file)
  }
}
function applyDefaultUnit(): void {
  candidates.value.forEach((item) => { if (item.checked && !item.saved) item.unit = defaultUnit.value.trim() || '个' })
}
async function resetVideo(): Promise<void> {
  if (saving.value || !window.confirm('更换视频会丢弃未入库候选，已保存商品不受影响。继续？')) return
  generation += 1
  // 先撤销候选，未完成的图片写入检测到归属失效后自行清理。
  candidates.value = []
  await cleanupImages()
  videoFile.value = null
  videoFileName.value = ''
  stage.value = 'pick'
}
async function saveSelected(): Promise<void> {
  if (saving.value) return
  const selected = candidates.value.filter((item) => item.checked && !item.saved)
  if (!selected.length) return
  saving.value = true
  generation += 1
  saveError.value = ''
  // 按名称精确匹配去重：与库中已有商品或本批次先出现的候选同名即视为重复；写入去重报告，不静默跳过。
  let existing: Product[]
  try {
    existing = await listProducts()
  } catch {
    saving.value = false
    saveError.value = '去重检查失败：无法读取已有商品，本次未保存任何商品，请重试'
    ElMessage.error(saveError.value)
    return
  }
  const knownNames = new Map<string, { label: string; name: string }>()
  for (const product of existing) {
    const name = product.name.trim()
    if (name && !knownNames.has(name)) knownNames.set(name, { label: '已有商品', name })
  }
  const duplicates = new Map<string, DuplicateMatch>()
  const batchNames = new Map<string, { label: string; name: string }>()
  for (const item of selected) {
    const name = item.name.trim()
    const index = candidates.value.indexOf(item) + 1
    if (item.saveFailed) {
      // 上次写入结果不确定，重试沿用固定 ID 覆盖自身，不参与名称去重。
      batchNames.set(name, { label: `本批次候选 ${index}`, name })
      continue
    }
    const existingMatch = knownNames.get(name)
    const batchMatch = batchNames.get(name)
    if (existingMatch || batchMatch) {
      duplicates.set(item.id, {
        seq: ++dedupSeq,
        candidateIndex: index,
        candidateName: name,
        matchedLabel: existingMatch ? '已有商品' : batchMatch!.label,
        matchedName: existingMatch ? existingMatch.name : batchMatch!.name,
      })
      continue
    }
    batchNames.set(name, { label: `本批次候选 ${index}`, name })
  }
  const toSave = selected.filter((item) => !duplicates.has(item.id))
  for (const item of selected) {
    const match = duplicates.get(item.id)
    if (!match) continue
    item.checked = false
    item.duplicate = match
    dedupLog.value.push(match)
  }
  if (!toSave.length) {
    saving.value = false
    ElMessage({ type: 'info', message: `所选 ${selected.length} 件全部重复，未新增商品，详见去重报告`, grouping: true, duration: 2400 })
    return
  }
  let valid = true
  const parsed = new Map<string, { price: number | null; quantity: number | null; wholesalePrice: number | null }>()
  for (const item of toSave) {
    item.error = ''
    try {
      if (!item.name.trim()) throw new Error('请确认并填写商品名称，不能直接保存未命名候选')
      parsed.set(item.id, { price: parseOptionalPrice(item.priceText), quantity: parseOptionalQuantity(item.quantityText), wholesalePrice: parseOptionalPrice(item.wholesalePriceText, '批发价') })
    } catch (error) { item.error = error instanceof Error ? error.message : '字段无效'; valid = false }
  }
  if (!valid) {
    saving.value = false
    ElMessage({ type: 'warning', message: '请先修正所选商品中的错误，尚未写入任何商品', grouping: true, duration: 1800 })
    return
  }
  try {
    for (const item of toSave) {
      const file = await ensureImage(item)
      const now = new Date().toISOString()
      item.createdAt ||= now
      const product: Product = {
        id: item.id, name: item.name.trim(), ...parsed.get(item.id)!,
        description: `视频来源：${videoFileName.value}，时间点 ${item.frame.timestampSeconds}s，名称${item.autoNamed ? '为自动占位、待改名核实' : '经人工确认'}`,
        supplierName: '', supplierPhone: '', image: file, images: [file], attachments: [], model3d: null,
        createdAt: item.createdAt, updatedAt: now, category: item.category, unit: item.unit.trim() || '个',
      }
      protectedPaths.add(file.path)
      try { await saveProduct(product) } catch (error) {
        // 写入回报失败时，先核对固定 ID；无法核对则保留文件，避免破坏可能已保存的图片。
        const exists = await getProductById(item.id).catch(() => undefined)
        if (exists === null) protectedPaths.delete(file.path)
        item.error = '入库未完成，请重试；会沿用同一商品 ID，不重复新增'
        item.saveFailed = true
        throw error
      }
      temporaryFiles.delete(file.path)
      item.saved = true
      item.checked = false
      savedProducts.value.push(product)
    }
    stage.value = candidates.value.some((item) => !item.saved) ? 'review' : 'done'
    ElMessage.success(duplicates.size
      ? `本次保存 ${toSave.length} 件，${duplicates.size} 件因重复未入库（见去重报告），累计入库 ${savedCount.value} 件商品`
      : `本次保存 ${toSave.length} 件，累计入库 ${savedCount.value} 件商品`)
  } catch (error) {
    saveError.value = `本批次已保存 ${savedCount.value} 件；未完成项可重试。${error instanceof Error ? error.message : '保存失败'}`
    ElMessage.error(saveError.value)
  } finally { saving.value = false }
}
async function exportCsv(): Promise<void> {
  if (exporting.value || !savedCount.value) return
  exporting.value = true
  try { await exportAgentMallCsv(savedProducts.value); ElMessage.success('CSV 已导出，请核对后再导入销售端') }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '导出失败') }
  finally { exporting.value = false }
}
onBeforeRouteLeave(() => {
  if (saving.value) { ElMessage.warning('正在入库，请稍候'); return false }
  if ((stage.value === 'review' && editableCount.value > 0) || extracting.value) {
    if (!window.confirm('离开会丢弃未入库候选并取消分析，确定离开？')) return false
  }
  return true
})
onBeforeUnmount(() => { disposed = true; generation += 1; controller?.abort(); void cleanupImages() })
</script>

<style scoped>
.video-entry-page { max-width: 1000px; margin: 0 auto; padding-bottom: calc(100px + env(safe-area-inset-bottom, 0px)); }
.page-header { justify-content: flex-start; }
.page-header .el-button { width: 40px; padding: 0; }
.page-title { font-size: 20px; }
.form-content, .candidate-list { display: grid; gap: 12px; }
.form-section h2 { margin: 0 0 10px; font-size: 18px; color: var(--app-title); }
.form-section p { color: var(--app-text-secondary); line-height: 1.5; font-size: 13px; overflow-wrap: anywhere; }
.action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.action-grid :deep(.el-button + .el-button) { margin-left: 0; }
.field-block { display: grid; gap: 5px; min-width: 0; font-size: 13px; color: var(--app-text-secondary); }
.form-section > .field-block { margin: 16px 0; }
.field-block .el-select { width: 100%; }
.bulk-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.bulk-unit-label { font-size: 13px; }
.bulk-unit-input { width: 72px; }
.candidate-card { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 14px; border: 1px solid var(--app-border, #dcdfe6); border-radius: 12px; padding: 12px; }
.candidate-card.off { opacity: 0.65; }
.candidate-image img { width: 100%; height: 130px; object-fit: contain; background: #f4f6fb; border-radius: 8px; }
.candidate-image span { display: block; margin-top: 6px; font-size: 12px; color: var(--app-text-secondary); }
.candidate-fields { display: grid; gap: 8px; min-width: 0; }
.candidate-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.candidate-heading .el-checkbox { margin-right: 0; }
.candidate-row { display: grid; grid-template-columns: 1.3fr 1fr 0.8fr; gap: 8px; }
.category-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-section .field-error { color: #c00000; margin: 6px 0; }
.form-section .warning-tip { color: #996300; }
.form-section .duplicate-tip { color: #996300; margin: 6px 0; }
.form-section .similar-tip { color: #1f5fa9; margin: 6px 0; }
.dedup-list { margin: 0; padding-left: 18px; display: grid; gap: 4px; color: var(--app-text-secondary); font-size: 13px; line-height: 1.6; }
.bottom-bar { position: fixed; z-index: 5; bottom: 0; left: 0; right: 0; display: flex; justify-content: center; gap: 8px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)); background: var(--app-card); box-shadow: 0 -2px 12px #00000012; }
.bottom-bar .el-button { flex: 1; max-width: 400px; }
.hidden-input { display: none; }
@media (max-width: 540px) {
  .video-entry-page { padding: 10px 10px calc(100px + env(safe-area-inset-bottom, 0px)); }
  .panel-card { padding: 12px; }
  .candidate-card { grid-template-columns: minmax(0, 1fr); }
  .candidate-image img { height: 180px; }
  .candidate-heading { flex-wrap: wrap; }
}
</style>
