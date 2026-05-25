export type ViewMode = 'card' | 'feed'
export type ProductModelSourceType = 'photos' | 'video'

export const VIDEO_FILE_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.3gp'] as const
export const MODEL_FILE_EXTENSIONS = ['.glb', '.gltf'] as const

export function hasVideoFileExtension(name: string): boolean {
  const lowerName = name.toLowerCase()
  return VIDEO_FILE_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
}

export function hasModelFileExtension(name: string): boolean {
  const lowerName = name.toLowerCase()
  return MODEL_FILE_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
}

export function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith('video/')
}

export function isModelMimeType(mimeType: string): boolean {
  return mimeType === 'model/gltf-binary' || mimeType === 'model/gltf+json'
}

export interface StoredFile {
  path: string
  name: string
  mimeType: string
  size: number
  kind: 'image' | 'attachment' | 'model'
}

export interface ProductModel3D {
  file: StoredFile
  sourceType: ProductModelSourceType
  generatedAt: string
  engineId: string
  sourceCount: number
}

export interface Product {
  id: string
  name: string
  price: number | null
  description: string
  supplierName: string
  supplierPhone: string
  image: StoredFile | null
  images: StoredFile[]
  attachments: StoredFile[]
  model3d: ProductModel3D | null
  createdAt: string
  updatedAt: string
}

export interface BackupFile extends StoredFile {
  data: string
}

export interface ProductModel3DBackup extends Omit<ProductModel3D, 'file'> {
  file: BackupFile
}

export function isVideoStoredFile(file: StoredFile): boolean {
  return isVideoMimeType(file.mimeType) || hasVideoFileExtension(file.name)
}

export function isModelStoredFile(file: StoredFile): boolean {
  return file.kind === 'model' || isModelMimeType(file.mimeType) || hasModelFileExtension(file.name)
}

export function normalizeProductImages(image: StoredFile | null | undefined, images: StoredFile[] | undefined): StoredFile[] {
  if (Array.isArray(images) && images.length > 0) {
    return images
  }

  return image ? [image] : []
}

export function getPrimaryProductImage(product: Pick<Product, 'image' | 'images'>): StoredFile | null {
  return product.images[0] ?? product.image ?? null
}

export interface ProductBackup extends Omit<Product, 'image' | 'images' | 'attachments' | 'model3d'> {
  image: BackupFile | null
  images: BackupFile[]
  attachments: BackupFile[]
  model3d: ProductModel3DBackup | null
}

export interface BackupPayload {
  version: 3
  exportedAt: string
  products: ProductBackup[]
}
