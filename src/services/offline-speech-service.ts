import { Capacitor, registerPlugin } from '@capacitor/core'

interface OfflineSpeechResult {
  text: string
  alternatives: string[]
}

interface OfflineSpeechOptions {
  prompt?: string
  language?: string
  preferOffline?: boolean
}

interface OfflineSpeechPlugin {
  isAvailable(): Promise<{ available: boolean }>
  recognize(options?: OfflineSpeechOptions): Promise<OfflineSpeechResult>
}

const offlineSpeechPluginName = 'OfflineSpeech'
const defaultRecognitionPrompt = '请说出商品信息'
const defaultRecognitionLanguage = 'zh-CN'
const offlineFallbackMessages = ['设备未安装中文离线语音包', '离线语音识别不可用']
const OfflineSpeech = registerPlugin<OfflineSpeechPlugin>(offlineSpeechPluginName)

export function isOfflineSpeechSupported(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable(offlineSpeechPluginName)
}

function shouldRetryWithOnlineRecognition(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return offlineFallbackMessages.some((message) => error.message.includes(message))
}

function recognizeWithPreference(prompt: string, preferOffline: boolean): Promise<OfflineSpeechResult> {
  return OfflineSpeech.recognize({
    prompt,
    language: defaultRecognitionLanguage,
    preferOffline,
  })
}

export async function startOfflineSpeechRecognition(prompt = defaultRecognitionPrompt): Promise<OfflineSpeechResult> {
  if (!isOfflineSpeechSupported()) {
    throw new Error('当前设备不支持离线语音录入')
  }

  const { available } = await OfflineSpeech.isAvailable()
  if (!available) {
    throw new Error('当前设备未启用系统语音识别服务')
  }

  try {
    return await recognizeWithPreference(prompt, true)
  } catch (error) {
    if (!shouldRetryWithOnlineRecognition(error)) {
      throw error
    }

    return recognizeWithPreference(prompt, false)
  }
}
