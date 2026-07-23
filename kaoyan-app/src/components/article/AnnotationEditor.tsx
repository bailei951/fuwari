// 批注编辑器：新建/编辑批注，含笔记输入 + 高亮颜色选择
// 通过 Modal 承载，ESC / 点击遮罩可取消

import { useEffect, useState } from 'react'
import { Highlighter, Check } from 'lucide-react'
import Modal from '../common/Modal'
import type { HighlightColor } from '../../types'

interface AnnotationEditorProps {
  open: boolean
  onClose: () => void
  /** 选中的原文（只读展示） */
  selectedText: string
  initialNote?: string
  initialColor?: HighlightColor
  /** 保存回调，返回是否成功 */
  onSave: (note: string, color: HighlightColor) => void
}

const COLORS: { key: HighlightColor; label: string; swatch: string }[] = [
  { key: 'yellow', label: '赭黄', swatch: 'bg-yellow-300/70' },
  { key: 'green', label: '青绿', swatch: 'bg-green-300/70' },
  { key: 'pink', label: '朱粉', swatch: 'bg-pink-300/70' },
  { key: 'blue', label: '靛蓝', swatch: 'bg-blue-300/70' },
]

export default function AnnotationEditor({
  open,
  onClose,
  selectedText,
  initialNote = '',
  initialColor = 'yellow',
  onSave,
}: AnnotationEditorProps) {
  const [note, setNote] = useState(initialNote)
  const [color, setColor] = useState<HighlightColor>(initialColor)

  // 每次打开时同步初始值
  useEffect(() => {
    if (open) {
      setNote(initialNote)
      setColor(initialColor)
    }
  }, [open, initialNote, initialColor])

  function handleSave() {
    onSave(note.trim(), color)
  }

  // Ctrl/Cmd+Enter 保存
  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="添加批注" maxWidth="max-w-md">
      <div className="space-y-4">
        {/* 选中原文 */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5 text-xs text-ink-muted">
            <Highlighter className="w-3 h-3" />
            <span>选中原文</span>
          </div>
          <blockquote className="text-sm text-ink-soft font-serif italic leading-relaxed pl-3 border-l-2 border-ochre/50 bg-paper-deep/30 py-2 pr-2 rounded-r-sm max-h-32 overflow-y-auto">
            {selectedText || '（无选中文本）'}
          </blockquote>
        </div>

        {/* 笔记 */}
        <div>
          <label className="block text-xs text-ink-muted mb-1.5">批注笔记</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            rows={4}
            placeholder="写下你的理解、翻译或疑问…"
            className="w-full px-3 py-2 text-sm border border-line rounded-sm bg-paper focus:outline-none focus:border-ochre focus:ring-1 focus:ring-ochre/30 resize-none font-serif"
          />
          <p className="text-[10px] text-ink-muted/60 mt-1 font-mono">Ctrl + Enter 保存</p>
        </div>

        {/* 颜色选择 */}
        <div>
          <label className="block text-xs text-ink-muted mb-1.5">高亮颜色</label>
          <div className="flex items-center gap-2">
            {COLORS.map(({ key, label, swatch }) => (
              <button
                key={key}
                onClick={() => setColor(key)}
                className={`group flex items-center gap-1.5 px-2 py-1 rounded-sm border transition-all ${
                  color === key
                    ? 'border-ink shadow-paper'
                    : 'border-line hover:border-ochre'
                }`}
                title={label}
              >
                <span className={`w-4 h-4 rounded-sm ${swatch} border border-black/10`} />
                <span
                  className={`text-xs ${color === key ? 'text-ink font-medium' : 'text-ink-muted'}`}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 操作 */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-soft">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-paper rounded-sm text-xs hover:bg-ochre-dark transition-colors"
          >
            <Check className="w-3 h-3" /> 保存批注
          </button>
        </div>
      </div>
    </Modal>
  )
}
