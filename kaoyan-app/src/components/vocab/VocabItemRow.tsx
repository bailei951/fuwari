// 单个生词条目：序号 + 单词 + 音标 + 释义 + 来源 + 时间 + 删除按钮

import { Link } from 'react-router-dom'
import { Trash2, ArrowRight } from 'lucide-react'
import type { VocabItem } from '../../types'

interface VocabItemRowProps {
  item: VocabItem
  index: number
  onRemove: (id: string) => void
}

export default function VocabItemRow({ item, index, onRemove }: VocabItemRowProps) {
  const [yearStr, subjectStr] = item.source.paperId
    ? item.source.paperId.split('-')
    : ['', '']
  const year = parseInt(yearStr) || null
  const subjectLabel =
    subjectStr === 'english1'
      ? '英语一'
      : subjectStr === 'english2'
        ? '英语二'
        : subjectStr === 'old'
          ? '统一卷'
          : ''

  return (
    <div className="paper-card p-3 group hover:bg-paper-deep/20 transition-colors animate-slide-up">
      <div className="flex items-start gap-3">
        {/* 序号 */}
        <span className="font-mono text-xs text-ochre-dark mt-1 w-6 text-right flex-shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* 主内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className="font-serif font-bold text-ink text-base">{item.word}</span>
            {item.phonetic && (
              <span className="font-mono text-xs text-ochre-dark">{item.phonetic}</span>
            )}
          </div>
          <p className="text-sm text-ink-soft leading-relaxed">{item.meaning}</p>

          {/* 元信息 */}
          <div className="flex items-center gap-3 mt-2 text-xs text-ink-muted">
            <span>添加于 {new Date(item.addedAt).toLocaleDateString('zh-CN')}</span>
            {year && subjectLabel && (
              <Link
                to={`/paper/${item.source.paperId}`}
                className="scholar-tag hover:bg-ochre-pale"
                title="跳转到来源文章"
              >
                来源 {year} {subjectLabel}
                <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            )}
          </div>
        </div>

        {/* 删除按钮 */}
        <button
          onClick={() => onRemove(item.id)}
          className="p-1.5 text-ink-muted hover:text-seal hover:bg-seal/5 rounded-sm transition-colors opacity-0 group-hover:opacity-100"
          title="从生词本移除"
          aria-label={`删除 ${item.word}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
