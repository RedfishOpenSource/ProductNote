/**
 * AgentMall 导出桥:把本应用商品导出为店主端「批量导入」CSV。
 * CSV 格式(与店主端一致):名称,分类,价格(元),库存,单位
 * 无显式分类时按关键词建议五分类，未知留空。
 * 注意：AgentMall 现有导入器尚不支持完整 CSV 引号/表头，且空数值会变零；不可直接整文件粘贴上线。
 */
import type { Product } from '../types/product'
import { exportFileBlob } from './file-service'

export const AGENTMALL_CATEGORIES = ['厨房设备', '餐具器皿', '制冷冰柜', '桌椅宴会', '办公家具'] as const

const CATEGORY_KEYWORDS: Array<[string, string[]]> = [
  [
    '厨房设备',
    ['蒸柜', '蒸饭', '大锅灶', '汤炉', '煮面', '炒灶', '灶', '保鲜台', '操作台', '货架', '水池', '排烟', '消毒', '和面', '绞肉', '饼铛', '蒸饭车', '炉'],
  ],
  [
    '制冷冰柜',
    ['冰柜', '冷柜', '冷冻', '冷藏', '岛柜', '展示柜', '点菜柜', '平冷', '冰箱'],
  ],
  [
    '餐具器皿',
    ['汤桶', '盆', '方盘', '保温桶', '碗', '圆盘', '快餐盘', '调料', '筷子', '餐具', '托盘', '餐盘'],
  ],
  [
    '桌椅宴会',
    ['圆桌', '折叠桌', '宴会', '火锅桌', '椅', '凳', '桌'],
  ],
  [
    '办公家具',
    ['办公', '班台', '文件柜', '会议', '电脑', '档案', '职员', '洽谈'],
  ],
]

/** 依据商品名关键词猜测 AgentMall 分类(未设置 category 时兜底) */
export function mapCategoryByName(name: string): string {
  // 先匹配用途/制冷特征，避免“办公桌/办公椅/冷藏操作台”被泛称截获。
  for (const preferred of ['办公家具', '制冷冰柜', '厨房设备', '餐具器皿', '桌椅宴会']) {
    const keywords = CATEGORY_KEYWORDS.find(([category]) => category === preferred)![1]
    if (keywords.some((keyword) => name.includes(keyword))) return preferred
  }
  return ''
}

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildAgentMallCsv(products: Product[]): string {
  const header = '名称,分类,价格(元),库存,单位'
  const lines = products.map((product) => {
    const category = product.category?.trim() || mapCategoryByName(product.name)
    const cells = [
      product.name,
      category,
      product.price === null || product.price === undefined ? '' : String(product.price),
      product.quantity === null || product.quantity === undefined ? '' : String(product.quantity),
      product.unit?.trim() || '个',
    ]
    return cells.map(csvCell).join(',')
  })
  // BOM 让 Excel 正确识别中文;店主端导入也兼容
  return '\uFEFF' + [header, ...lines].join('\r\n')
}

export async function exportAgentMallCsv(products: Product[]): Promise<void> {
  const csv = buildAgentMallCsv(products)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const now = new Date()
  const pad = (value: number) => (value < 10 ? `0${value}` : String(value))
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  await exportFileBlob(`agentmall-商品-${stamp}.csv`, blob, {
    shareTitle: '导出 AgentMall 商品表',
    shareText: '商品 CSV 已生成,可导入店主端批量上架',
    dialogTitle: '导出 CSV',
  })
}
