export type ViewMode = 'card' | 'feed'

export const VIDEO_FILE_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.3gp'] as const

export function hasVideoFileExtension(name: string): boolean {
  const lowerName = name.toLowerCase()
  return VIDEO_FILE_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
}

export function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith('video/')
}

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

export function isVideoStoredFile(file: StoredFile): boolean {
  return isVideoMimeType(file.mimeType) || hasVideoFileExtension(file.name)
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
