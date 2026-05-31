import { normalizeProductImages } from '../types/product'
import type { BackupFile, Product, ProductBackup } from '../types/product'
import { restoreBackupFile } from './file-service'
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
