import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.zly.productitem',
  appName: '商品管理',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
}

export default config
