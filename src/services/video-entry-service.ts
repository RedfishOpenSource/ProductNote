/** 离线抽帧只生成待人工确认的画面，不等于商品检测。 */
import { computeDHashFromCanvas, hammingDistanceHex } from './frame-dedup'

export interface ExtractedFrame {
  timestampSeconds: number
  dataUrl: string
  width: number
  height: number
  hashHex: string
}

export interface ExtractionOptions {
  intervalSeconds?: number
  minDistanceBits?: number
  maxFrames?: number
  /** 最长边像素数（保留原字段名），默认 720，最高 1280。 */
  captureWidth?: number
  signal?: AbortSignal
  /** 每次加载/定位的超时毫秒数；可供回归测试缩短等待。 */
  timeoutMs?: number
  onProgress?: (keptFrames: number, scannedSeconds: number, totalSeconds: number) => void
}

function bounded(value: number | undefined, fallback: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value!)) : fallback
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('已取消抽帧', 'AbortError')
}

/** 必须等解码画面就绪；超时不得被当作定位成功。 */
function waitForVideo(
  video: HTMLVideoElement,
  ready: () => boolean,
  events: string[],
  signal: AbortSignal | undefined,
  timeoutMs: number,
  action?: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      events.forEach((event) => video.removeEventListener(event, onReady))
      video.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
    }
    const fail = (error: unknown) => { cleanup(); reject(error) }
    const onReady = () => { if (ready()) { cleanup(); resolve() } }
    const onError = () => fail(new Error('视频加载或解码失败，请换用浏览器支持的 MP4/H.264 视频'))
    const onAbort = () => fail(new DOMException('已取消抽帧', 'AbortError'))
    const timer = setTimeout(() => fail(new Error('视频加载/定位超时，请重试或分段录制')), timeoutMs)
    events.forEach((event) => video.addEventListener(event, onReady))
    video.addEventListener('error', onError)
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      checkAborted(signal)
      action?.()
      if (video.error) onError()
      else onReady()
    } catch (error) { fail(error) }
  })
}

export async function extractCandidateFrames(
  videoUrl: string,
  options: ExtractionOptions = {},
): Promise<ExtractedFrame[]> {
  checkAborted(options.signal)
  const interval = bounded(options.intervalSeconds, 2, 0.5, 60)
  const minDistance = bounded(options.minDistanceBits, 10, 0, 64)
  const maxFrames = Math.floor(bounded(options.maxFrames, 60, 1, 120))
  const longestEdge = bounded(options.captureWidth, 720, 160, 1280)
  const timeout = bounded(options.timeoutMs, 15000, 10, 60000)
  const video = document.createElement('video')
  const canvas = document.createElement('canvas')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true

  try {
    await waitForVideo(video, () => video.readyState >= 1, ['loadedmetadata'], options.signal, timeout, () => {
      video.src = videoUrl
      video.load()
    })
    const duration = video.duration
    if (!Number.isFinite(duration) || duration <= 0 || !video.videoWidth || !video.videoHeight) {
      throw new Error('无法读取视频时长或尺寸，请换一个文件')
    }
    if (Math.ceil(duration / interval) > 1800) {
      throw new Error('视频采样点超过 1800，请增大间隔或分段录制')
    }
    const scale = Math.min(1, longestEdge / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('当前环境不支持视频抽帧')

    const frames: ExtractedFrame[] = []
    let lastHash: string | null = null
    let encodedSize = 0
    options.onProgress?.(0, 0, duration)
    for (let t = 0; t < duration && frames.length < maxFrames; t += interval) {
      checkAborted(options.signal)
      const target = Math.min(t, Math.max(0, duration - 0.05))
      const isReady = () => !video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - target) < 0.05
      await waitForVideo(video, isReady, ['seeked', 'loadeddata', 'canplay'], options.signal, timeout, () => {
        if (Math.abs(video.currentTime - target) >= 0.001) video.currentTime = target
      })
      checkAborted(options.signal)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const hashHex = computeDHashFromCanvas(canvas)
      if (lastHash === null || hammingDistanceHex(lastHash, hashHex) >= minDistance) {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
        encodedSize += dataUrl.length
        if (encodedSize > 24 * 1024 * 1024) throw new Error('候选图片占用过大，请缩短视频或降低抽帧数量')
        frames.push({ timestampSeconds: Math.round(target * 10) / 10, dataUrl, width: canvas.width, height: canvas.height, hashHex })
        lastHash = hashHex
      }
      options.onProgress?.(frames.length, Math.min(duration, t + interval), duration)
    }
    return frames
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    canvas.width = 0
    canvas.height = 0
  }
}

/** 仅拼接已有标签作为建议，不能凭空识别或承诺准确率。 */
export function suggestNameFromLabels(labels: string[]): string {
  return [...new Set(labels.map((label) => label.trim()).filter(Boolean))].slice(0, 3).join(' ')
}
