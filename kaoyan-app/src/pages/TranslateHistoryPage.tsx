// 翻译历史页：回顾查过的单词 / 短语 / 长句译文
// 数据来源：translateHistory.ts（localStorage，上限 200 条，最新在前）

import { useEffect, useState } from 'react'
import { History as HistoryIcon, Languages, Trash2, Search, Quote, Inbox } from 'lucide-react'
import type { TranslateHistoryItem } from '../types'
import {
  getTranslateHistory,
  removeTranslateHistoryItem,
  clearTranslateHistory,
} from '../lib/translateHistory'

const KIND_LABEL: Record<string, string> = {
  word: '单词',
  phrase: '短语',
  sentence: '长句',
}

const KIND_ICON: Record<string, typeof Search> = {
  word: Search,
  phrase: Quote,
  sentence: Languages,
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TranslateHistoryPage() {
  const [items, setItems] = useState<TranslateHistoryItem[]>([])
  const [keyword, setKeyword] = useState('')

  function refresh() {
    setItems(getTranslateHistory())
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = keyword.trim()
    ? items.filter(
        (x) =>
          x.text.toLowerCase().includes(keyword.trim().toLowerCase()) ||
          x.translation.includes(keyword.trim()),
      )
    : items

  function handleRemove(id: string) {
    removeTranslateHistoryItem(id)
    refresh()
  }

  function handleClearAll() {
    if (window.confirm('确定清空全部翻译历史吗？此操作不可恢复。')) {
      clearTranslateHistory()
      refresh()
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 animate-fade-in">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <HistoryIcon className="w-5 h-5 text-ochre-dark" />
          <h1 className="font-serif text-3xl font-bold text-ink">译史</h1>
          <span className="text-xs text-ink-muted font-mono ml-1">{items.length} 条</span>
        </div>
        <p className="text-sm text-ink-muted">
          划词翻译与句译的历史记录，方便回顾已翻译内容。最多保留 200 条。
        </p>
      </header>

      {/* 工具栏：搜索 + 清空 */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-ink-muted/50 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索原文或译文…"
              className="w-full pl-8 pr-3 py-2 text-xs bg-paper-deep/50 border border-line rounded-sm
                         focus:outline-none focus:border-ochre/60 focus:ring-1 focus:ring-ochre/30
                         placeholder:text-ink-muted/40"
            />
          </div>
          <button
            onClick={handleClearAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-seal-dark border border-seal/40 rounded-sm hover:bg-seal/5 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-3 h-3" /> 清空
          </button>
        </div>
      )}

      {/* 历史列表 */}
      {items.length === 0 ? (
        <div className="paper-card p-12 text-center">
          <Inbox className="w-10 h-10 mx-auto text-ink-muted/30 mb-3" />
          <p className="font-serif italic text-ink-muted">暂无翻译历史</p>
          <p className="text-xs text-ink-muted/70 mt-1">
            在做题页划词翻译或开启句译模式后，记录会出现在这里。
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="paper-card p-8 text-center">
          <p className="text-sm text-ink-muted">没有匹配「{keyword}」的记录</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const KindIcon = KIND_ICON[item.kind] ?? Languages
            return (
              <li key={item.id} className="paper-card paper-card-hover p-3.5 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {/* 类型 + 来源 + 时间 */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-ochre-dark bg-ochre-pale/60 border border-ochre/30 rounded-sm font-medium">
                        <KindIcon className="w-2.5 h-2.5" />
                        {KIND_LABEL[item.kind] ?? item.kind}
                      </span>
                      <span className="text-[10px] text-ink-muted/60 font-mono">{item.source}</span>
                      <span className="text-[10px] text-ink-muted/50 font-mono ml-auto">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    {/* 原文 */}
                    <p className="font-serif text-sm text-ink leading-relaxed break-words line-clamp-3">
                      {item.text}
                    </p>
                    {/* 译文 */}
                    {item.translation && (
                      <p className="text-xs text-ink-muted leading-relaxed mt-1 pl-2 border-l-2 border-ochre/40 break-words line-clamp-3">
                        {item.translation}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted/50 hover:text-seal p-1 flex-shrink-0"
                    title="删除该条记录"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
