// 题目状态徽章：未答 / 已答 / 正确 / 错误 / 已标记

import { Circle, CheckCircle2, XCircle, Bookmark, BookmarkCheck } from 'lucide-react'
import type { QuestionProgress } from '../../types'

interface AnswerBadgeProps {
  progress: QuestionProgress
  correctAnswer?: string // 显示正确答案用
}

export default function AnswerBadge({ progress, correctAnswer }: AnswerBadgeProps) {
  const { status, submittedAt, marked } = progress

  if (marked && !submittedAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-ochre-pale/60 text-ochre-dark border border-ochre/30 rounded-sm">
        <BookmarkCheck className="w-3 h-3" /> 已标记
      </span>
    )
  }

  if (!submittedAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-ink-muted border border-line rounded-sm">
        <Circle className="w-3 h-3" /> 未答
      </span>
    )
  }

  if (status === 'correct') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-sm">
        <CheckCircle2 className="w-3 h-3" /> 答对
        {marked && <BookmarkCheck className="w-3 h-3 ml-1" />}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-seal/5 text-seal-dark border border-seal/30 rounded-sm">
      <XCircle className="w-3 h-3" /> 答错
      {correctAnswer && (
        <span className="ml-1 font-mono">正确 {correctAnswer}</span>
      )}
      {marked && <BookmarkCheck className="w-3 h-3 ml-1" />}
    </span>
  )
}

interface MarkButtonProps {
  marked: boolean
  onToggle: () => void
}

export function MarkButton({ marked, onToggle }: MarkButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-sm border transition-all ${
        marked
          ? 'bg-ochre-pale/60 text-ochre-dark border-ochre/40'
          : 'text-ink-muted border-line hover:border-ochre hover:text-ochre-dark'
      }`}
      title={marked ? '取消标记' : '标记此题'}
    >
      {marked ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
      {marked ? '已标记' : '标记'}
    </button>
  )
}
