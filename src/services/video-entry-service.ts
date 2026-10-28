/**
 * 视频批量录入·抽帧服务(纯离线):
 * 输入一个逛店视频 → 按 N 秒间隔抽帧 → dHash 去重(画面变化大的帧=新商品候选)
 * → 输出候选帧列表(JPEG dataUrl 即商品首图)。
 * 支持环境:Web / 安卓 WebView(HTML5 video + canvas,本地文件经 blob/dataUrl URL 传入)。
 */
import { computeDHashFromCanvas, hammingDistanceHex } from './frame-dedup'

export interface ExtractedFrame {
  /** 视频内时间点(秒,保留 1 位小数) */
  timestampSeconds: number
  /** 帧 JPEG dataUrl(即商品首图) */
  dataUrl: string
  width: number
  height: number
  hashHex: string
}

export interface ExtractionOptions {
  /** 抽帧间隔秒数,默认 2 */
  intervalSeconds?: number
  /** 判定为"新画面"的最小汉明距离(0~64),默认 10 */
  minDistanceBits?: number
  /** 最多保留候选帧数,默认 60 */
  maxFrames?: number
  /** 抽帧画布宽度(高度按视频比例),默认 720 */
  captureWidth?: number
  /** 进度回调(已保留帧数, 已扫描秒, 总时长秒) */
  onProgress?: (keptFrames: number, scannedSeconds: number, totalSeconds: number) => void
}

export async function extractCandidateFrames(
  videoUrl: string,
  options: ExtractionOptions = {},
): Promise<ExtractedFrame[]> {
  const interval = Math.max(0.5, options.intervalSeconds ?? 2)
  const minDistance = Math.min(64, Math.max(0, options.minDistanceBits ?? 10))
  const maxFrames = Math.max(1, options.maxFrames ?? 60)
  const captureWidth = Math.max(320, options.captureWidth ?? 720)

  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.src = videoUrl

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () =>
      reject(new Error('视频加载失败。建议用 mp4 格式;相册视频可先转发/另存后再选'))
  })

  const duration = Number.isFinite(video.duration) ? video.duration : 0
  if (duration <= 0) {
    throw new Error('无法读取视频时长,请换一个文件')
  }

  const ratio =
    video.videoWidth > 0 && video.videoHeight > 0 ? video.videoHeight / video.videoWidth : 0.75
  const canvas = document.createElement('canvas')
  canvas.width = captureWidth
  canvas.height = Math.max(2, Math.round(captureWidth * ratio))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('当前环境不支持视频抽帧')
  }

  const frames: ExtractedFrame[] = []
  let lastHash: string | null = null
  const totalSeconds = Math.round(duration)

  for (let t = 0; t < duration && frames.length < maxFrames; t += interval) {
    await seekTo(video, Math.min(t, Math.max(0, duration - 0.05)))
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const hashHex = computeDHashFromCanvas(canvas)
    const distance = lastHash === null ? 64 : hammingDistanceHex(lastHash, hashHex)

    if (distance >= minDistance || frames.length === 0) {
      frames.push({
        timestampSeconds: Math.round(t * 10) / 10,
        dataUrl: canvas.toDataURL('image/jpeg', 0.82),
        width: canvas.width,
        height: canvas.height,
        hashHex,
      })
      lastHash = hashHex
    }
    options.onProgress?.(frames.length, Math.round(t), totalSeconds)
  }

  video.removeAttribute('src')
  video.load()
  return frames
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      window.clearTimeout(timer)
    }
    const onSeeked = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }, 5000)

    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

/** 由视觉标签生成名称建议(取置信度前 3 个标签拼接) */
export function suggestNameFromLabels(labels: string[]): string {
  const cleaned = labels
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 3)
  return cleaned.join(' ')
}
