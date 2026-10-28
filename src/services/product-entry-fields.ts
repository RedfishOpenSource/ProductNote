/** 商品表单与视频草稿共用的数值校验；空值代表未知，不转换为零。 */
export function parseOptionalPrice(text: string, label = '价格'): number | null {
  const value = text.trim()
  if (!value) return null
  const number = Number(value)
  if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER / 100) {
    throw new Error(`${label}须为非负数字，最多两位小数`)
  }
  return number
}

export function parseOptionalQuantity(text: string): number | null {
  const value = text.trim()
  if (!value) return null
  const number = Number(value)
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number)) {
    throw new Error('库存须为非负整数，不会自动取整')
  }
  return number
}
