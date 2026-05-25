import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'
import { getPrimaryProductImage, normalizeProductImages } from '../types/product'
import type { Product, StoredFile } from '../types/product'
import type { ProductVisualIndex } from '../types/visual-search'

const DB_NAME = 'product_item_db'
const STORAGE_KEY = 'product_item_products'
const isNativePlatform = Capacitor.getPlatform() !== 'web'

let sqlite: SQLiteConnection | null = null
let database: SQLiteDBConnection | null = null

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (!value) return fallback

  try {
    return JSON.parse(String(value)) as T
  } catch {
    return fallback
  }
}

function mapRowToProduct(row: Record<string, unknown>) {
  const image = parseJsonValue<StoredFile | null>(row.image_json, null)
  const images = parseJsonValue<StoredFile[]>(row.images_json, [])
  const normalizedImages = normalizeProductImages(image, images)

  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    description: String(row.description ?? ''),
    supplierName: String(row.supplier_name ?? ''),
    supplierPhone: String(row.supplier_phone ?? ''),
    image: normalizedImages[0] ?? image,
    images: normalizedImages,
    attachments: parseJsonValue<StoredFile[]>(row.attachments_json, []),
    model3d: parseJsonValue<Product['model3d']>(row.model_3d_json, null),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  } satisfies Product
}

function mapRowToVisualIndex(row: Record<string, unknown>) {
  return {
    productId: String(row.product_id ?? ''),
    imagePath: String(row.image_path ?? ''),
    labels: parseJsonValue(row.labels_json, []),
    modelId: String(row.model_id ?? ''),
    indexedAt: String(row.indexed_at ?? ''),
  } satisfies ProductVisualIndex
}

async function ensureDatabase() {
  if (!isNativePlatform) return null
  if (database) return database

  sqlite ??= new SQLiteConnection(CapacitorSQLite)
  const consistency = await sqlite.checkConnectionsConsistency()
  const hasConnection = (await sqlite.isConnection(DB_NAME, false)).result

  if (consistency.result && hasConnection) {
    database = await sqlite.retrieveConnection(DB_NAME, false)
  } else {
    database = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)
  }

  await database.open()
  await database.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      price REAL,
      description TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      supplier_phone TEXT NOT NULL,
      image_json TEXT,
      images_json TEXT,
      attachments_json TEXT NOT NULL,
      model_3d_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS product_visual_index (
      product_id TEXT PRIMARY KEY NOT NULL,
      image_path TEXT NOT NULL,
      labels_json TEXT NOT NULL,
      model_id TEXT NOT NULL,
      indexed_at TEXT NOT NULL
    );
  `)

  try {
    await database.execute('ALTER TABLE products ADD COLUMN model_3d_json TEXT')
  } catch {
    // Column already exists on upgraded installs.
  }
  try {
    await database.execute('ALTER TABLE products ADD COLUMN images_json TEXT')
  } catch {
    // Column already exists on upgraded installs.
  }

  return database
}

function normalizeProduct(product: Product): Product {
  const images = normalizeProductImages(product.image, product.images)

  return {
    ...product,
    image: images[0] ?? product.image ?? null,
    images,
    attachments: product.attachments ?? [],
    model3d: product.model3d ?? null,
  }
}

async function loadWebProducts() {
  const result = await Preferences.get({ key: STORAGE_KEY })
  if (!result.value) return [] as Product[]

  try {
    const parsed = JSON.parse(result.value) as Product[]
    return parsed.map((product) => normalizeProduct(product)).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  } catch {
    return [] as Product[]
  }
}

async function saveWebProducts(products: Product[]) {
  await Preferences.set({
    key: STORAGE_KEY,
    value: JSON.stringify(products),
  })
}

function sortProducts(products: Product[]) {
  return [...products].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function listProducts() {
  if (!isNativePlatform) {
    return await loadWebProducts()
  }

  const db = await ensureDatabase()
  const result = await db!.query('SELECT * FROM products ORDER BY updated_at DESC')
  return (result.values ?? []).map((row) => mapRowToProduct(row as Record<string, unknown>))
}

export async function getProductById(id: string) {
  if (!isNativePlatform) {
    const products = await loadWebProducts()
    return products.find((product) => product.id === id) ?? null
  }

  const db = await ensureDatabase()
  const result = await db!.query('SELECT * FROM products WHERE id = ?', [id])
  const row = result.values?.[0]
  return row ? mapRowToProduct(row as Record<string, unknown>) : null
}

export async function saveProduct(product: Product) {
  const normalizedProduct = normalizeProduct(product)

  if (!isNativePlatform) {
    const products = await loadWebProducts()
    const nextProducts = products.filter((item) => item.id !== normalizedProduct.id)
    nextProducts.push(normalizedProduct)
    await saveWebProducts(sortProducts(nextProducts))
    return
  }

  const db = await ensureDatabase()
  await db!.run(
    `INSERT OR REPLACE INTO products (
      id, name, price, description, supplier_name, supplier_phone,
      image_json, images_json, attachments_json, model_3d_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizedProduct.id,
      normalizedProduct.name,
      normalizedProduct.price,
      normalizedProduct.description,
      normalizedProduct.supplierName,
      normalizedProduct.supplierPhone,
      getPrimaryProductImage(normalizedProduct) ? JSON.stringify(getPrimaryProductImage(normalizedProduct)) : null,
      JSON.stringify(normalizedProduct.images),
      JSON.stringify(normalizedProduct.attachments),
      normalizedProduct.model3d ? JSON.stringify(normalizedProduct.model3d) : null,
      normalizedProduct.createdAt,
      normalizedProduct.updatedAt,
    ],
  )
}

export async function deleteProduct(id: string) {
  if (!isNativePlatform) {
    const products = await loadWebProducts()
    await saveWebProducts(products.filter((product) => product.id !== id))
    return
  }

  const db = await ensureDatabase()
  await db!.run('DELETE FROM products WHERE id = ?', [id])
}

export async function replaceAllProducts(products: Product[]) {
  if (!isNativePlatform) {
    await saveWebProducts(sortProducts(products.map((product) => normalizeProduct(product))))
    return
  }

  const db = await ensureDatabase()
  await db!.execute('DELETE FROM products')
  await db!.execute('DELETE FROM product_visual_index')

  for (const product of sortProducts(products)) {
    await saveProduct(normalizeProduct(product))
  }
}

export async function listProductVisualIndexes() {
  if (!isNativePlatform) return [] as ProductVisualIndex[]

  const db = await ensureDatabase()
  const result = await db!.query('SELECT * FROM product_visual_index ORDER BY indexed_at DESC')
  return (result.values ?? []).map((row) => mapRowToVisualIndex(row as Record<string, unknown>))
}

export async function saveProductVisualIndex(index: ProductVisualIndex) {
  if (!isNativePlatform) return

  const db = await ensureDatabase()
  await db!.run(
    `INSERT OR REPLACE INTO product_visual_index (
      product_id, image_path, labels_json, model_id, indexed_at
    ) VALUES (?, ?, ?, ?, ?)`,
    [index.productId, index.imagePath, JSON.stringify(index.labels), index.modelId, index.indexedAt],
  )
}

export async function deleteProductVisualIndex(productId: string) {
  if (!isNativePlatform) return

  const db = await ensureDatabase()
  await db!.run('DELETE FROM product_visual_index WHERE product_id = ?', [productId])
}
