// 字号控制：放大/缩小/重置 三按钮

import { Minus, Plus, RotateCcw, Type } from 'lucide-react'
import { FONT_SCALE_LABEL, type FontScale } from '../../hooks/useFontScale'

interface FontSizeControlProps {
  scale: FontScale
  onIncrease: () => void
  onDecrease: () => void
  onReset: () => void
}

export default function FontSizeControl({
  scale,
  onIncrease,
  onDecrease,
  onReset,
}: FontSizeControlProps) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 bg-paper-deep/40 border border-line rounded-sm">
      <span className="px-2 text-xs text-ink-muted font-mono flex items-center gap-1">
        <Type className="w-3 h-3" /> 字号
      </span>
      <button
        onClick={onDecrease}
        disabled={scale === 'xs'}
        className="w-7 h-7 flex items-center justify-center text-ink-soft hover:bg-paper hover:text-ochre-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="缩小字号"
        title="缩小"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="px-1.5 text-xs font-serif text-ochre-dark min-w-[2.5rem] text-center">
        {FONT_SCALE_LABEL[scale]}
      </span>
      <button
        onClick={onIncrease}
        disabled={scale === 'xl'}
        className="w-7 h-7 flex items-center justify-center text-ink-soft hover:bg-paper hover:text-ochre-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="放大字号"
        title="放大"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onReset}
        className="w-7 h-7 flex items-center justify-center text-ink-muted hover:bg-paper hover:text-seal transition-colors"
        aria-label="重置字号"
        title="重置"
      >
        <RotateCcw className="w-3 h-3" />
      </button>
    </div>
  )
}
