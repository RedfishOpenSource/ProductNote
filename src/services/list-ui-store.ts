import { Preferences } from '@capacitor/preferences'
import type { ViewMode } from '../types/product'

const LIST_UI_STORAGE_KEY = 'product_item_list_ui'
const MAX_HISTORY_COUNT = 10
const DEFAULT_VIEW_MODE: ViewMode = 'card'
const VALID_VIEW_MODES: ViewMode[] = ['card', 'feed']

interface ListUiState {
  viewMode: ViewMode
  searchHistory: string[]
}

function createDefaultState(): ListUiState {
  return {
    viewMode: DEFAULT_VIEW_MODE,
    searchHistory: [],
  }
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim()
}

function normalizeKeywordKey(keyword: string): string {
  return normalizeKeyword(keyword).toLowerCase()
}

function normalizeViewMode(mode: unknown): ViewMode {
  return VALID_VIEW_MODES.includes(mode as ViewMode) ? (mode as ViewMode) : DEFAULT_VIEW_MODE
}

function normalizeHistory(history: unknown): string[] {
  if (!Array.isArray(history)) return []

  const seenKeywords = new Set<string>()
  const normalizedHistory: string[] = []

  for (const item of history) {
    if (typeof item !== 'string') continue

    const keyword = normalizeKeyword(item)
    if (!keyword) continue

    const key = normalizeKeywordKey(keyword)
    if (seenKeywords.has(key)) continue

    seenKeywords.add(key)
    normalizedHistory.push(keyword)

    if (normalizedHistory.length >= MAX_HISTORY_COUNT) {
      break
    }
  }

  return normalizedHistory
}

async function readState(): Promise<ListUiState> {
  const result = await Preferences.get({ key: LIST_UI_STORAGE_KEY })
  if (!result.value) {
    return createDefaultState()
  }

  try {
    const parsed = JSON.parse(result.value) as Partial<ListUiState>

    return {
      viewMode: normalizeViewMode(parsed.viewMode),
      searchHistory: normalizeHistory(parsed.searchHistory),
    }
  } catch {
    return createDefaultState()
  }
}

async function writeState(state: ListUiState): Promise<void> {
  await Preferences.set({
    key: LIST_UI_STORAGE_KEY,
    value: JSON.stringify(state),
  })
}

export async function getListViewMode(): Promise<ViewMode> {
  const state = await readState()
  return state.viewMode
}

export async function setListViewMode(mode: ViewMode): Promise<void> {
  const state = await readState()
  const nextViewMode = normalizeViewMode(mode)

  if (state.viewMode === nextViewMode) {
    return
  }

  await writeState({
    ...state,
    viewMode: nextViewMode,
  })
}

export async function getSearchHistory(): Promise<string[]> {
  const state = await readState()
  return state.searchHistory
}

export async function pushSearchHistory(keyword: string): Promise<string[]> {
  const normalizedKeyword = normalizeKeyword(keyword)
  const normalizedKeywordKey = normalizeKeywordKey(keyword)
  const state = await readState()

  if (!normalizedKeyword) {
    return state.searchHistory
  }

  const nextHistory = [normalizedKeyword, ...state.searchHistory.filter((item) => normalizeKeywordKey(item) !== normalizedKeywordKey)].slice(
    0,
    MAX_HISTORY_COUNT,
  )

  if (state.searchHistory.length === nextHistory.length && state.searchHistory.every((item, index) => item === nextHistory[index])) {
    return nextHistory
  }

  await writeState({
    ...state,
    searchHistory: nextHistory,
  })

  return nextHistory
}

export async function removeSearchHistory(keyword: string): Promise<string[]> {
  const keywordKey = normalizeKeywordKey(keyword)
  const state = await readState()
  const nextHistory = state.searchHistory.filter((item) => normalizeKeywordKey(item) !== keywordKey)

  if (state.searchHistory.length === nextHistory.length) {
    return nextHistory
  }

  await writeState({
    ...state,
    searchHistory: nextHistory,
  })

  return nextHistory
}

export async function clearSearchHistory(): Promise<void> {
  const state = await readState()

  if (state.searchHistory.length === 0) {
    return
  }

  await writeState({
    ...state,
    searchHistory: [],
  })
}
