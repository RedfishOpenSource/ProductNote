import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SRGBColorSpace,
  Texture,
} from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { ProductModelSourceType } from '../types/product'

export interface ProductModelGenerationInput {
  imageFiles?: File[]
  imageUrls?: string[]
  videoFile?: File | null
  videoUrl?: string | null
}

export interface ProductModelGenerationResult {
  blob: Blob
  fileName: string
  sourceType: ProductModelSourceType
  sourceCount: number
  engineId: string
}

const modelEngineId = 'local-three-textured-box-v1'
const maxFaceCount = 6
const videoTextureCheckpoints = [0.05, 0.28, 0.5, 0.72, 0.9]

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`无法加载图片: ${src}`))
    image.src = src
  })
}

async function createTextureFromSource(src: string): Promise<Texture> {
  const image = await loadImage(src)
  const texture = new CanvasTexture(image)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

async function createFrameTexture(video: HTMLVideoElement): Promise<Texture> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, video.videoWidth)
  canvas.height = Math.max(1, video.videoHeight)
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('当前环境不支持视频取帧')
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const bitmap = await createImageBitmap(canvas)
  const texture = new CanvasTexture(bitmap)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function waitForEvent(target: HTMLMediaElement, eventName: 'loadedmetadata' | 'seeked'): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      target.removeEventListener(eventName, handler)
      resolve()
    }
    target.addEventListener(eventName, handler)
  })
}

async function loadVideo(src: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.src = src
  await waitForEvent(video, 'loadedmetadata')
  return video
}

async function extractVideoTextures(videoSource: File | string): Promise<Texture[]> {
  const sourceUrl = typeof videoSource === 'string' ? videoSource : URL.createObjectURL(videoSource)
  try {
    const video = await loadVideo(sourceUrl)
    const duration = Math.max(video.duration || 0, 0.1)
    const textures: Texture[] = []

    for (const checkpoint of videoTextureCheckpoints) {
      video.currentTime = Math.min(duration * checkpoint, Math.max(duration - 0.05, 0))
      await waitForEvent(video, 'seeked')
      textures.push(await createFrameTexture(video))
    }

    return textures
  } finally {
    if (typeof videoSource !== 'string') {
      URL.revokeObjectURL(sourceUrl)
    }
  }
}

async function loadImageTextures(imageSources: Array<File | string>): Promise<Texture[]> {
  const urls = imageSources.map((source) => (typeof source === 'string' ? source : URL.createObjectURL(source)))

  try {
    return await Promise.all(urls.slice(0, maxFaceCount).map((url) => createTextureFromSource(url)))
  } finally {
    imageSources.forEach((source, index) => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(urls[index])
      }
    })
  }
}

function fillTextureSlots(textures: Texture[]): Texture[] {
  if (textures.length === 0) {
    throw new Error('至少需要一张图片或一个视频')
  }

  return Array.from({ length: maxFaceCount }, (_, index) => textures[index % textures.length])
}

function buildGeometrySize(texture: Texture) {
  const image = texture.image as { width?: number; height?: number }
  const width = Math.max(1, image.width ?? 1)
  const height = Math.max(1, image.height ?? 1)
  const aspectRatio = width / height
  const normalizedWidth = aspectRatio >= 1 ? 1.2 : 1.2 * aspectRatio
  const normalizedHeight = aspectRatio >= 1 ? 1.2 / aspectRatio : 1.2

  return {
    width: Math.max(0.7, normalizedWidth),
    height: Math.max(0.7, normalizedHeight),
    depth: 0.22,
  }
}

function exportSceneToGlb(scene: Scene): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter()

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result: unknown) => {
        if (result instanceof ArrayBuffer) {
          resolve(result)
          return
        }

        reject(new Error('GLB 导出失败'))
      },
      (error: unknown) => reject(error instanceof Error ? error : new Error('GLB 导出失败')),
      {
        binary: true,
        onlyVisible: true,
      },
    )
  })
}

export async function generateProductModel(input: ProductModelGenerationInput): Promise<ProductModelGenerationResult> {
  const imageSources = [...(input.imageFiles ?? []), ...(input.imageUrls ?? [])]
  const hasVideoSource = Boolean(input.videoFile || input.videoUrl)
  const sourceType: ProductModelSourceType = hasVideoSource ? 'video' : 'photos'

  const textures = hasVideoSource
    ? await extractVideoTextures(input.videoFile ?? input.videoUrl ?? '')
    : await loadImageTextures(imageSources)

  const faceTextures = fillTextureSlots(textures)
  const geometrySize = buildGeometrySize(faceTextures[0])
  const scene = new Scene()
  scene.background = new Color('#f5f7fa')

  const mesh = new Mesh(
    new BoxGeometry(geometrySize.width, geometrySize.height, geometrySize.depth),
    faceTextures.map((texture) =>
      new MeshBasicMaterial({
        map: texture,
      }),
    ),
  )

  scene.add(mesh)

  const glb = await exportSceneToGlb(scene)

  return {
    blob: new Blob([glb], { type: 'model/gltf-binary' }),
    fileName: 'product-model.glb',
    sourceType,
    sourceCount: hasVideoSource ? textures.length : imageSources.length,
    engineId: modelEngineId,
  }
}
