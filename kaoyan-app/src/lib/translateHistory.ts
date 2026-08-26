// 翻译历史记录：保存用户查过的词 / 短语 / 长句译文，方便回顾
// 存储：localStorage `ky:translate-history`，上限 200 条，最新在前
// 同一原文重复查询时更新时间戳并移到最前（去重）

import type { TranslateHistoryItem, TranslateHistoryStore } from '../types'
import { readJSON, remove, uuid, writeJSON, StorageKeys } from './storage'

const MAX_ITEMS = 200

function load(): TranslateHistoryStore {
  return readJSON<TranslateHistoryStore>(StorageKeys.TRANSLATE_HISTORY, { items: [] })
}

function persist(store: TranslateHistoryStore): void {
  writeJSON(StorageKeys.TRANSLATE_HISTORY, store)
}

/**
 * 记录一条翻译历史（同原文去重，最新在前，超限淘汰最旧）
 */
export function recordTranslateHistory(item: Omit<TranslateHistoryItem, 'id' | 'createdAt'>): void {
  const text = item.text.trim()
  if (!text || !item.translation) return

  const store = load()
  // 去重：同原文 + 同类型 → 移到最前并刷新时间
  const rest = store.items.filter(
    (x) => !(x.text === text && x.kind === item.kind),
  )
  const entry: TranslateHistoryItem = {
    ...item,
    text,
    id: uuid(),
    createdAt: new Date().toISOString(),
  }
  store.items = [entry, ...rest].slice(0, MAX_ITEMS)
  persist(store)
}

/** 获取全部历史（最新在前） */
export function getTranslateHistory(): TranslateHistoryItem[] {
  return load().items
}

/** 历史条数 */
export function getTranslateHistoryCount(): number {
  return load().items.length
}

/** 删除单条 */
export function removeTranslateHistoryItem(id: string): void {
  const store = load()
  store.items = store.items.filter((x) => x.id !== id)
  persist(store)
}

/** 清空历史 */
export function clearTranslateHistory(): void {
  remove(StorageKeys.TRANSLATE_HISTORY)
}
