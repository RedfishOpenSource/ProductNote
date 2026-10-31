/**
 * AgentMall 素材包导出(v1 契约):把商品与图片打包为 zip,供店主端导入微信小程序商城。
 *
 * 包结构(契约,两端共同遵守;AgentMall admin 云函数按此解析):
 *   agentmall-素材包-YYYYMMDD.zip
 *   ├─ manifest.json   UTF-8 JSON,不含时间戳等易变字段 → 同内容重复导出摘要一致,服务端可幂等
 *   └─ images/p<商品序号>-<图片序号>.<jpg|png|webp>
 *
 * manifest.json:
 *   { "version": 1, "products": [
 *     { "name": "圆桌", "category": "桌椅宴会", "priceYuan": 180, "stock": 4,
 *       "unit": "张", "images": ["images/p0-0.jpg"] } ] }
 *   - priceYuan/stock 为 null 表示未填(AgentMall 侧按仅询价/待补处理),不补零。
 *   - category 为 AgentMall 五分类之一或 ''(未分类,与 CSV 导出同一套关键词推断)。
 *   - images 按顺序即展示顺序,第一张为封面;最多 5 张,与 AgentMall 商品图片协议一致。
 *
 * 限制:v1 只打包 kind==='image' 且 mime 为 jpeg/png/webp 的文件;
 *       视频/附件/3D 模型不进包;单图 ≤5MB,包总量 ≤50MB,商品 ≤200,单商品图片 ≤5。
 */
import { zipSync, strToU8 } from 'fflate'
import type { Product, StoredFile } from '../types/product'
import { mapCategoryByName } from './agentmall-export'
import { exportFileBlob, exportStoredFile } from './file-service'

export const PACKAGE_VERSION = 1
export const PACKAGE_MAX_PRODUCTS = 200
export const PACKAGE_MAX_IMAGES_PER_PRODUCT = 5
export const PACKAGE_MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const PACKAGE_MAX_TOTAL_BYTES = 50 * 1024 * 1024

const SUPPORTED_IMAGE_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function buildManifest(products: Product[]) {
  return {
    version: PACKAGE_VERSION,
    products: products.map((product) => ({
      name: product.name,
      category: product.category?.trim() || mapCategoryByName(product.name),
      priceYuan: product.price ?? null,
      stock: product.quantity ?? null,
      unit: product.unit?.trim() || '个',
      images: [] as string[],
    })),
  }
}

/** 校验并收集素材包内容;任何问题抛出含全部问题的 Error,不产出残缺包 */
export async function buildAgentMallPackage(
  products: Product[]
): Promise<{ manifestText: string; files: Record<string, Uint8Array>; totalBytes: number }> {
  if (!products.length) {
    throw new Error('还没有商品可导出')
  }
  if (products.length > PACKAGE_MAX_PRODUCTS) {
    throw new Error(`商品共 ${products.length} 件,素材包单次最多 ${PACKAGE_MAX_PRODUCTS} 件,请分批(先备份再删除已完成部分)`)
  }

  const manifest = buildManifest(products)
  const files: Record<string, Uint8Array> = {}
  const problems: string[] = []
  let totalBytes = 0

  for (let p = 0; p < products.length; p += 1) {
    const product = products[p]
    const images = (product.images ?? []).filter((file): file is StoredFile => !!file && file.kind === 'image')

    if (images.length > PACKAGE_MAX_IMAGES_PER_PRODUCT) {
      problems.push(`「${product.name}」有 ${images.length} 张图片,每件商品最多 ${PACKAGE_MAX_IMAGES_PER_PRODUCT} 张`)
      continue
    }

    for (let i = 0; i < images.length; i += 1) {
      const extension = SUPPORTED_IMAGE_MIME[images[i].mimeType]
      if (!extension) {
        problems.push(`「${product.name}」第 ${i + 1} 张图片格式 ${images[i].mimeType || '未知'} 不受支持(仅 jpg/png/webp)`)
        continue
      }
      if (images[i].size > PACKAGE_MAX_IMAGE_BYTES) {
        problems.push(`「${product.name}」第 ${i + 1} 张图片超过 ${Math.round(PACKAGE_MAX_IMAGE_BYTES / 1024 / 1024)}MB`)
        continue
      }
      try {
        const backup = await exportStoredFile(images[i])
        const bytes = base64ToBytes(backup.data)
        const path = `images/p${p}-${i}.${extension}`
        files[path] = bytes
        totalBytes += bytes.length
        manifest.products[p].images.push(path)
      } catch (error) {
        problems.push(`「${product.name}」第 ${i + 1} 张图片读取失败:${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
  }

  if (totalBytes > PACKAGE_MAX_TOTAL_BYTES) {
    problems.push(`图片总大小 ${Math.round(totalBytes / 1024 / 1024)}MB 超过包上限 ${Math.round(PACKAGE_MAX_TOTAL_BYTES / 1024 / 1024)}MB`)
  }
  if (problems.length) {
    throw new Error(problems.join(';'))
  }

  return { manifestText: JSON.stringify(manifest), files, totalBytes }
}

/** 打包为 zip 字节流(manifest.json + images/*;图片已是压缩格式,不再重复压缩) */
export async function buildAgentMallPackageZip(products: Product[]): Promise<Uint8Array> {
  const { manifestText, files } = await buildAgentMallPackage(products)
  return zipSync({ 'manifest.json': strToU8(manifestText), ...files }, { level: 0 })
}

function dateStamp() {
  const now = new Date()
  const pad = (value: number) => (value < 10 ? `0${value}` : String(value))
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
}

/** 导出素材包 zip 文件;走与备份/CSV 相同的导出通道(浏览器下载 / 原生分享) */
export async function exportAgentMallPackage(products: Product[]): Promise<void> {
  const zip = await buildAgentMallPackageZip(products)
  const blob = new Blob([zip as BlobPart], { type: 'application/zip' })
  await exportFileBlob(`agentmall-素材包-${dateStamp()}.zip`, blob, {
    shareTitle: '导出 AgentMall 素材包',
    shareText: '素材包含商品与图片,发送给店主端微信导入',
    dialogTitle: '导出素材包',
  })
}
