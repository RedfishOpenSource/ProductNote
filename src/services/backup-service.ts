import type { BackupPayload, Product, ProductBackup } from '../types/product'
import { exportStoredFile, exportBackupText, restoreBackupFile } from './file-service'
import { replaceAllProducts } from './product-store'

function buildExportFileName() {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10)
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '-')
  return `商品备份-${datePart}-${timePart}.json`
}

export async function exportProducts(products: Product[]) {
  const backupProducts: ProductBackup[] = []

  for (const product of products) {
    backupProducts.push({
      ...product,
      image: product.image ? await exportStoredFile(product.image) : null,
      attachments: await Promise.all(product.attachments.map((file) => exportStoredFile(file))),
    })
  }

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    products: backupProducts,
  }

  const content = JSON.stringify(payload, null, 2)
  return await exportBackupText(buildExportFileName(), content)
}

export async function importProducts(content: string) {
  const parsed = JSON.parse(content) as Partial<BackupPayload>

  if (parsed.version !== 1 || !Array.isArray(parsed.products)) {
    throw new Error('备份文件格式不正确')
  }

  const importedProducts: Product[] = []

  for (const product of parsed.products as ProductBackup[]) {
    importedProducts.push({
      ...product,
      image: product.image ? await restoreBackupFile(product.image) : null,
      attachments: await Promise.all(product.attachments.map((file) => restoreBackupFile(file))),
    })
  }

  await replaceAllProducts(importedProducts)
  return importedProducts.length
}
