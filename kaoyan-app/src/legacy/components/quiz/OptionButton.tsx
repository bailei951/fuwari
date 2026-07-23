// 选项按钮：未提交可点选，已提交后显示对错状态

import { Check, X } from 'lucide-react'
import type { OptionKey } from '../../types'

interface OptionButtonProps {
  optionKey: OptionKey
  text: string
  selected: boolean
  /** 是否已提交（影响样式与是否可点） */
  submitted: boolean
  /** 是否是正确答案 */
  isCorrect: boolean
  /** 用户选的是否是这个（用于已提交状态下高亮用户错选） */
  isUserChoice: boolean
  disabled?: boolean
  onSelect: (key: OptionKey) => void
}

export default function OptionButton({
  optionKey,
  text,
  selected,
  submitted,
  isCorrect,
  isUserChoice,
  disabled,
  onSelect,
}: OptionButtonProps) {
  // 已提交后的样式判定
  // - 正确答案：绿色高亮
  // - 用户错选的项：红色
  // - 其他：弱化
  let stateClass = ''
  if (submitted) {
    if (isCorrect) {
      stateClass = 'border-green-500 bg-green-50 text-green-900'
    } else if (isUserChoice) {
      stateClass = 'border-seal/60 bg-seal/5 text-seal-dark'
    } else {
      stateClass = 'border-line opacity-60'
    }
  } else if (selected) {
    stateClass = 'border-ochre bg-ochre-pale/60 text-ink'
  } else {
    stateClass = 'border-line hover:border-ochre/60 hover:bg-paper-deep/30'
  }

  return (
    <button
      type="button"
      disabled={disabled || submitted}
      onClick={() => onSelect(optionKey)}
      className={`group w-full text-left flex items-start gap-3 p-3 border rounded-sm transition-all ${stateClass} ${
        disabled || submitted ? 'cursor-default' : 'cursor-pointer'
      }`}
    >
      <span
        className={`flex-shrink-0 w-6 h-6 flex items-center justify-center font-mono font-bold text-sm rounded-sm border ${
          submitted
            ? isCorrect
              ? 'border-green-500 bg-green-500 text-white'
              : isUserChoice
                ? 'border-seal bg-seal text-white'
                : 'border-line text-ink-muted'
            : selected
              ? 'border-ochre bg-ochre text-white'
              : 'border-line text-ink-soft group-hover:border-ochre/60'
        }`}
      >
        {optionKey}
      </span>
      <span className="flex-1 text-sm leading-relaxed pt-0.5">{text}</span>
      {submitted && isCorrect && (
        <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
      )}
      {submitted && isUserChoice && !isCorrect && (
        <X className="w-4 h-4 text-seal flex-shrink-0 mt-0.5" />
      )}
    </button>
  )
}
