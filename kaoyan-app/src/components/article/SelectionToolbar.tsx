// 选区浮动工具条：选中文本后浮起，提供「查词」「批注」两个动作
// 查词：仅对单个英文单词可用；批注：任意 2 字符以上选区可用

import { BookOpen, Highlighter } from 'lucide-react'

interface SelectionToolbarProps {
  /** 选中的文本 */
  text: string
  /** 定位锚点（相对视口） */
  rect: DOMRect
  /** 点击「查词」 */
  onLookup: () => void
  /** 点击「批注」（不传则隐藏按钮，如完形文章） */
  onAnnotate?: () => void
}

/** 是否可查词：单个英文单词 */
export function isLookupable(text: string): boolean {
  return /^[a-zA-Z][a-zA-Z'-]*$/.test(text.trim())
}

/** 是否可批注：长度 >= 2 */
export function isAnnotatable(text: string): boolean {
  return text.trim().length >= 2
}

export default function SelectionToolbar({
  text,
  rect,
  onLookup,
  onAnnotate,
}: SelectionToolbarProps) {
  const canLookup = isLookupable(text)
  const canAnnotate = isAnnotatable(text)

  // 定位：默认在选区上方
  const margin = 6
  let top = rect.top - 36 - margin
  if (top < margin) top = rect.bottom + margin

  // 水平居中于选区
  const toolbarWidth = onAnnotate ? 132 : 72
  let left = rect.left + rect.width / 2 - toolbarWidth / 2
  left = Math.max(margin, Math.min(left, window.innerWidth - toolbarWidth - margin))

  return (
    <div
      data-selection-toolbar
      className="fixed z-50 flex items-center gap-0.5 bg-ink text-paper rounded-sm shadow-paper-hover animate-pop-in"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      <button
        onClick={onLookup}
        disabled={!canLookup}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs hover:bg-ochre-dark rounded-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title={canLookup ? '查词' : '仅单个英文单词可查词'}
      >
        <BookOpen className="w-3 h-3" /> 查词
      </button>
      {onAnnotate && (
        <>
          <span className="w-px h-3 bg-paper/20" />
          <button
            onClick={onAnnotate}
            disabled={!canAnnotate}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs hover:bg-seal rounded-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={canAnnotate ? '添加批注' : '选区过短'}
          >
            <Highlighter className="w-3 h-3" /> 批注
          </button>
        </>
      )}
    </div>
  )
}
