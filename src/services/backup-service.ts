import { normalizeProductImages } from '../types/product'
import type { BackupFile, BackupPayload, Product, ProductBackup } from '../types/product'
import { exportBackupText, exportStoredFile, restoreBackupFile } from './file-service'
import { replaceAllProducts } from './product-store'

type LegacyProductBackup = Omit<ProductBackup, 'images' | 'model3d'> & {
  images?: BackupFile[]
  model3d?: ProductBackup['model3d']
}

type ParsedBackupPayload = {
  version?: number
  products?: Array<ProductBackup | LegacyProductBackup>
}

async function restoreModel3d(model3d: ProductBackup['model3d'] | null): Promise<Product['model3d']> {
  if (!model3d) {
    return null
  }

  return {
    ...model3d,
    file: await restoreBackupFile(model3d.file),
  }
}

export async function importProducts(content: string): Promise<number> {
  const parsed = JSON.parse(content) as ParsedBackupPayload

  if ((parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) || !Array.isArray(parsed.products)) {
    throw new Error('备份文件格式不正确')
  }

  const importedProducts: Product[] = []

  for (const product of parsed.products) {
    const model3d = await restoreModel3d('model3d' in product ? product.model3d ?? null : null)
    const image = product.image ? await restoreBackupFile(product.image) : null
    const images =
      'images' in product && Array.isArray(product.images)
        ? await Promise.all(product.images.map((file) => restoreBackupFile(file)))
        : normalizeProductImages(image, undefined)

    importedProducts.push({
      ...product,
      image: image ?? images[0] ?? null,
      images,
      attachments: await Promise.all(product.attachments.map((file) => restoreBackupFile(file))),
      model3d,
    })
  }

  await replaceAllProducts(importedProducts)
  return importedProducts.length
}

/** 导出前把每个 StoredFile 展开为内嵌 base64 的 BackupFile；失败时中止而不是生成残缺备份。 */
async function toBackupProduct(product: Product): Promise<ProductBackup> {
  const [image, images, attachments, model3d] = await Promise.all([
    product.image ? exportStoredFile(product.image) : Promise.resolve(null),
    Promise.all(product.images.map((file) => exportStoredFile(file))),
    Promise.all(product.attachments.map((file) => exportStoredFile(file))),
    product.model3d
      ? exportStoredFile(product.model3d.file).then((file) => ({ ...product.model3d!, file }))
      : Promise.resolve(null),
  ])

  return {
    ...product,
    image,
    images,
    attachments,
    model3d,
  }
}

export async function buildBackupPayload(products: Product[]): Promise<BackupPayload> {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    products: await Promise.all(products.map((product) => toBackupProduct(product))),
  }
}

export async function exportBackup(products: Product[]): Promise<string> {
  if (!products.length) {
    throw new Error('还没有商品可备份')
  }

  const payload = await buildBackupPayload(products)
  const dateStamp = new Date().toISOString().slice(0, 10)
  return await exportBackupText(`product-backup-${dateStamp}.json`, JSON.stringify(payload), {
    mimeType: 'application/json',
    shareTitle: '商品备份',
    shareText: '商品备份文件已生成，请妥善保存',
    dialogTitle: '导出商品备份',
  })
}
