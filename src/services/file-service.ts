import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { FileOpener } from '@capacitor-community/file-opener'
import type { BackupFile, StoredFile } from '../types/product'
import { createId } from './id'

const isNativePlatform = Capacitor.getPlatform() !== 'web'

function normalizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-一-龥]/g, '-').replace(/-+/g, '-')
}

function getExtensionFromMimeType(mimeType: string) {
  if (!mimeType) return 'dat'
  const mapping: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
  }
  return mapping[mimeType] ?? mimeType.split('/').pop() ?? 'dat'
}

function stripDataPrefix(content: string) {
  return content.includes(',') ? content.split(',')[1] : content
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function fileToText(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

async function saveBase64File(base64Data: string, originalName: string, mimeType: string, kind: StoredFile['kind']) {
  const safeName = normalizeFileName(originalName || `${kind}.${getExtensionFromMimeType(mimeType)}`)
  const fileName = `${kind}/${createId(kind)}-${safeName}`

  if (isNativePlatform) {
    await Filesystem.writeFile({
      path: fileName,
      data: stripDataPrefix(base64Data),
      directory: Directory.Data,
      recursive: true,
    })

    return {
      path: fileName,
      name: originalName || safeName,
      mimeType,
      size: base64Data.length,
      kind,
    } satisfies StoredFile
  }

  return {
    path: base64Data,
    name: originalName || safeName,
    mimeType,
    size: base64Data.length,
    kind,
  } satisfies StoredFile
}

export async function saveFile(file: File, kind: StoredFile['kind']) {
  const dataUrl = await blobToDataUrl(file)
  return await saveBase64File(dataUrl, file.name, file.type || 'application/octet-stream', kind)
}

export async function savePhotoBlob(blob: Blob, mimeType = 'image/jpeg') {
  const dataUrl = await blobToDataUrl(blob)
  return await saveBase64File(dataUrl, `photo.${getExtensionFromMimeType(mimeType)}`, mimeType, 'image')
}

export async function getStoredFileUri(file: StoredFile | null) {
  if (!file) return ''
  if (!isNativePlatform || file.path.startsWith('data:')) return file.path

  const result = await Filesystem.getUri({
    path: file.path,
    directory: Directory.Data,
  })

  return result.uri
}

export async function resolveFileUrl(file: StoredFile | null) {
  if (!file) return ''
  if (!isNativePlatform || file.path.startsWith('data:')) return file.path

  const uri = await getStoredFileUri(file)
  return Capacitor.convertFileSrc(uri)
}

export async function deleteStoredFile(file: StoredFile | null) {
  if (!file || !isNativePlatform || file.path.startsWith('data:')) return

  try {
    await Filesystem.deleteFile({
      path: file.path,
      directory: Directory.Data,
    })
  } catch {
    return
  }
}

export async function openStoredFile(file: StoredFile) {
  if (!isNativePlatform || file.path.startsWith('data:')) {
    window.open(file.path, '_blank')
    return
  }

  const result = await Filesystem.getUri({
    path: file.path,
    directory: Directory.Data,
  })

  await FileOpener.open({
    filePath: result.uri,
    contentType: file.mimeType,
    openWithDefault: true,
  })
}

export async function exportStoredFile(file: StoredFile) {
  if (!isNativePlatform || file.path.startsWith('data:')) {
    return {
      ...file,
      data: stripDataPrefix(file.path),
    } satisfies BackupFile
  }

  const result = await Filesystem.readFile({
    path: file.path,
    directory: Directory.Data,
  })

  return {
    ...file,
    data: String(result.data),
  } satisfies BackupFile
}

export async function restoreBackupFile(file: BackupFile) {
  const dataUrl = `data:${file.mimeType};base64,${file.data}`
  return await saveBase64File(dataUrl, file.name, file.mimeType, file.kind)
}

export async function exportBackupText(fileName: string, content: string) {
  if (isNativePlatform) {
    await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Documents,
      recursive: true,
      encoding: Encoding.UTF8,
    })

    const fileUri = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Documents,
    })

    await Share.share({
      title: '商品备份',
      text: '商品备份文件已生成',
      url: fileUri.uri,
      dialogTitle: '导出商品备份',
    })

    return fileUri.uri
  }

  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
  return fileName
}

export async function readImportFile(file: File) {
  return await fileToText(file)
}
