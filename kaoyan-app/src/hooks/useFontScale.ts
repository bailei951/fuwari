// 字号调整 hook：5 档可选，持久化到 localStorage

import { useCallback, useEffect, useState } from 'react'

export type FontScale = 'xs' | 'sm' | 'base' | 'lg' | 'xl'

const ORDER: FontScale[] = ['xs', 'sm', 'base', 'lg', 'xl']
const STORAGE_KEY = 'ky:fontScale'

export const FONT_SCALE_LABEL: Record<FontScale, string> = {
  xs: '小',
  sm: '较小',
  base: '标准',
  lg: '较大',
  xl: '大',
}

export const FONT_SCALE_CLASS: Record<FontScale, string> = {
  xs: 'text-article-xs',
  sm: 'text-article-sm',
  base: 'text-article-base',
  lg: 'text-article-lg',
  xl: 'text-article-xl',
}

export function useFontScale(defaultScale: FontScale = 'base') {
  const [scale, setScale] = useState<FontScale>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as FontScale | null
      return stored && ORDER.includes(stored) ? stored : defaultScale
    } catch {
      return defaultScale
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, scale)
    } catch {
      /* 忽略 */
    }
  }, [scale])

  const increase = useCallback(() => {
    setScale((prev) => {
      const idx = ORDER.indexOf(prev)
      return idx < ORDER.length - 1 ? ORDER[idx + 1] : prev
    })
  }, [])

  const decrease = useCallback(() => {
    setScale((prev) => {
      const idx = ORDER.indexOf(prev)
      return idx > 0 ? ORDER[idx - 1] : prev
    })
  }, [])

  const reset = useCallback(() => setScale('base'), [])

  return { scale, setScale, increase, decrease, reset, className: FONT_SCALE_CLASS[scale] }
}
