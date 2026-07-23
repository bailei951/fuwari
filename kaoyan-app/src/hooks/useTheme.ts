// 主题切换 hook：浅色 / 暗色 / 跟随系统，持久化到 localStorage
//
// 使用方式：
//   const { theme, resolvedTheme, setTheme } = useTheme()
//   - theme: 用户偏好（'light' | 'dark' | 'system'）
//   - resolvedTheme: 实际生效的值（'light' | 'dark'）
//   - setTheme: 切换偏好

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'ky:theme'
const VALID_THEMES: Theme[] = ['light', 'dark', 'system']

export const THEME_LABEL: Record<Theme, string> = {
  light: '浅色',
  dark: '暗色',
  system: '跟随系统',
}

/** 获取系统当前偏好 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 将实际主题应用到 html 根元素 */
function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (resolved === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

/** 解析用户偏好 → 实际生效主题 */
function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
      return stored && VALID_THEMES.includes(stored) ? stored : 'system'
    } catch {
      return 'system'
    }
  })

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(theme),
  )

  // 持久化偏好 + 应用到 DOM
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* 忽略 */
    }
    const resolved = resolveTheme(theme)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [theme])

  // 监听系统主题变化（仅当偏好为 system 时跟随）
  useEffect(() => {
    if (theme !== 'system') return
    if (!window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      const resolved: ResolvedTheme = e.matches ? 'dark' : 'light'
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
  }, [])

  const toggle = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, resolvedTheme, setTheme, toggle }
}

/**
 * 在应用挂载前同步设置主题，避免首屏闪烁。
 * 在 main.tsx 顶部调用一次即可。
 */
export function initTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    const theme: Theme = stored && VALID_THEMES.includes(stored) ? stored : 'system'
    const resolved = resolveTheme(theme)
    applyTheme(resolved)
  } catch {
    /* 忽略 */
  }
}
