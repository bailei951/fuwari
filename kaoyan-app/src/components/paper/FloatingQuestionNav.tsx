// 悬浮题号导航：固定定位、可展开/收起的独立面板
// 桌面端 + 移动端通用，替代原右栏侧边栏和移动端底部抽屉
// 默认收起（仅显示迷你状态条），点击展开完整题号网格

import { useEffect, useState, useRef } from 'react'
import { LayoutGrid, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Paper, QuestionStatus } from '../../types'
import QuestionNav from './QuestionNav'

interface FloatingQuestionNavProps {
  paper: Paper
  getStatus: (questionId: number) => QuestionStatus | null
  isMarked: (questionId: number) => boolean
  activeQuestionId: number | null
  currentIndex: number
  totalCount: number
  onQuestionClick: (questionId: number) => void
  onPrev?: (() => void) | null
  onNext?: (() => void) | null
}

export default function FloatingQuestionNav({
  paper,
  getStatus,
  isMarked,
  activeQuestionId,
  currentIndex,
  totalCount,
  onQuestionClick,
  onPrev,
  onNext,
}: FloatingQuestionNavProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // 切换试卷时关闭
  useEffect(() => {
    setOpen(false)
  }, [paper.id])

  // 展开时锁定背景滚动（移动端）
  useEffect(() => {
    if (!open) return
    const isMobile = window.innerWidth < 1024
    if (!isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // 点击外部关闭（桌面端）
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    // 延迟绑定，避免触发面板打开的同一个 click 事件
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onDown)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  function handlePick(qId: number) {
    onQuestionClick(qId)
    setOpen(false)
  }

  return (
    <>
      {/* ── 悬浮状态条（收起态，始终可见） ── */}
      <div className="fixed bottom-3 right-3 z-30 lg:bottom-4 lg:right-4">
        <div className="flex items-center gap-1 paper-card px-1.5 py-1 shadow-paper">
          {/* 上一题 */}
          <button
            onClick={() => onPrev?.()}
            disabled={!onPrev}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-sm text-ink-soft hover:text-ochre-dark hover:bg-ochre-pale/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="上一题"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* 当前位置 + 展开按钮 */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-sm hover:bg-paper-deep/50 transition-colors"
            aria-label={open ? '收起题号导航' : '展开题号导航'}
          >
            <span className="font-mono text-xs font-bold text-ink">
              {currentIndex > 0 ? currentIndex : '-'}
              <span className="text-ink-muted font-normal">/{totalCount}</span>
            </span>
            <LayoutGrid className={`w-3.5 h-3.5 text-ink-muted transition-transform ${open ? 'scale-110' : ''}`} />
          </button>

          {/* 下一题 */}
          <button
            onClick={() => onNext?.()}
            disabled={!onNext}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-sm text-ink-soft hover:text-ochre-dark hover:bg-ochre-pale/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="下一题"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 展开面板 ── */}
      {open && (
        <div
          ref={panelRef}
          className="fixed z-40 paper-card shadow-paper overflow-hidden flex flex-col animate-pop-in
                     bottom-12 right-3 left-3 max-h-[60vh]
                     lg:bottom-14 lg:right-4 lg:left-auto lg:w-72 lg:max-h-[70vh]"
        >
          {/* 头部 */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-paper-deep/30">
            <div className="flex items-baseline gap-2">
              <h2 className="font-serif text-xs font-bold text-ink">题号导航</h2>
              <span className="text-[10px] text-ink-muted font-mono">共 {totalCount} 题</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-ink-muted hover:text-ink rounded-sm hover:bg-paper-deep transition-colors"
              aria-label="关闭"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 题号网格（可滚动） */}
          <div className="flex-1 overflow-y-auto px-3 py-2.5">
            <QuestionNav
              paper={paper}
              getStatus={getStatus}
              isMarked={isMarked}
              activeQuestionId={activeQuestionId}
              onQuestionClick={handlePick}
            />
          </div>

          {/* 底部：上/下题快捷按钮 */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-line bg-paper-deep/20">
            <button
              onClick={() => onPrev?.()}
              disabled={!onPrev}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-ink-soft hover:text-ochre-dark hover:bg-ochre-pale/40 rounded-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> 上一题
            </button>
            <button
              onClick={() => onNext?.()}
              disabled={!onNext}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-ink-soft hover:text-ochre-dark hover:bg-ochre-pale/40 rounded-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              下一题 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
