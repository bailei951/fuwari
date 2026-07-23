// 生词本状态层：添加/删除/查重，持久化到 localStorage

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { VocabItem, VocabStore } from '../types'
import { readJSON, writeJSON, uuid, StorageKeys } from '../lib/storage'

interface VocabContextValue {
  words: VocabItem[]
  /** 添加生词（已存在则跳过，返回是否新增） */
  addWord: (
    word: string,
    phonetic: string,
    meaning: string,
    source?: VocabItem['source'],
  ) => boolean
  /** 删除单个 */
  removeWord: (id: string) => void
  /** 清空 */
  clearAll: () => void
  /** 是否已在生词本 */
  hasWord: (word: string) => boolean
  /** 强制重读（导入存档后调用） */
  reload: () => void
}

const VocabContext = createContext<VocabContextValue | null>(null)

export function VocabProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<VocabStore>(() =>
    readJSON<VocabStore>(StorageKeys.VOCAB, { words: [] }),
  )

  const reload = useCallback(() => {
    setStore(readJSON<VocabStore>(StorageKeys.VOCAB, { words: [] }))
  }, [])

  const hasWord = useCallback(
    (word: string) => {
      const lower = word.trim().toLowerCase()
      return store.words.some((w) => w.word.toLowerCase() === lower)
    },
    [store],
  )

  const addWord = useCallback(
    (word: string, phonetic: string, meaning: string, source?: VocabItem['source']) => {
      const lower = word.trim().toLowerCase()
      if (!lower) return false
      if (store.words.some((w) => w.word.toLowerCase() === lower)) return false

      const newItem: VocabItem = {
        id: uuid(),
        word: word.trim(),
        phonetic,
        meaning,
        source: source ?? { paperId: '' },
        addedAt: new Date().toISOString(),
      }
      setStore((prev) => {
        const next: VocabStore = { words: [...prev.words, newItem] }
        writeJSON(StorageKeys.VOCAB, next)
        return next
      })
      return true
    },
    [store],
  )

  const removeWord = useCallback((id: string) => {
    setStore((prev) => {
      const next: VocabStore = { words: prev.words.filter((w) => w.id !== id) }
      writeJSON(StorageKeys.VOCAB, next)
      return next
    })
  }, [])

  const clearAllVocab = useCallback(() => {
    setStore({ words: [] })
    writeJSON(StorageKeys.VOCAB, { words: [] })
  }, [])

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === `ky:${StorageKeys.VOCAB}`) reload()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [reload])

  const value = useMemo<VocabContextValue>(
    () => ({
      words: store.words,
      addWord,
      removeWord,
      clearAll: clearAllVocab,
      hasWord,
      reload,
    }),
    [store.words, addWord, removeWord, clearAllVocab, hasWord, reload],
  )

  return <VocabContext.Provider value={value}>{children}</VocabContext.Provider>
}

export function useVocab() {
  const ctx = useContext(VocabContext)
  if (!ctx) throw new Error('useVocab 必须在 VocabProvider 内使用')
  return ctx
}
