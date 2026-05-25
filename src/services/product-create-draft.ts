import type { StoredFile } from '../types/product'

export interface ProductCreateDraft {
  name?: string
  priceText?: string
  description?: string
  supplierName?: string
  supplierPhone?: string
  image?: StoredFile | null
  images?: StoredFile[]
  attachments?: StoredFile[]
}

let pendingDraft: ProductCreateDraft | null = null

function copyDraft(draft: ProductCreateDraft): ProductCreateDraft {
  const images = draft.images ?? (draft.image ? [draft.image] : [])
  return {
    ...draft,
    image: draft.image ?? images[0] ?? null,
    images: [...images],
    attachments: [...(draft.attachments ?? [])],
  }
}

export function setPendingProductCreateDraft(draft: ProductCreateDraft | null): void {
  pendingDraft = draft ? copyDraft(draft) : null
}

export function consumePendingProductCreateDraft(): ProductCreateDraft | null {
  const draft = pendingDraft
  pendingDraft = null
  return draft ? copyDraft(draft) : null
}

export function clearPendingProductCreateDraft(): void {
  pendingDraft = null
}
