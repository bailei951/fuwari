// 批注列表：展示当前文章全部批注，支持查看/编辑/删除/清空/跳转
// 编辑弹窗由父组件统一管理（onEdit 回调）

import { useState } from 'react'
import { Highlighter, Pencil, Trash2, ArrowUpRight, Eraser } from 'lucide-react'
import type { Annotation, HighlightColor } from '../../types'

interface AnnotationListProps {
  annotations: Annotation[]
  onEdit: (ann: Annotation) => void
  onRemove: (id: string) => void
  onClearAll: () => void
  /** 跳转到正文高亮（通过 data-annot-id 定位 mark 元素并滚动） */
  onJumpTo?: (id: string) => void
}

const COLOR_LABEL: Record<HighlightColor, string> = {
  yellow: '赭黄',
  green: '青绿',
  pink: '朱粉',
  blue: '靛蓝',
}

const COLOR_DOT: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-400',
  green: 'bg-green-400',
  pink: 'bg-pink-400',
  blue: 'bg-blue-400',
}

export default function AnnotationList({
  annotations,
  onEdit,
  onRemove,
  onClearAll,
  onJumpTo,
}: AnnotationListProps) {
  const [confirmClear, setConfirmClear] = useState(false)

  if (annotations.length === 0) {
    return (
      <div className="mt-6 pt-5 border-t border-line-soft">
        <div className="flex items-center gap-2 mb-2">
          <Highlighter className="w-4 h-4 text-seal" />
          <h3 className="font-serif font-bold text-ink text-sm">我的批注</h3>
          <span className="scholar-tag">0</span>
        </div>
        <p className="text-xs text-ink-muted font-serif italic">
          选中正文中的句子，点击「批注」即可在此记录理解与翻译。
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 pt-5 border-t border-line-soft">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Highlighter className="w-4 h-4 text-seal" />
          <h3 className="font-serif font-bold text-ink text-sm">我的批注</h3>
          <span className="scholar-tag">{annotations.length}</span>
        </div>
        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-seal transition-colors"
            title="清空本文批注"
          >
            <Eraser className="w-3 h-3" /> 清空
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onClearAll()
                setConfirmClear(false)
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-seal text-paper rounded-sm text-xs hover:bg-seal-dark transition-colors"
            >
              确认清空
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-2 py-0.5 text-xs text-ink-muted hover:text-ink transition-colors"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* 批注项 */}
      <ul className="space-y-2">
        {annotations.map((ann) => (
          <li
            key={ann.id}
            className="paper-card p-3 group hover:bg-paper-deep/20 transition-colors animate-slide-up"
          >
            <div className="flex items-start gap-2.5">
              {/* 颜色点 */}
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${COLOR_DOT[ann.color]}`}
                title={COLOR_LABEL[ann.color]}
              />

              <div className="flex-1 min-w-0">
                {/* 原文 */}
                <p className="font-serif italic text-sm text-ink-soft leading-relaxed line-clamp-2">
                  「{ann.text}」
                </p>
                {/* 笔记 */}
                {ann.note ? (
                  <p className="text-sm text-ink mt-1.5 leading-relaxed whitespace-pre-wrap">
                    {ann.note}
                  </p>
                ) : (
                  <p className="text-xs text-ink-muted/60 italic mt-1">（未填写笔记）</p>
                )}
                {/* 元信息 */}
                <div className="flex items-center gap-2 mt-2 text-[10px] text-ink-muted font-mono">
                  <span>{new Date(ann.createdAt).toLocaleString('zh-CN')}</span>
                  <span>·</span>
                  <span>{COLOR_LABEL[ann.color]}</span>
                </div>
              </div>

              {/* 操作 */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {onJumpTo && (
                  <button
                    onClick={() => onJumpTo(ann.id)}
                    className="p-1 text-ink-muted hover:text-ochre-dark hover:bg-ochre/5 rounded-sm transition-colors"
                    title="跳转到原文"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onEdit(ann)}
                  className="p-1 text-ink-muted hover:text-ochre-dark hover:bg-ochre/5 rounded-sm transition-colors"
                  title="编辑批注"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRemove(ann.id)}
                  className="p-1 text-ink-muted hover:text-seal hover:bg-seal/5 rounded-sm transition-colors"
                  title="删除批注"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
