import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const storageKey = 'CapacitorStorage.product_item_products'
const fixture = fileURLToPath(new URL('./fixtures/shop-test.mp4', import.meta.url))
const PNG_1PX_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const pngFile = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1PX_BASE64, 'base64') }

async function readProducts(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), storageKey)
}
async function writeProducts(page, products) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [storageKey, products])
}
function baseProduct(overrides = {}) {
  const now = '2026-10-28T00:00:00.000Z'
  return {
    id: 'seed-item', name: '圆桌', price: 180.5, description: '', supplierName: '', supplierPhone: '',
    image: null, images: [], attachments: [], model3d: null, createdAt: now, updatedAt: now,
    category: '桌椅宴会', quantity: 4, unit: '张', wholesalePrice: 150, ...overrides,
  }
}
function dataUrlImage() {
  return { path: `data:image/png;base64,${PNG_1PX_BASE64}`, name: 'photo.png', mimeType: 'image/png', size: 100, kind: 'image' }
}

test('新增抽屉三个入口：手动与视频批量正确跳转', async ({ page }) => {
  await page.goto('/')
  await page.locator('.floating-add-button').click()
  const cards = page.locator('.create-entry-card')
  await expect(cards).toHaveCount(3)
  await cards.nth(1).click()
  await expect(page).toHaveURL(/product\/new/)
  await page.goBack()
  await page.locator('.floating-add-button').click()
  await cards.nth(2).click()
  await expect(page).toHaveURL(/video-entry/)
})

test('拍照新建：草稿带图进入表单，保存后商品可从列表和媒体页看到', async ({ page }) => {
  await page.goto('/')
  await page.locator('.floating-add-button').click()
  await page.locator('input[accept="image/*"][capture]').setInputFiles(pngFile)
  await expect(page).toHaveURL(/product\/new/)
  await expect(page.locator('.preview-image')).toHaveCount(1)
  await page.getByLabel('商品名称', { exact: true }).fill('拍照商品')
  await page.getByRole('button', { name: '保存商品' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('拍照商品')).toBeVisible()
  const products = await readProducts(page)
  expect(products[0].images[0].path.startsWith('data:image/png')).toBe(true)

  await page.goto(`/product/${products[0].id}/media`)
  await expect(page.locator('.media-header').getByText('1 张图片')).toBeVisible()
})

test('长按相机进入录像：封面图+视频附件草稿，保存后列表含视频徽标，媒体页可播', async ({ page }) => {
  await page.goto('/')
  await page.locator('.floating-add-button').click()
  const cameraCard = page.locator('.create-entry-card').first()
  await cameraCard.hover()
  const chooserPromise = page.waitForEvent('filechooser')
  await page.mouse.down()
  await page.waitForTimeout(550)
  await page.mouse.up()
  const chooser = await chooserPromise
  await chooser.setFiles(fixture)
  await expect(page).toHaveURL(/product\/new/)
  await expect(page.locator('.preview-image')).toHaveCount(1)
  await expect(page.locator('.video-preview-card')).toHaveCount(1)
  await page.getByLabel('商品名称', { exact: true }).fill('录像商品')
  await page.getByRole('button', { name: '保存商品' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.product-card', { hasText: '录像商品' }).locator('.meta-tag', { hasText: '含视频' })).toBeVisible()

  const products = await readProducts(page)
  const created = products.find((item) => item.name === '录像商品')
  expect(created.attachments).toHaveLength(1)
  expect(created.attachments[0].mimeType).toBe('video/mp4')

  await page.goto(`/product/${created.id}/media`)
  await expect(page.locator('.media-header').getByText('1 个视频 · 1 张图片')).toBeVisible()
  await expect(page.locator('.media-slide video')).toHaveCount(1)
  await expect(page.locator('.swipe-carousel-dot')).toHaveCount(2)
})

test('编辑页可添加并删除视频附件，保存后持久化一致', async ({ page }) => {
  const seed = baseProduct({ name: '附件测试' })
  await page.goto('/')
  await writeProducts(page, [seed])
  await page.goto(`/product/${seed.id}`)
  await page.locator('input[accept="video/*"]').first().setInputFiles(fixture)
  await expect(page.locator('.video-preview-card')).toHaveCount(1)
  await page.getByRole('button', { name: '保存商品' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect((await readProducts(page))[0].attachments).toHaveLength(1)

  await page.goto(`/product/${seed.id}`)
  await expect(page.locator('.video-preview-card')).toHaveCount(1)
  await page.locator('.video-preview-actions').getByRole('button', { name: '删除' }).click()
  await expect(page.locator('.video-preview-card')).toHaveCount(0)
  await page.getByRole('button', { name: '保存商品' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect((await readProducts(page))[0].attachments).toHaveLength(0)
})

test('价格显示：未填/零/小数三种状态在列表与媒体页一致', async ({ page }) => {
  await page.goto('/')
  await writeProducts(page, [
    baseProduct({ id: 'p-null', name: '无价商品', price: null }),
    baseProduct({ id: 'p-zero', name: '零元商品', price: 0 }),
    baseProduct({ id: 'p-dec', name: '小数商品', price: 180.5 }),
  ])
  await page.goto('/')
  const card = (name) => page.locator('.product-card', { hasText: name })
  await expect(card('无价商品').locator('.price-text')).toHaveText('未填写价格')
  await expect(card('零元商品').locator('.price-text')).toHaveText('¥ 0.00')
  await expect(card('小数商品').locator('.price-text')).toHaveText('¥ 180.50')

  await page.goto('/product/p-null/media')
  await expect(page.locator('.info-price')).toHaveText('未填写价格')
})

test('媒体页轮播点点可切换激活状态', async ({ page }) => {
  const seed = baseProduct({ images: [dataUrlImage(), dataUrlImage()], image: dataUrlImage() })
  await page.goto('/')
  await writeProducts(page, [seed])
  await page.goto(`/product/${seed.id}/media`)
  const dots = page.locator('.swipe-carousel-dot')
  await expect(dots).toHaveCount(2)
  await expect(dots.nth(0)).toHaveClass(/active/)
  await dots.nth(1).click()
  await expect(dots.nth(1)).toHaveClass(/active/)
  await expect(dots.nth(0)).not.toHaveClass(/active/)
})
