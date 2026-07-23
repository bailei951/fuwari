// 阅读批注状态层：增删改 + 持久化到 localStorage
// 批注按 articleId（`${examKey}:${passageId}`）分组存储

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Annotation, AnnotationStore } from '../types'
import { readJSON, writeJSON, uuid, StorageKeys } from '../lib/storage'

interface AnnotationContextValue {
  store: AnnotationStore
  /** 取某篇文章的所有批注（按起始偏移升序） */
  getAnnotations: (articleId: string) => Annotation[]
  /** 新增批注，返回生成对象 */
  addAnnotation: (ann: Omit<Annotation, 'id' | 'createdAt'>) => Annotation
  /** 编辑笔记 / 颜色 */
  updateAnnotation: (
    id: string,
    patch: Partial<Pick<Annotation, 'note' | 'color'>>,
  ) => void
  /** 删除单条 */
  removeAnnotation: (id: string) => void
  /** 清空某篇文章全部批注 */
  clearArticle: (articleId: string) => void
  /** 全站批注总数 */
  count: number
  /** 强制重读（导入存档后调用） */
  reload: () => void
}

const AnnotationContext = createContext<AnnotationContextValue | null>(null)

export function AnnotationProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<AnnotationStore>(() =>
    readJSON<AnnotationStore>(StorageKeys.ANNOTATIONS, {}),
  )

  const reload = useCallback(() => {
    setStore(readJSON<AnnotationStore>(StorageKeys.ANNOTATIONS, {}))
  }, [])

  const getAnnotations = useCallback(
    (articleId: string) => {
      const list = store[articleId] ?? []
      return [...list].sort((a, b) => a.startOffset - b.startOffset)
    },
    [store],
  )

  const addAnnotation = useCallback(
    (ann: Omit<Annotation, 'id' | 'createdAt'>) => {
      const newItem: Annotation = {
        ...ann,
        id: uuid(),
        createdAt: new Date().toISOString(),
      }
      setStore((prev) => {
        const list = prev[ann.articleId] ?? []
        const next: AnnotationStore = {
          ...prev,
          [ann.articleId]: [...list, newItem],
        }
        writeJSON(StorageKeys.ANNOTATIONS, next)
        return next
      })
      return newItem
    },
    [],
  )

  const updateAnnotation = useCallback(
    (id: string, patch: Partial<Pick<Annotation, 'note' | 'color'>>) => {
      setStore((prev) => {
        const next: AnnotationStore = {}
        for (const [articleId, list] of Object.entries(prev)) {
          next[articleId] = list.map((a) => (a.id === id ? { ...a, ...patch } : a))
        }
        writeJSON(StorageKeys.ANNOTATIONS, next)
        return next
      })
    },
    [],
  )

  const removeAnnotation = useCallback((id: string) => {
    setStore((prev) => {
      const next: AnnotationStore = {}
      for (const [articleId, list] of Object.entries(prev)) {
        next[articleId] = list.filter((a) => a.id !== id)
      }
      writeJSON(StorageKeys.ANNOTATIONS, next)
      return next
    })
  }, [])

  const clearArticle = useCallback((articleId: string) => {
    setStore((prev) => {
      if (!(articleId in prev)) return prev
      const next = { ...prev }
      delete next[articleId]
      writeJSON(StorageKeys.ANNOTATIONS, next)
      return next
    })
  }, [])

  const count = useMemo(
    () => Object.values(store).reduce((sum, list) => sum + list.length, 0),
    [store],
  )

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === `ky:${StorageKeys.ANNOTATIONS}`) reload()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [reload])

  const value = useMemo<AnnotationContextValue>(
    () => ({
      store,
      getAnnotations,
      addAnnotation,
      updateAnnotation,
      removeAnnotation,
      clearArticle,
      count,
      reload,
    }),
    [
      store,
      getAnnotations,
      addAnnotation,
      updateAnnotation,
      removeAnnotation,
      clearArticle,
      count,
      reload,
    ],
  )

  return <AnnotationContext.Provider value={value}>{children}</AnnotationContext.Provider>
}

export function useAnnotations() {
  const ctx = useContext(AnnotationContext)
  if (!ctx) throw new Error('useAnnotations 必须在 AnnotationProvider 内使用')
  return ctx
}
