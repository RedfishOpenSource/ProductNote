import { Capacitor, registerPlugin } from '@capacitor/core'
import { getPrimaryProductImage } from '../types/product'
import type { Product, StoredFile } from '../types/product'
import type {
  ProductVisualIndex,
  VisualLabel,
  VisualModelInfo,
  VisualSearchResult,
} from '../types/visual-search'
import { getStoredFileUri, resolveFileUrl } from './file-service'
import {
  deleteProductVisualIndex,
  listProductVisualIndexes,
  saveProductVisualIndex,
} from './product-store'

interface VisualSearchPlugin {
  extractLabels(options: { imageUri: string }): Promise<{ labels: VisualLabel[]; modelId: string }>
  getModelInfo(): Promise<VisualModelInfo>
}

interface FallbackSignature {
  hash: Uint8Array
  histogram: number[]
}

const VisualSearch = registerPlugin<VisualSearchPlugin>('VisualSearch')
const isAndroid = Capacitor.getPlatform() === 'android'
const fallbackModelId = 'js-image-signature-v1'
const fallbackHashSize = 8
const fallbackHistogramSize = 16
const fallbackHistogramLevels = 4
const fallbackSignatureCache = new Map<string, Promise<FallbackSignature>>()
let ensurePromise: Promise<number> | null = null

function hasNativeVisualSearch(): boolean {
  return isAndroid && Capacitor.isPluginAvailable('VisualSearch')
}

function canUseFallbackVisualSearch(): boolean {
  return typeof document !== 'undefined' && typeof Image !== 'undefined'
}

function normalizeLabels(labels: VisualLabel[]): Map<string, number> {
  const map = new Map<string, number>()

  for (const label of labels) {
    const key = label.text.trim().toLowerCase()
    if (!key) continue
    map.set(key, Math.max(map.get(key) ?? 0, label.confidence))
  }

  return map
}

function buildMatchLevel(score: number): VisualSearchResult['matchLevel'] {
  if (score >= 0.62) return '最像'
  if (score >= 0.38) return '较像'
  return '相关'
}

function calculateSimilarity(queryLabels: VisualLabel[], indexedLabels: VisualLabel[]): number {
  const left = normalizeLabels(queryLabels)
  const right = normalizeLabels(indexedLabels)
  const allKeys = new Set([...left.keys(), ...right.keys()])
  let numerator = 0
  let denominator = 0

  for (const key of allKeys) {
    const leftValue = left.get(key) ?? 0
    const rightValue = right.get(key) ?? 0
    numerator += Math.min(leftValue, rightValue)
    denominator += Math.max(leftValue, rightValue)
  }

  return denominator === 0 ? 0 : numerator / denominator
}

async function extractLabelsFromStoredFile(
  file: StoredFile,
): Promise<{ labels: VisualLabel[]; modelId: string }> {
  const imageUri = await getStoredFileUri(file)
  return VisualSearch.extractLabels({ imageUri })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`无法加载图片: ${src}`))
    image.src = src
  })
}

function getImageData(image: HTMLImageElement, size: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    throw new Error('当前环境不支持图片搜索')
  }

  context.drawImage(image, 0, 0, size, size)
  return context.getImageData(0, 0, size, size).data
}

function buildAverageHash(data: Uint8ClampedArray): Uint8Array {
  const values = new Array<number>(fallbackHashSize * fallbackHashSize)
  let total = 0

  for (let index = 0; index < values.length; index += 1) {
    const offset = index * 4
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    const grayscale = red * 0.299 + green * 0.587 + blue * 0.114
    values[index] = grayscale
    total += grayscale
  }

  const average = total / values.length
  return Uint8Array.from(values.map((value) => (value >= average ? 1 : 0)))
}

function buildColorHistogram(data: Uint8ClampedArray): number[] {
  const binsPerChannel = fallbackHistogramLevels
  const histogram = new Array<number>(binsPerChannel ** 3).fill(0)
  const pixelCount = data.length / 4

  for (let offset = 0; offset < data.length; offset += 4) {
    const redBin = Math.min(binsPerChannel - 1, Math.floor((data[offset] / 256) * binsPerChannel))
    const greenBin = Math.min(binsPerChannel - 1, Math.floor((data[offset + 1] / 256) * binsPerChannel))
    const blueBin = Math.min(binsPerChannel - 1, Math.floor((data[offset + 2] / 256) * binsPerChannel))
    const index = redBin * binsPerChannel * binsPerChannel + greenBin * binsPerChannel + blueBin
    histogram[index] += 1
  }

  return histogram.map((value) => value / pixelCount)
}

async function createFallbackSignature(file: StoredFile): Promise<FallbackSignature> {
  const source = await resolveFileUrl(file)
  if (!source) {
    throw new Error('图片地址无效')
  }

  const image = await loadImage(source)
  const hashData = getImageData(image, fallbackHashSize)
  const histogramData = getImageData(image, fallbackHistogramSize)

  return {
    hash: buildAverageHash(hashData),
    histogram: buildColorHistogram(histogramData),
  } satisfies FallbackSignature
}

async function getFallbackSignature(file: StoredFile): Promise<FallbackSignature> {
  const cacheKey = file.path
  const cached = fallbackSignatureCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const pending = createFallbackSignature(file)
  fallbackSignatureCache.set(cacheKey, pending)

  try {
    return pending
  } catch (error) {
    fallbackSignatureCache.delete(cacheKey)
    throw error
  }
}

function compareHashes(left: Uint8Array, right: Uint8Array): number {
  let matches = 0

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) {
      matches += 1
    }
  }

  return matches / left.length
}

function compareHistograms(left: number[], right: number[]): number {
  let overlap = 0

  for (let index = 0; index < left.length; index += 1) {
    overlap += Math.min(left[index], right[index])
  }

  return overlap
}

function calculateFallbackSimilarity(left: FallbackSignature, right: FallbackSignature): number {
  const hashScore = compareHashes(left.hash, right.hash)
  const histogramScore = compareHistograms(left.histogram, right.histogram)
  return hashScore * 0.72 + histogramScore * 0.28
}

async function searchProductsByFallback(file: StoredFile, products: Product[]): Promise<VisualSearchResult[]> {
  if (!canUseFallbackVisualSearch()) {
    throw new Error('当前环境不支持图片搜索')
  }

  const querySignature = await getFallbackSignature(file)
  const productsWithImages = products
    .map((product) => ({ product, image: getPrimaryProductImage(product) }))
    .filter((item): item is { product: Product; image: StoredFile } => Boolean(item.image))
  const results = await Promise.all(
    productsWithImages.map(async ({ product, image }) => {
      const signature = await getFallbackSignature(image)
      const score = calculateFallbackSimilarity(querySignature, signature)
      return {
        productId: product.id,
        score,
        matchLevel: buildMatchLevel(score),
      } satisfies VisualSearchResult
    }),
  )

  return results.filter((item) => item.score > 0.2).sort((left, right) => right.score - left.score)
}

export function isVisualSearchSupported(): boolean {
  return hasNativeVisualSearch() || canUseFallbackVisualSearch()
}

export async function getVisualModelInfo(): Promise<VisualModelInfo> {
  if (hasNativeVisualSearch()) {
    return VisualSearch.getModelInfo()
  }

  if (isVisualSearchSupported()) {
    return {
      modelId: fallbackModelId,
      maxResults: 50,
    } satisfies VisualModelInfo
  }

  return {
    modelId: 'web-unsupported',
    maxResults: 0,
  } satisfies VisualModelInfo
}

export async function upsertProductVisualIndex(product: Product): Promise<void> {
  if (!hasNativeVisualSearch()) return

  const image = getPrimaryProductImage(product)

  if (!image) {
    await deleteProductVisualIndex(product.id)
    return
  }

  const extracted = await extractLabelsFromStoredFile(image)
  const index: ProductVisualIndex = {
    productId: product.id,
    imagePath: image.path,
    labels: extracted.labels,
    modelId: extracted.modelId,
    indexedAt: new Date().toISOString(),
  }

  await saveProductVisualIndex(index)
}

export async function removeProductVisualIndex(productId: string): Promise<void> {
  if (!hasNativeVisualSearch()) return

  await deleteProductVisualIndex(productId)
}

export async function ensureVisualIndexes(products: Product[]): Promise<number> {
  if (!hasNativeVisualSearch()) return 0
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    const model = await getVisualModelInfo()
    const indexes = await listProductVisualIndexes()
    const indexMap = new Map(indexes.map((item) => [item.productId, item]))
    let changedCount = 0

    for (const product of products) {
      const image = getPrimaryProductImage(product)

      if (!image) {
        if (indexMap.has(product.id)) {
          await deleteProductVisualIndex(product.id)
          changedCount += 1
        }
        continue
      }

      const currentIndex = indexMap.get(product.id)
      const needsReindex =
        !currentIndex ||
        currentIndex.imagePath !== image.path ||
        currentIndex.modelId !== model.modelId ||
        currentIndex.labels.length === 0

      if (!needsReindex) continue

      await upsertProductVisualIndex(product)
      changedCount += 1
    }

    return changedCount
  })().finally(() => {
    ensurePromise = null
  })

  return ensurePromise
}

export async function searchProductsByStoredFile(
  file: StoredFile,
  products: Product[],
): Promise<VisualSearchResult[]> {
  if (hasNativeVisualSearch()) {
    const query = await extractLabelsFromStoredFile(file)
    if (query.labels.length === 0) return []

    const productMap = new Map(products.map((product) => [product.id, product]))
    const indexes = await listProductVisualIndexes()

    return indexes
      .filter((index) => productMap.has(index.productId))
      .map((index) => {
        const score = calculateSimilarity(query.labels, index.labels)
        return {
          productId: index.productId,
          score,
          matchLevel: buildMatchLevel(score),
        } satisfies VisualSearchResult
      })
      .filter((item) => item.score > 0.12)
      .sort((left, right) => right.score - left.score)
  }

  return searchProductsByFallback(file, products)
}
