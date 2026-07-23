// 划词监听 hook：在指定容器内监听 mouseup，返回选中的文本 + 浮起坐标 + Range
// 默认捕获任意选区（含中文），供查词 / 批注共用

import { useCallback, useEffect, useState } from 'react'

export interface SelectionInfo {
  /** 选中的文本（已 trim） */
  text: string
  /** 浮窗定位锚点（相对视口） */
  rect: DOMRect
  /** 原始选区 Range（用于批注偏移计算） */
  range: Range
}

interface UseTextSelectionOptions {
  /** 仅匹配纯英文单词时才触发（查词场景） */
  englishOnly?: boolean
  /** 选区最小长度 */
  minLength?: number
}

/**
 * 监听容器内的选区变化
 * @param ref 容器引用
 * @returns 当前选区信息（无则 null） + clear 方法
 */
export function useTextSelection(
  ref: React.RefObject<HTMLElement>,
  options: UseTextSelectionOptions = {},
) {
  const { englishOnly = false, minLength = 1 } = options
  const [selection, setSelection] = useState<SelectionInfo | null>(null)

  const handleMouseUp = useCallback(() => {
    // 微延迟，确保 selection 已更新
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null)
        return
      }
      const text = sel.toString().trim()
      if (text.length < minLength) {
        setSelection(null)
        return
      }
      // 仅匹配英文单词/短语（取首个 token 判断）
      if (englishOnly && !/^[a-zA-Z][a-zA-Z'-]*$/.test(text.split(/\s+/)[0] ?? '')) {
        setSelection(null)
        return
      }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        setSelection(null)
        return
      }
      setSelection({ text, rect, range })
    }, 10)
  }, [englishOnly, minLength])

  const clear = useCallback(() => {
    setSelection(null)
    const sel = window.getSelection()
    sel?.removeAllRanges()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('mouseup', handleMouseUp)
    // 触摸支持
    el.addEventListener('touchend', handleMouseUp)
    return () => {
      el.removeEventListener('mouseup', handleMouseUp)
      el.removeEventListener('touchend', handleMouseUp)
    }
  }, [ref, handleMouseUp])

  // 点击容器外时清除
  useEffect(() => {
    if (!selection) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      const el = ref.current
      // 点击在容器外 且 不在弹窗/工具条内时清除
      if (
        el &&
        !el.contains(target) &&
        !(target as HTMLElement).closest('[data-word-popup]') &&
        !(target as HTMLElement).closest('[data-selection-toolbar]')
      ) {
        setSelection(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [selection, ref])

  return { selection, clear }
}
