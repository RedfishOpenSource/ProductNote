import { Capacitor, registerPlugin } from '@capacitor/core'

interface OfflineSpeechResult {
  text: string
  alternatives: string[]
}

interface OfflineSpeechPlugin {
  isAvailable(): Promise<{ available: boolean }>
  recognize(options?: { prompt?: string; language?: string }): Promise<OfflineSpeechResult>
}

const offlineSpeechPluginName = 'OfflineSpeech'
const defaultRecognitionPrompt = '请说出商品信息'
const defaultRecognitionLanguage = 'zh-CN'
const OfflineSpeech = registerPlugin<OfflineSpeechPlugin>(offlineSpeechPluginName)

export function isOfflineSpeechSupported(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable(offlineSpeechPluginName)
}

export async function startOfflineSpeechRecognition(prompt = defaultRecognitionPrompt): Promise<OfflineSpeechResult> {
  if (!isOfflineSpeechSupported()) {
    throw new Error('当前设备不支持离线语音录入')
  }

  const availability = await OfflineSpeech.isAvailable()
  if (!availability.available) {
    throw new Error('当前设备未启用系统语音识别服务')
  }

  return OfflineSpeech.recognize({ prompt, language: defaultRecognitionLanguage })
}
