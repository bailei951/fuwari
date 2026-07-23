// 移动端底部题号抽屉（lg 以下显示）
// 桌面端右栏题号导航的替代方案
// 点击底部条 → 从底部滑入抽屉，展示完整题号网格
// 选择题号或点击遮罩后自动关闭

import { useEffect, useState } from 'react'
import { LayoutGrid, X } from 'lucide-react'
import type { Paper, QuestionStatus } from '../../types'
import QuestionNav from './QuestionNav'

interface MobileQuestionNavProps {
  paper: Paper
  getStatus: (questionId: number) => QuestionStatus | null
  isMarked: (questionId: number) => boolean
  activeQuestionId: number | null
  currentIndex: number
  totalCount: number
  onQuestionClick: (questionId: number) => void
}

export default function MobileQuestionNav({
  paper,
  getStatus,
  isMarked,
  activeQuestionId,
  currentIndex,
  totalCount,
  onQuestionClick,
}: MobileQuestionNavProps) {
  const [open, setOpen] = useState(false)

  // 切换试卷时关闭抽屉
  useEffect(() => {
    setOpen(false)
  }, [paper.id])

  // 抽屉打开时锁定背景滚动
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
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

  function handlePick(qId: number) {
    onQuestionClick(qId)
    setOpen(false)
  }

  return (
    <>
      {/* 底部悬浮条（lg 以下显示） */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-paper/95 backdrop-blur-sm shadow-paper">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-xs text-ink-muted">当前</span>
            <span className="font-mono text-sm font-bold text-ink">
              {currentIndex > 0 ? currentIndex : '-'}
              <span className="text-ink-muted">/{totalCount}</span>
            </span>
            {activeQuestionId != null && (
              <span className="text-[10px] text-ink-muted/80 font-mono">
                · 第 {activeQuestionId} 题
              </span>
            )}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-ink text-paper rounded-sm hover:bg-ochre-dark transition-colors"
            aria-label="打开题号导航"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            题号
          </button>
        </div>
      </div>

      {/* 抽屉遮罩 + 面板 */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* 面板 */}
          <div className="absolute bottom-0 inset-x-0 max-h-[75vh] bg-paper rounded-t-lg shadow-paper overflow-hidden flex flex-col animate-slide-up">
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-paper-deep/30">
              <div className="flex items-baseline gap-2">
                <h2 className="font-serif text-sm font-bold text-ink">题号导航</h2>
                <span className="text-[10px] text-ink-muted font-mono">
                  共 {totalCount} 题
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-ink-muted hover:text-ink rounded-sm hover:bg-paper-deep transition-colors"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* 提示 */}
            <div className="px-4 py-1.5 text-[10px] text-ink-muted/70 font-mono border-b border-line-soft">
              快捷键 A-D 选 · Enter 提交 · ← → 切题 · M 标记
            </div>
            {/* 题号网格（可滚动） */}
            <div className="flex-1 overflow-y-auto px-4 py-3 pb-6">
              <QuestionNav
                paper={paper}
                getStatus={getStatus}
                isMarked={isMarked}
                activeQuestionId={activeQuestionId}
                onQuestionClick={handlePick}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
