export function formatPrice(price: number | null): string {
  if (price === null || Number.isNaN(price)) return '未填写价格'
  return `¥ ${price.toFixed(2)}`
}
