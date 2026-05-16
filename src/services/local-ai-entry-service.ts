import type { ProductCreateDraft } from './product-create-draft'

const phonePattern = /1[3-9]\d{9}/
const pricePatterns = [
  /(?:售价|价格|卖价|卖|单价)\s*(\d+(?:\.\d{1,2})?)/,
  /(\d+(?:\.\d{1,2})?)\s*(?:元|块)/,
]

function cleanupValue(value: string): string {
  return value.replace(/[，。,；;：:]/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractAfterKeyword(text: string, keywords: string[]): string {
  for (const keyword of keywords) {
    const index = text.indexOf(keyword)
    if (index === -1) continue
    const value = cleanupValue(text.slice(index + keyword.length))
      .replace(/^(是|叫|为)/, '')
      .trim()
    if (value) {
      return value
    }
  }

  return ''
}

function extractPrice(text: string): string {
  for (const pattern of pricePatterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return ''
}

function splitClauses(text: string): string[] {
  return text
    .split(/[。！？!?；;，,\n]/)
    .map((item) => cleanupValue(item))
    .filter(Boolean)
}

export function buildDraftFromSpeechText(text: string): ProductCreateDraft {
  const normalized = cleanupValue(text)
  const clauses = splitClauses(text)

  const phone = normalized.match(phonePattern)?.[0] ?? ''
  const priceText = extractPrice(normalized)

  let supplierName = extractAfterKeyword(normalized, ['供应商', '供货商', '厂家', '店家'])
  let name = extractAfterKeyword(normalized, ['商品名称', '商品', '名字', '名称'])

  if (!name && clauses.length > 0) {
    const firstClause = clauses[0]
    if (!phonePattern.test(firstClause) && !extractPrice(firstClause)) {
      name = firstClause.slice(0, 24)
    }
  }

  if (!supplierName) {
    const supplierClause = clauses.find((clause) => /供应商|供货商|厂家|店家/.test(clause))
    if (supplierClause) {
      supplierName = supplierClause.replace(/.*(?:供应商|供货商|厂家|店家)/, '').trim()
    }
  }

  const descriptionClauses = clauses.filter((clause) => {
    if (name && clause.includes(name)) return false
    if (supplierName && clause.includes(supplierName)) return false
    if (phone && clause.includes(phone)) return false
    if (priceText && clause.includes(priceText)) return false
    return true
  })

  const description = (descriptionClauses.join('，') || normalized).slice(0, 200)

  return {
    name,
    priceText,
    description,
    supplierName,
    supplierPhone: phone,
  }
}
