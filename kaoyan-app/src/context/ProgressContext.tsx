// 做题进度状态层：管理选中、提交、正确错误状态，持久化到 localStorage
// marked 与对错状态独立（可对可错都可标记）

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { OptionKey, ProgressStore, QuestionProgress, QuestionStatus } from '../types'
import { readJSON, writeJSON, StorageKeys } from '../lib/storage'

interface ProgressContextValue {
  store: ProgressStore
  getProgress: (examKey: string, questionId: number) => QuestionProgress
  selectOption: (examKey: string, questionId: number, option: OptionKey) => void
  submitAnswer: (examKey: string, questionId: number, answer: OptionKey) => QuestionStatus
  toggleMark: (examKey: string, questionId: number) => void
  resetExam: (examKey: string) => void
  getExamStats: (examKey: string) => {
    total: number
    answered: number
    correct: number
    wrong: number
    marked: number
  }
  reload: () => void
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

const DEFAULT_PROGRESS: QuestionProgress = {
  selected: null,
  status: 'unanswered',
  marked: false,
  submittedAt: null,
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<ProgressStore>(() =>
    readJSON<ProgressStore>(StorageKeys.PROGRESS, {}),
  )

  const reload = useCallback(() => {
    setStore(readJSON<ProgressStore>(StorageKeys.PROGRESS, {}))
  }, [])

  const getProgress = useCallback(
    (examKey: string, questionId: number): QuestionProgress => {
      return store[examKey]?.[questionId] ?? DEFAULT_PROGRESS
    },
    [store],
  )

  const selectOption = useCallback(
    (examKey: string, questionId: number, option: OptionKey) => {
      setStore((prev) => {
        const examProgress = prev[examKey] ?? {}
        const current = examProgress[questionId] ?? DEFAULT_PROGRESS
        if (current.submittedAt) return prev // 已提交不能改选
        const next: ProgressStore = {
          ...prev,
          [examKey]: {
            ...examProgress,
            [questionId]: { ...current, selected: option },
          },
        }
        writeJSON(StorageKeys.PROGRESS, next)
        return next
      })
    },
    [],
  )

  const submitAnswer = useCallback(
    (examKey: string, questionId: number, answer: OptionKey): QuestionStatus => {
      let resultStatus: QuestionStatus = 'wrong'
      setStore((prev) => {
        const examProgress = prev[examKey] ?? {}
        const current = examProgress[questionId] ?? DEFAULT_PROGRESS
        const selected = current.selected
        resultStatus = selected === answer ? 'correct' : 'wrong'
        const next: ProgressStore = {
          ...prev,
          [examKey]: {
            ...examProgress,
            [questionId]: {
              ...current,
              status: resultStatus,
              submittedAt: new Date().toISOString(),
            },
          },
        }
        writeJSON(StorageKeys.PROGRESS, next)
        return next
      })
      return resultStatus
    },
    [],
  )

  const toggleMark = useCallback((examKey: string, questionId: number) => {
    setStore((prev) => {
      const examProgress = prev[examKey] ?? {}
      const current = examProgress[questionId] ?? DEFAULT_PROGRESS
      const next: ProgressStore = {
        ...prev,
        [examKey]: {
          ...examProgress,
          [questionId]: { ...current, marked: !current.marked },
        },
      }
      writeJSON(StorageKeys.PROGRESS, next)
      return next
    })
  }, [])

  const resetExam = useCallback((examKey: string) => {
    setStore((prev) => {
      const next = { ...prev }
      delete next[examKey]
      writeJSON(StorageKeys.PROGRESS, next)
      return next
    })
  }, [])

  const getExamStats = useCallback(
    (examKey: string) => {
      const examProgress = store[examKey] ?? {}
      const entries = Object.values(examProgress)
      return {
        total: entries.length,
        answered: entries.filter((p) => p.submittedAt !== null).length,
        correct: entries.filter((p) => p.status === 'correct').length,
        wrong: entries.filter((p) => p.status === 'wrong').length,
        marked: entries.filter((p) => p.marked).length,
      }
    },
    [store],
  )

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === `ky:${StorageKeys.PROGRESS}`) reload()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [reload])

  const value = useMemo<ProgressContextValue>(
    () => ({
      store,
      getProgress,
      selectOption,
      submitAnswer,
      toggleMark,
      resetExam,
      getExamStats,
      reload,
    }),
    [store, getProgress, selectOption, submitAnswer, toggleMark, resetExam, getExamStats, reload],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress() {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress 必须在 ProgressProvider 内使用')
  return ctx
}
