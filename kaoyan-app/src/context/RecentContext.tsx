// 最近学习记录状态层：首页与导航共用

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { RecentStore } from '../types'
import { readJSON, writeJSON, StorageKeys } from '../lib/storage'

interface RecentContextValue {
  items: RecentStore['items']
  /** 记录一次访问（去重 + 置顶 + 限制条数） */
  pushRecent: (paperId: string) => void
  reload: () => void
}

const RecentContext = createContext<RecentContextValue | null>(null)
const MAX_ITEMS = 12

export function RecentProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<RecentStore>(() =>
    readJSON<RecentStore>(StorageKeys.RECENT, { items: [] }),
  )

  const reload = useCallback(() => {
    setStore(readJSON<RecentStore>(StorageKeys.RECENT, { items: [] }))
  }, [])

  const pushRecent = useCallback((paperId: string) => {
    setStore((prev) => {
      const filtered = prev.items.filter((i) => i.paperId !== paperId)
      const next: RecentStore = {
        items: [{ paperId, visitedAt: new Date().toISOString() }, ...filtered].slice(0, MAX_ITEMS),
      }
      writeJSON(StorageKeys.RECENT, next)
      return next
    })
  }, [])

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === `ky:${StorageKeys.RECENT}`) reload()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [reload])

  const value = useMemo<RecentContextValue>(
    () => ({ items: store.items, pushRecent, reload }),
    [store.items, pushRecent, reload],
  )

  return <RecentContext.Provider value={value}>{children}</RecentContext.Provider>
}

export function useRecent() {
  const ctx = useContext(RecentContext)
  if (!ctx) throw new Error('useRecent 必须在 RecentProvider 内使用')
  return ctx
}
