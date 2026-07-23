// 试卷阅读顶部栏：返回 + 标题 + 重置当前试卷答题 + 分区导航
// 仅保留核心答题功能（移除原卷/学习模式切换与字号控制）

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RotateCcw, AlertTriangle } from 'lucide-react'
import Modal from '../common/Modal'
import type { Paper, Section } from '../../types'

interface PaperHeaderProps {
  paper: Paper
  sections: Section[]
  onSectionJump: (sectionId: string) => void
  /** 重置当前试卷全部答题进度 */
  onReset: () => void
  /** 已作答题数（用于确认提示） */
  answeredCount: number
}

const SECTION_SHORT_LABEL: Record<string, string> = {
  cloze: '完形',
  reading: '阅读',
  newType: '新题型',
  translation: '翻译',
  writing: '作文',
}

export default function PaperHeader({
  paper,
  sections,
  onSectionJump,
  onReset,
  answeredCount,
}: PaperHeaderProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <header className="flex-shrink-0 border-b border-line bg-paper/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* 返回 */}
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ochre-dark transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">目录</span>
        </Link>

        {/* 标题 */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="font-serif text-sm sm:text-base font-bold text-ink truncate">
            {paper.year} {paper.subject}
          </h1>
          <span className="hidden md:inline text-xs text-ink-muted font-mono">
            {paper.sections.reduce((sum, s) => sum + s.questions.length, 0)} 题
          </span>
        </div>

        {/* 重置当前试卷答题 */}
        <button
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-ink-muted hover:text-seal-dark hover:bg-seal/5 border border-line rounded-sm transition-colors flex-shrink-0"
          title="重置当前试卷答题情况"
        >
          <RotateCcw className="w-3 h-3" />
          <span className="hidden sm:inline">重置答题</span>
        </button>
      </div>

      {/* 分区快捷导航 */}
      <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {sections.map((sec) => (
          <button
            key={sec.id}
            onClick={() => onSectionJump(sec.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-ink-muted hover:text-ochre-dark hover:bg-ochre-pale/40 rounded-sm transition-colors whitespace-nowrap"
          >
            {SECTION_SHORT_LABEL[sec.type] ?? sec.title}
            <span className="font-mono text-[10px] text-ink-muted/60">
              {sec.questions.length}
            </span>
          </button>
        ))}
      </div>

      {/* 重置确认 */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="重置当前试卷答题情况"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-seal-dark flex-shrink-0 mt-0.5" />
            <div className="text-sm text-ink-soft leading-relaxed">
              此操作将清除 <span className="font-bold text-ink">{paper.year} {paper.subject}</span> 的
              <span className="font-mono font-bold text-seal-dark"> {answeredCount} </span>
              条答题记录（含选中、对错、标记、主观题作答），且不可恢复。
            </div>
          </div>
          <p className="text-xs text-ink-muted">重置后试卷将恢复初始未作答状态。</p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink border border-line rounded-sm transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                onReset()
                setConfirmOpen(false)
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-seal text-paper rounded-sm hover:bg-seal-dark transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> 确认重置
            </button>
          </div>
        </div>
      </Modal>
    </header>
  )
}
