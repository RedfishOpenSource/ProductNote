import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./fixtures/shop-test.mp4', import.meta.url))
const storageKey = 'CapacitorStorage.product_item_products'
const seed = { id: 'existing-item', name: '已有商品', price: 200, description: '', supplierName: '', supplierPhone: '', image: null, images: [], attachments: [], model3d: null, createdAt: '2026-10-28T00:00:00Z', updatedAt: '2026-10-28T00:00:00Z', category: '办公家具', quantity: 12, unit: '套', wholesalePrice: 150 }

async function readProducts(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), storageKey)
}
async function prepareCandidates(page) {
  await page.goto('/video-entry')
  await page.locator('input[type=file]').first().setInputFiles(fixture)
  await page.getByRole('button', { name: '开始抽帧分析' }).click()
  const cards = page.locator('.candidate-card')
  await expect(cards.first()).toBeVisible()
  expect(await cards.count()).toBeGreaterThanOrEqual(2)
  return cards
}
async function nameCandidates(cards) {
  for (let i = 0; i < await cards.count(); i++) {
    await cards.nth(i).getByPlaceholder('核对后填写商品名称').fill(`测试商品 ${i + 1}`)
  }
}

test('可选数值保留未知，拒绝无效数值、负数、小数库存和不安全整数', async ({ page }) => {
  await page.goto('/video-entry')
  const actual = await page.evaluate(async () => {
    const { parseOptionalPrice: price, parseOptionalQuantity: qty } = await import('/src/services/product-entry-fields.ts')
    const invalid = (fn, text) => { try { fn(text); return false } catch { return true } }
    return { blank: [price(''), qty('  ')], zero: [price('0'), qty('0')], valid: [price('12.34'), qty('12')], invalid: [invalid(price, '-1'), invalid(price, '1.234'), invalid(price, 'Infinity'), invalid(qty, '1.5'), invalid(qty, '-1'), invalid(qty, '9007199254740992')] }
  })
  expect(actual).toEqual({ blank: [null, null], zero: [0, 0], valid: [12.34, 12], invalid: [true, true, true, true, true, true] })
})

test('真实 MP4 首帧和后续帧可抽取，保持尺寸比例与时间点', async ({ page }) => {
  await page.goto('/video-entry')
  const frames = await page.evaluate(async () => {
    const { extractCandidateFrames } = await import('/src/services/video-entry-service.ts')
    const url = URL.createObjectURL(await (await fetch('/tests/fixtures/shop-test.mp4')).blob())
    try { return (await extractCandidateFrames(url, { intervalSeconds: 2, minDistanceBits: 0 })).map(({ dataUrl, ...frame }) => ({ ...frame, jpeg: dataUrl.startsWith('data:image/jpeg;base64,') })) }
    finally { URL.revokeObjectURL(url) }
  })
  expect(frames.map((frame) => frame.timestampSeconds)).toEqual([0, 2, 4])
  expect(frames.every((frame) => frame.width === 320 && frame.height === 240 && frame.jpeg)).toBe(true)
  expect(new Set(frames.map((frame) => frame.hashHex)).size).toBeGreaterThan(1)
})

test('抽帧上限生效，重复画面去重且画面哈希不冒充标签', async ({ page }) => {
  await page.goto('/video-entry')
  const result = await page.evaluate(async () => {
    const { extractCandidateFrames, suggestNameFromLabels } = await import('/src/services/video-entry-service.ts')
    const { hammingDistanceHex } = await import('/src/services/frame-dedup.ts')
    const { isSemanticLabelingSupported } = await import('/src/services/visual-search-service.ts')
    const url = URL.createObjectURL(await (await fetch('/tests/fixtures/shop-test.mp4')).blob())
    try { return { limited: (await extractCandidateFrames(url, { minDistanceBits: 0, maxFrames: 1 })).length, deduped: (await extractCandidateFrames(url, { minDistanceBits: 64 })).length, distance: hammingDistanceHex('0000000000000000', 'ffffffffffffffff'), name: suggestNameFromLabels([' 碗 ', '碗', '', '盆']), semantic: isSemanticLabelingSupported() } }
    finally { URL.revokeObjectURL(url) }
  })
  expect(result).toEqual({ limited: 1, deduped: 1, distance: 64, name: '碗 盆', semantic: false })
})

for (const mode of ['metadata-timeout', 'metadata-abort', 'seek-timeout', 'seek-abort']) {
  test(`视频 ${mode} 不会误报成功，失败也释放资源`, async ({ page }) => {
    await page.goto('/video-entry')
    const result = await page.evaluate(async (mode) => {
      const { extractCandidateFrames } = await import('/src/services/video-entry-service.ts')
      const original = document.createElement.bind(document)
      const fake = new EventTarget()
      const seekMode = mode.startsWith('seek')
      fake.readyState = seekMode ? 2 : 0
      fake.duration = 6
      fake.videoWidth = 320
      fake.videoHeight = 240
      let currentTime = 0
      Object.defineProperty(fake, 'currentTime', { get: () => currentTime, set: (value) => { currentTime = value; fake.seeking = true } })
      // seek 测试只验证等待行为，不需要真实画面。
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function () {
        return { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(9 * 8 * 4) }) }
      }
      fake.load = () => {}
      fake.pause = () => { fake.paused = true }
      fake.removeAttribute = (name) => { if (name === 'src') fake.src = '' }
      document.createElement = (name, options) => name === 'video' ? fake : original(name, options)
      const controller = new AbortController()
      const timer = mode.endsWith('abort') ? setTimeout(() => controller.abort(), 25) : null
      try {
        await extractCandidateFrames('mock:video', { timeoutMs: 80, signal: controller.signal })
        return { error: 'unexpected-success' }
      } catch (error) { return { error: error.name, message: error.message, released: fake.paused && fake.src === '' } }
      finally { document.createElement = original; HTMLCanvasElement.prototype.getContext = getContext; clearTimeout(timer) }
    }, mode)
    expect(result.released).toBe(true)
    expect(result.error).toBe(mode.endsWith('abort') ? 'AbortError' : 'Error')
    expect(result.message).toContain(mode.endsWith('abort') ? '取消' : '超时')
  })
}

test('移动端校验阻止错误入库，全选同步，空库存与零分开保存，CSV 可下载', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const cards = await prepareCandidates(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByText('当前设备未提供语义标签', { exact: false })).toBeVisible()
  await cards.first().getByPlaceholder('核对后填写商品名称').fill('')
  await page.getByRole('button', { name: /入库所选/ }).click()
  await expect(cards.first().getByRole('alert')).toContainText('商品名称')
  expect(await readProducts(page)).toHaveLength(0)
  await nameCandidates(cards)
  await cards.first().getByLabel('库存', { exact: true }).fill('1.5')
  await page.getByRole('button', { name: /入库所选/ }).click()
  await expect(cards.first().getByRole('alert')).toContainText('整数')
  expect(await readProducts(page)).toHaveLength(0)
  await cards.first().getByLabel('库存', { exact: true }).fill('')
  await cards.first().getByLabel('价格（元）', { exact: true }).fill('abc')
  await page.getByRole('button', { name: /入库所选/ }).click()
  await expect(cards.first().getByRole('alert')).toContainText('价格')
  await cards.first().getByLabel('价格（元）', { exact: true }).fill('0')
  await cards.first().getByLabel('批发价（元）', { exact: true }).fill('12.34')
  await cards.nth(1).getByLabel('库存', { exact: true }).fill('0')
  await cards.nth(1).locator('label.el-checkbox').click()
  await expect(page.getByRole('checkbox', { name: '全选', exact: true })).not.toBeChecked()
  await page.locator('.bulk-bar label.el-checkbox').click()
  await page.screenshot({ path: testInfo.outputPath('mobile-review.png'), fullPage: true })
  await page.getByRole('button', { name: /入库所选/ }).click()
  await expect(page.getByRole('heading', { name: /已入库/ })).toBeVisible()
  const products = await readProducts(page)
  expect(products.find((item) => item.name === '测试商品 1')).toMatchObject({ price: 0, quantity: null, wholesalePrice: 12.34 })
  expect(products.find((item) => item.name === '测试商品 2').quantity).toBe(0)
  expect(products.every((item) => item.images.length === 1 && item.image.path.startsWith('data:image/jpeg'))).toBe(true)
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 AgentMall CSV' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toMatch(/agentmall-商品-\d{8}\.csv/)
  const chunks = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk)
  const csv = Buffer.concat(chunks).toString('utf8')
  expect(csv).toContain('名称,分类,价格(元),库存,单位')
  expect(csv).toContain('测试商品 1,,0,,个')
  expect(errors).toEqual([])
})

for (const afterWrite of [false, true]) {
  test(`入库部分失败重试无重复，写后失败=${afterWrite}，已有商品不受影响`, async ({ page }) => {
    const cards = await prepareCandidates(page)
    await nameCandidates(cards)
    const candidateCount = await cards.count()
    await page.evaluate(({ key, seed, afterWrite }) => {
      localStorage.setItem(key, JSON.stringify([seed]))
      const set = Storage.prototype.setItem
      let writes = 0
      Storage.prototype.setItem = function (name, value) {
        if (name === key && ++writes === 2) {
          if (afterWrite) set.call(this, name, value)
          throw new Error('回归测试模拟存储失败')
        }
        return set.call(this, name, value)
      }
    }, { key: storageKey, seed, afterWrite })
    await page.getByRole('button', { name: /入库所选/ }).click()
    await expect(page.getByText(/本批次已保存 1 件/).first()).toBeVisible()
    await expect(cards.first().getByPlaceholder('核对后填写商品名称')).toBeDisabled()
    const idsBefore = (await readProducts(page)).map((item) => item.id)
    await page.getByRole('button', { name: /入库所选/ }).click()
    await expect(page.getByRole('heading', { name: /已入库/ })).toBeVisible()
    const products = await readProducts(page)
    expect(products).toHaveLength(candidateCount + 1)
    expect(new Set(products.map((item) => item.id)).size).toBe(candidateCount + 1)
    expect(products.find((item) => item.id === seed.id)).toEqual(seed)
    expect(idsBefore.every((id) => products.some((item) => item.id === id))).toBe(true)
  })
}

test('同名候选与已有商品去重并列出报告，改名后可重新入库', async ({ page }) => {
  const cards = await prepareCandidates(page)
  await nameCandidates(cards)
  await page.evaluate(({ key, seed }) => localStorage.setItem(key, JSON.stringify([{ ...seed, id: 'dup-target', name: '测试商品 1' }])), { key: storageKey, seed })
  await page.getByRole('button', { name: /入库所选/ }).click()
  await expect(page.getByText(/候选 1「测试商品 1」与已有商品「测试商品 1」重复/)).toBeVisible()
  await expect(cards.first().getByRole('status')).toContainText('已有商品')
  await expect(cards.first().locator('label.el-checkbox').locator('input')).not.toBeChecked()
  let products = await readProducts(page)
  expect(products).toHaveLength(3)
  expect(products.filter((item) => item.name === '测试商品 1')).toHaveLength(1)
  expect(products.find((item) => item.name === '测试商品 1')?.id).toBe('dup-target')
  await cards.first().getByPlaceholder('核对后填写商品名称').fill('改名后商品')
  await expect(cards.first().getByRole('status')).toHaveCount(0)
  await cards.first().locator('label.el-checkbox').click()
  await page.getByRole('button', { name: /入库所选/ }).click()
  await expect(page.getByRole('heading', { name: /已入库/ })).toBeVisible()
  products = await readProducts(page)
  expect(products).toHaveLength(4)
  expect(products.some((item) => item.name === '改名后商品')).toBe(true)
})

test('本批次同名候选去重并写入报告，不静默跳过', async ({ page }) => {
  const cards = await prepareCandidates(page)
  await nameCandidates(cards)
  await cards.nth(1).getByPlaceholder('核对后填写商品名称').fill('测试商品 1')
  await page.getByRole('button', { name: /入库所选/ }).click()
  await expect(page.getByText(/候选 2「测试商品 1」与本批次候选 1「测试商品 1」重复/)).toBeVisible()
  await expect(cards.nth(1).getByRole('status')).toContainText('本批次候选 1')
  await expect(cards.nth(1).locator('label.el-checkbox').locator('input')).not.toBeChecked()
  const products = await readProducts(page)
  expect(products.map((item) => item.name).sort()).toEqual(['测试商品 1', '测试商品 3'])
})

test('普通编辑保留分类/库存/单位/批发价，旧记录缺失字段兼容', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(({ key, seed }) => localStorage.setItem(key, JSON.stringify([seed])), { key: storageKey, seed })
  await page.goto(`/product/${seed.id}`)
  await expect(page.getByLabel('库存数量')).toHaveValue('12')
  await expect(page.getByLabel('批发价（元）')).toHaveValue('150')
  await page.getByLabel('商品名称', { exact: true }).fill('编辑后的已有商品')
  await page.getByRole('button', { name: '保存商品' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect((await readProducts(page))[0]).toMatchObject({ category: '办公家具', quantity: 12, unit: '套', wholesalePrice: 150, name: '编辑后的已有商品' })
  await page.evaluate(({ key, seed }) => {
    const { category, quantity, unit, wholesalePrice, ...legacy } = seed
    localStorage.setItem(key, JSON.stringify([legacy]))
  }, { key: storageKey, seed })
  await page.goto(`/product/${seed.id}`)
  await expect(page.getByLabel('库存数量')).toHaveValue('')
  await page.getByRole('button', { name: '保存商品' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect((await readProducts(page))[0]).toMatchObject({ category: '', quantity: null, unit: '', wholesalePrice: null })
})

test('只保存勾选项，未勾选草稿保留并可分批继续', async ({ page }) => {
  const cards = await prepareCandidates(page)
  await nameCandidates(cards)
  const count = await cards.count()
  for (let i = 1; i < count; i++) await cards.nth(i).locator('label.el-checkbox').click()
  await page.getByRole('button', { name: /入库所选/ }).click()
  await expect(cards.first().getByPlaceholder('核对后填写商品名称')).toBeDisabled()
  await expect(cards.nth(1).getByPlaceholder('核对后填写商品名称')).toBeEnabled()
  await expect(page.getByRole('heading', { name: '3. 确认候选商品' })).toBeVisible()
  expect(await readProducts(page)).toHaveLength(1)
  await page.locator('.bulk-bar label.el-checkbox').click()
  await page.getByRole('button', { name: /入库所选/ }).click()
  await expect(page.getByRole('heading', { name: /已入库/ })).toBeVisible()
  expect(await readProducts(page)).toHaveLength(count)
})

test('页面取消按钮终止等待并回到选视频，不创建商品', async ({ page }) => {
  await page.goto('/video-entry')
  await page.locator('input[type=file]').first().setInputFiles(fixture)
  await page.evaluate(() => {
    const create = document.createElement.bind(document)
    const fake = new EventTarget()
    fake.readyState = 0
    fake.load = () => {}
    fake.pause = () => {}
    fake.removeAttribute = () => {}
    document.createElement = (name, options) => name === 'video' ? fake : create(name, options)
  })
  await page.getByRole('button', { name: '开始抽帧分析' }).click()
  await expect(page.getByRole('heading', { name: '2. 正在抽帧分析' })).toBeVisible()
  await page.getByRole('button', { name: '取消分析' }).click()
  await expect(page.getByRole('heading', { name: '1. 选择视频' })).toBeVisible()
  expect(await readProducts(page)).toHaveLength(0)
})

test('CSV 保留中文 BOM、换行、引号及未知值；具体分类优先于泛称', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async (seed) => {
    const { buildAgentMallCsv, mapCategoryByName } = await import('/src/services/agentmall-export.ts')
    return {
      csv: buildAgentMallCsv([{ ...seed, name: '碗,\"不锈钢\"\n大号', category: '餐具器皿', price: null, quantity: null }]),
      categories: ['办公桌', '办公椅', '冷藏操作台', '宴会桌'].map(mapCategoryByName),
    }
  }, seed)
  expect(result.csv).toBe('\uFEFF名称,分类,价格(元),库存,单位\r\n"碗,""不锈钢""\n大号",餐具器皿,,,套')
  expect(result.categories).toEqual(['办公家具', '办公家具', '制冷冰柜', '桌椅宴会'])
})

test('候选默认自动赋唯一占位名，不改名可直接入库', async ({ page }) => {
  const cards = await prepareCandidates(page)
  const names = []
  for (let i = 0; i < await cards.count(); i++) {
    names.push(await cards.nth(i).getByPlaceholder('核对后填写商品名称').inputValue())
  }
  expect(names.length).toBeGreaterThanOrEqual(2)
  expect(names.every((name) => /^待命名-[0-9A-Z]{6}$/.test(name))).toBe(true)
  expect(new Set(names).size).toBe(names.length)
  await page.getByRole('button', { name: /入库所选/ }).click()
  await expect(page.getByRole('heading', { name: /已入库/ })).toBeVisible()
  const products = await readProducts(page)
  expect(products.map((item) => item.name).sort()).toEqual([...names].sort())
  expect(products.every((item) => item.description.includes('自动占位'))).toBe(true)
})

test('画面相似度：同图判定相似，不同纹理不误判，聚类排序相邻', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { findSimilarProductsByImage, orderProductsByImageSimilarity } = await import('/src/services/visual-search-service.ts')
    const makeImage = (horizontal) => {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const context = canvas.getContext('2d')
      for (let pos = 0; pos < 64; pos += 8) {
        context.fillStyle = pos % 16 === 0 ? '#111' : '#eee'
        if (horizontal) context.fillRect(0, pos, 64, 8)
        else context.fillRect(pos, 0, 8, 64)
      }
      return canvas.toDataURL('image/png')
    }
    const stripesA = makeImage(false)
    const stripesB = makeImage(true)
    const file = (path) => ({ path, name: 'p.png', mimeType: 'image/png', size: path.length, kind: 'image' })
    const product = (id, name, path) => ({ id, name, price: null, description: '', supplierName: '', supplierPhone: '', image: path ? file(path) : null, images: path ? [file(path)] : [], attachments: [], model3d: null, createdAt: '2026-10-31T00:00:00Z', updatedAt: '2026-10-31T00:00:00Z' })
    const products = [product('a1', '条纹A一', stripesA), product('b1', '横纹B', stripesB), product('a2', '条纹A二', stripesA), product('c1', '无图C', null)]
    const ordered = await orderProductsByImageSimilarity(products)
    const similar = await findSimilarProductsByImage(file(stripesA), products)
    return { order: ordered.map((item) => item.id), similar: similar.map((hint) => hint.productId) }
  })
  expect(result.order.indexOf('a2') - result.order.indexOf('a1')).toBe(1)
  expect(result.order[result.order.length - 1]).toBe('c1')
  expect(result.similar).toEqual(['a1', 'a2'])
})

test('候选画面与已有商品相似时列出提示，由用户决定是否入库', async ({ page }) => {
  await page.goto('/video-entry')
  const frameDataUrl = await page.evaluate(async () => {
    const { extractCandidateFrames } = await import('/src/services/video-entry-service.ts')
    const url = URL.createObjectURL(await (await fetch('/tests/fixtures/shop-test.mp4')).blob())
    try {
      return (await extractCandidateFrames(url, { intervalSeconds: 2, maxFrames: 1 })).at(0)?.dataUrl ?? ''
    } finally { URL.revokeObjectURL(url) }
  })
  expect(frameDataUrl.startsWith('data:image/jpeg')).toBe(true)
  await page.evaluate(({ key, seed, frameDataUrl }) => {
    const image = { path: frameDataUrl, name: 'photo.jpg', mimeType: 'image/jpeg', size: frameDataUrl.length, kind: 'image' }
    localStorage.setItem(key, JSON.stringify([{ ...seed, id: 'similar-target', name: '画面相似的已有商品', image, images: [image] }]))
  }, { key: storageKey, seed, frameDataUrl })
  await page.locator('input[type=file]').first().setInputFiles(fixture)
  await page.getByRole('button', { name: '开始抽帧分析' }).click()
  const cards = page.locator('.candidate-card')
  await expect(cards.first()).toBeVisible()
  await expect(cards.first().getByRole('status')).toContainText('画面相似：已有商品「画面相似的已有商品」', { timeout: 15000 })
  // 相似只是提示：默认仍勾选，用户确认后可正常入库
  await page.getByRole('button', { name: /入库所选/ }).click()
  await expect(page.getByRole('heading', { name: /已入库/ })).toBeVisible()
  const products = await readProducts(page)
  expect(products).toHaveLength(4)
  expect(products.find((item) => item.id === 'similar-target')).toBeTruthy()
})

test('取消离开保留未保存候选，确认离开丢弃草稿且不入库', async ({ page }) => {
  const cards = await prepareCandidates(page)
  const count = await cards.count()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: '返回商品列表', exact: true }).click()
  await expect(page).toHaveURL(/video-entry/)
  await expect(cards).toHaveCount(count)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '返回商品列表', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(await readProducts(page)).toHaveLength(0)
})
