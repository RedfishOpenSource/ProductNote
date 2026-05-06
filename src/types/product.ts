export type ViewMode = 'card' | 'list'

export interface StoredFile {
  path: string
  name: string
  mimeType: string
  size: number
  kind: 'image' | 'attachment'
}

export interface Product {
  id: string
  name: string
  price: number | null
  description: string
  supplierName: string
  supplierPhone: string
  image: StoredFile | null
  attachments: StoredFile[]
  createdAt: string
  updatedAt: string
}

export interface BackupFile extends StoredFile {
  data: string
}

export interface ProductBackup extends Omit<Product, 'image' | 'attachments'> {
  image: BackupFile | null
  attachments: BackupFile[]
}

export interface BackupPayload {
  version: 1
  exportedAt: string
  products: ProductBackup[]
}
