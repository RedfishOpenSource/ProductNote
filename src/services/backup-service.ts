import type { BackupPayload, Product, ProductBackup } from '../types/product'
import { exportBackupText, exportStoredFile, restoreBackupFile } from './file-service'
import { replaceAllProducts } from './product-store'

type LegacyProductBackup = Omit<ProductBackup, 'model3d'>

type ParsedBackupPayload = {
  version?: number
  products?: Array<ProductBackup | LegacyProductBackup>
}

function buildExportFileName(): string {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10)
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '-')
  return `商品备份-${datePart}-${timePart}.json`
}

async function exportModel3d(model3d: Product['model3d']): Promise<ProductBackup['model3d']> {
  if (!model3d) {
    return null
  }

  return {
    ...model3d,
    file: await exportStoredFile(model3d.file),
  }
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

export async function exportProducts(products: Product[]): Promise<string> {
  const backupProducts: ProductBackup[] = []

  for (const product of products) {
    backupProducts.push({
      ...product,
      image: product.image ? await exportStoredFile(product.image) : null,
      attachments: await Promise.all(product.attachments.map((file) => exportStoredFile(file))),
      model3d: await exportModel3d(product.model3d),
    })
  }

  const payload: BackupPayload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    products: backupProducts,
  }

  const content = JSON.stringify(payload, null, 2)
  return exportBackupText(buildExportFileName(), content)
}

export async function importProducts(content: string): Promise<number> {
  const parsed = JSON.parse(content) as ParsedBackupPayload

  if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.products)) {
    throw new Error('备份文件格式不正确')
  }

  const importedProducts: Product[] = []

  for (const product of parsed.products) {
    const model3d = await restoreModel3d('model3d' in product ? product.model3d : null)

    importedProducts.push({
      ...product,
      image: product.image ? await restoreBackupFile(product.image) : null,
      attachments: await Promise.all(product.attachments.map((file) => restoreBackupFile(file))),
      model3d,
    })
  }

  await replaceAllProducts(importedProducts)
  return importedProducts.length
}
