export interface VisualLabel {
  text: string
  confidence: number
}

export interface ProductVisualIndex {
  productId: string
  imagePath: string
  labels: VisualLabel[]
  modelId: string
  indexedAt: string
}

export interface VisualModelInfo {
  modelId: string
  maxResults: number
}

export interface VisualSearchResult {
  productId: string
  score: number
  matchLevel: '最像' | '较像' | '相关'
}
