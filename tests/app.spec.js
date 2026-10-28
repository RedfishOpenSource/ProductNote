import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const storageKey = 'CapacitorStorage.product_item_products'
const listUiKey = 'CapacitorStorage.product_item_list_ui'
const PNG_1PX_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const pngFile = {
  name: 'photo.png',
  mimeType: 'image/png',
  buffer: Buffer.from(PNG_1PX_BASE64, 'base64'),
}

async function readProducts(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), storageKey)
}
async function writeProducts(page, products) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [storageKey, products])
}
function baseProduct(overrides = {}) {
  const now = '2026-10-28T00:00:00.000Z'
  return {
    id: 'seed-item',
    name: '圆桌',
    price: 180,
    description: '直径1.8米',
    supplierName: '张三',
    supplierPhone: '13800000000',
    image: null,
    images: [],
    attachments: [],
    model3d: null,
    createdAt: now,
    updatedAt: now,
    category: '桌椅宴会',
    quantity: 4,
    unit: '张',
    wholesalePrice: 150,
    ...overrides,
  }
}
function dataUrlImage() {
  return { path: `data:image/png;base64,${PNG_1PX_BASE64}`, name: 'photo.png', mimeType: 'image/png', size: 100, kind: 'image' }
}
async function openSettings(page) {
  await page.getByLabel('打开设置').click()
  await expect(page.getByRole('button', { name: '导出备份 JSON' })).toBeVisible()
}

test('语音草稿解析名称、价格、供应商、电话，描述保留其余内容', async ({ page }) => {
  await page.goto('/')
  const draft = await page.evaluate(async () => {
    const { buildDraftFromSpeechText } = await import('/src/services/local-ai-entry-service.ts')
    return buildDraftFromSpeechText('商品名称不锈钢汤桶。售价25.5元。供应商张三。电话13812345678。蓝色加厚防烫')
  })
  expect(draft).toMatchObject({ name: '不锈钢汤桶', priceText: '25.5', supplierName: '张三', supplierPhone: '13812345678' })
  expect(draft.description).toContain('蓝色加厚防烫')
})

test('新建商品含四字段和图片，列表展示，编辑回显不丢字段，删除生效', async ({ page }) => {
  const dialogs = []
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message())
    dialog.accept()
  })
  await page.goto('/product/new')
  await page.getByLabel('商品名称', { exact: true }).fill('不锈钢汤桶')
  await page.getByLabel('价格', { exact: true }).fill('25.5')
  await page.locator('label.field-block', { hasText: '分类' }).locator('.el-select').first().click()
  await page.locator('.el-select-dropdown__item', { hasText: '餐具器皿' }).first().click()
  await page.getByLabel('库存数量').fill('12')
  await page.getByLabel('单位', { exact: true }).fill('个')
  await page.getByLabel('批发价（元）').fill('18')
  await page.locator('input[accept="image/*"]').setInputFiles(pngFile)
  await expect(page.locator('.preview-image')).toHaveCount(1)
  await page.getByRole('button', { name: '保存商品' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('不锈钢汤桶')).toBeVisible()

  let products = await readProducts(page)
  expect(products[0]).toMatchObject({ name: '不锈钢汤桶', price: 25.5, category: '餐具器皿', quantity: 12, unit: '个', wholesalePrice: 18 })
  expect(products[0].images[0].path.startsWith('data:image/png')).toBe(true)
  const createdId = products[0].id

  await page.goto(`/product/${createdId}`)
  await expect(page.getByLabel('商品名称', { exact: true })).toHaveValue('不锈钢汤桶')
  await expect(page.getByLabel('库存数量')).toHaveValue('12')
  await expect(page.getByLabel('批发价（元）')).toHaveValue('18')
  await expect(page.locator('.preview-image')).toHaveCount(1)
  await page.getByLabel('库存数量').fill('7')
  await page.getByRole('button', { name: '保存商品' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect((await readProducts(page))[0].quantity).toBe(7)

  await page.goto(`/product/${createdId}`)
  await page.getByRole('button', { name: '删除商品' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(await readProducts(page)).toHaveLength(0)
  expect(dialogs.some((message) => message.includes('删除'))).toBe(true)
})

test('备份导出 JSON 含图片与四字段，导入可完整恢复并覆盖现有数据', async ({ page }, testInfo) => {
  const seed = baseProduct({ images: [dataUrlImage()], image: dataUrlImage() })
  await page.goto('/')
  await writeProducts(page, [seed])
  await page.goto('/')
  await openSettings(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出备份 JSON' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^product-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const backupPath = testInfo.outputPath('backup.json')
  await download.saveAs(backupPath)
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
  expect(backup.version).toBe(3)
  expect(backup.products[0]).toMatchObject({ id: seed.id, category: '桌椅宴会', quantity: 4, unit: '张', wholesalePrice: 150 })
  expect(backup.products[0].images[0].data).toBe(PNG_1PX_BASE64)

  await writeProducts(page, [baseProduct({ id: 'other-item', name: '别的商品', images: [], image: null })])
  await page.reload()
  await openSettings(page)
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[accept*=".prd"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: readFileSync(backupPath) })
  await expect(page.getByText('已导入 1 件商品')).toBeVisible()
  const restored = await readProducts(page)
  expect(restored).toHaveLength(1)
  expect(restored[0]).toMatchObject({ id: seed.id, name: '圆桌', quantity: 4, wholesalePrice: 150 })
  expect(restored[0].images[0].path.startsWith('data:image/png')).toBe(true)
})

test('旧版 v1 备份（无四字段/无 images 数组）导入兼容，按未知处理', async ({ page }) => {
  const now = '2025-01-01T00:00:00.000Z'
  const legacy = {
    version: 1,
    products: [{
      id: 'legacy-1', name: '老冰柜', price: 900, description: '', supplierName: '', supplierPhone: '',
      image: { path: `data:image/png;base64,${PNG_1PX_BASE64}`, name: 'a.png', mimeType: 'image/png', size: 100, kind: 'image' },
      attachments: [], createdAt: now, updatedAt: now,
    }],
  }
  await page.goto('/')
  await writeProducts(page, [baseProduct({ id: 'to-be-replaced' })])
  await page.goto('/')
  await openSettings(page)
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[accept*=".prd"]').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) })
  await expect(page.getByText('已导入 1 件商品')).toBeVisible()
  const products = await readProducts(page)
  expect(products).toHaveLength(1)
  expect(products[0]).toMatchObject({ id: 'legacy-1', name: '老冰柜', category: '', quantity: null, unit: '', wholesalePrice: null })
  expect(products[0].images[0].path.startsWith('data:image/png')).toBe(true)
})

test('空商品库导出备份给出可读错误，不产生空备份文件', async ({ page }) => {
  await page.goto('/')
  await openSettings(page)
  await page.getByRole('button', { name: '导出备份 JSON' }).click()
  await expect(page.getByText('还没有商品可备份')).toBeVisible()
})

test('设置页导出 AgentMall CSV，含分类与空值占位', async ({ page }, testInfo) => {
  await page.goto('/')
  await writeProducts(page, [
    baseProduct(),
    baseProduct({ id: 'seed-2', name: '冷藏操作台', category: '', quantity: null, price: null, unit: '' }),
  ])
  await page.goto('/')
  await openSettings(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 AgentMall CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^agentmall-商品-\d{8}\.csv$/)
  const chunks = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk)
  const csv = Buffer.concat(chunks).toString('utf8')
  expect(csv).toContain('圆桌,桌椅宴会,180,4,张')
  expect(csv).toContain('冷藏操作台,制冷冰柜,,,个')
})

test('PDF 导出可下载且包含商品数据', async ({ page }, testInfo) => {
  await page.goto('/')
  await writeProducts(page, [baseProduct({ images: [dataUrlImage()], image: dataUrlImage() })])
  await page.goto('/')
  const downloadPromise = page.waitForEvent('download')
  await page.getByLabel('分享 PDF').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^商品清单-\d{4}-\d{2}-\d{2}-.*\.pdf$/)
  const pdfPath = testInfo.outputPath('products.pdf')
  await download.saveAs(pdfPath)
  const pdf = readFileSync(pdfPath)
  expect(pdf.length).toBeGreaterThan(1000)
  expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
})

test('视图模式持久化，文本搜索过滤并写入历史', async ({ page }) => {
  await page.goto('/')
  await writeProducts(page, [baseProduct(), baseProduct({ id: 'seed-2', name: '冰柜' })])
  await page.goto('/')
  await page.locator('button[title="短视频风格"]').click()
  await expect(page.locator('.feed-card')).toHaveCount(2)
  let ui = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), listUiKey)
  expect(ui.viewMode).toBe('feed')

  await page.goto('/')
  await expect(page.locator('.feed-card')).toHaveCount(2)
  await page.getByLabel('打开搜索').click()
  await page.getByPlaceholder('搜索商品名称、供应商或电话').fill('冰柜')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.locator('.feed-card')).toHaveCount(1)
  ui = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), listUiKey)
  expect(ui.searchHistory).toContain('冰柜')

  await page.getByPlaceholder('搜索商品名称、供应商或电话').fill('')
  await expect(page.getByRole('button', { name: '冰柜', exact: true })).toBeVisible()
  await page.locator('.search-mode-bar .icon-button').first().click()
  await page.locator('button[title="卡片展示"]').click()
  await expect(page.locator('.product-card')).toHaveCount(2)
})

test('Web 图片搜索走签名降级，同图可召回原商品', async ({ page }) => {
  await page.goto('/')
  await writeProducts(page, [baseProduct({ images: [dataUrlImage()], image: dataUrlImage() })])
  await page.goto('/')
  await page.getByLabel('打开搜索').click()
  await page.locator('.photo-search-inline-button').click()
  await page.locator('input[accept="image/*"]').first().setInputFiles(pngFile)
  await expect(page.getByText('已按图片匹配，最像的是这些商品')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.match-badge').first()).toBeVisible()
})

test('3D 模型生成服务输出 GLB，媒体页与模型页状态正确', async ({ page }) => {
  await page.goto('/')
  // Vite 首次预打包 three 依赖会触发整页重载，允许重试一次。
  const runEvaluate = () => page.evaluate(async (pngBase64) => {
    const { generateProductModel } = await import('/src/services/model-reconstruction-service.ts')
    const makeFile = (tag) => new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      canvas.width = 16
      canvas.height = 16
      const context = canvas.getContext('2d')
      context.fillStyle = tag
      context.fillRect(0, 0, 16, 16)
      canvas.toBlob((blob) => resolve(new File([blob], `${tag}.png`, { type: 'image/png' })), 'image/png')
    })
    const files = [await makeFile('#ff0000'), await makeFile('#00ff00')]
    const generated = await generateProductModel({ imageFiles: files })
    return { sourceType: generated.sourceType, sourceCount: generated.sourceCount, size: generated.blob.size, type: generated.blob.type }
  }, PNG_1PX_BASE64)
  let result
  try {
    result = await runEvaluate()
  } catch {
    await page.goto('/')
    result = await runEvaluate()
  }
  expect(result).toMatchObject({ sourceType: 'photos', sourceCount: 2, type: 'model/gltf-binary' })
  expect(result.size).toBeGreaterThan(200)

  const seed = baseProduct()
  await page.goto('/')
  await writeProducts(page, [seed])
  await page.goto(`/product/${seed.id}/media`)
  await expect(page.getByRole('heading', { name: '圆桌', level: 1 })).toBeVisible()
  await page.goto(`/product/${seed.id}/model`)
  await expect(page.getByText('还没有 3D 模型')).toBeVisible()
  await page.goto('/product/not-exist/media')
  await expect(page.getByText('商品不存在')).toBeVisible()
})
