import type { StoredFile } from '../types/product'

export interface ProductCreateDraft {
  name?: string
  priceText?: string
  description?: string
  supplierName?: string
  supplierPhone?: string
  image?: StoredFile | null
  attachments?: StoredFile[]
}

let pendingDraft: ProductCreateDraft | null = null

export function setPendingProductCreateDraft(draft: ProductCreateDraft | null): void {
  pendingDraft = draft ? { ...draft, attachments: [...(draft.attachments ?? [])] } : null
}

export function consumePendingProductCreateDraft(): ProductCreateDraft | null {
  const draft = pendingDraft
  pendingDraft = null
  return draft ? { ...draft, attachments: [...(draft.attachments ?? [])] } : null
}

export function clearPendingProductCreateDraft(): void {
  pendingDraft = null
}
