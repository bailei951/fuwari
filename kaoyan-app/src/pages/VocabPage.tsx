// 生词本页面：列表 + 搜索 + 排序 + PDF 导出 + 清空

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotebookPen, Search, Trash2, ArrowRight, BookOpen } from 'lucide-react'
import VocabItemRow from '../components/vocab/VocabItemRow'
import ExportPdfButton from '../components/vocab/ExportPdfButton'
import { useVocab } from '../context/VocabContext'

type SortKey = 'recent' | 'alpha' | 'source'

const SORT_LABELS: Record<SortKey, string> = {
  recent: '最近添加',
  alpha: '字母序',
  source: '按来源',
}

export default function VocabPage() {
  const { words, removeWord, clearAll } = useVocab()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [confirmClear, setConfirmClear] = useState(false)

  // 筛选 + 排序
  const displayWords = useMemo(() => {
    let list = words
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (w) =>
          w.word.toLowerCase().includes(q) ||
          w.meaning.toLowerCase().includes(q),
      )
    }
    const sorted = [...list]
    switch (sort) {
      case 'recent':
        sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
        break
      case 'alpha':
        sorted.sort((a, b) => a.word.localeCompare(b.word, 'en'))
        break
      case 'source':
        sorted.sort((a, b) => (a.source.paperId ?? '').localeCompare(b.source.paperId ?? ''))
        break
    }
    return sorted
  }, [words, search, sort])

  // 统计
  const stats = useMemo(() => {
    const sources = new Set(words.map((w) => w.source.paperId).filter(Boolean))
    const earliest = words.reduce(
      (min, w) => (w.addedAt < min ? w.addedAt : min),
      words[0]?.addedAt ?? '',
    )
    return {
      total: words.length,
      sources: sources.size,
      earliest: earliest ? new Date(earliest).toLocaleDateString('zh-CN') : '—',
    }
  }, [words])

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 animate-fade-in">
      {/* 头部 */}
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <NotebookPen className="w-5 h-5 text-ochre-dark" />
              <h1 className="font-serif text-3xl font-bold text-ink">生词本</h1>
            </div>
            <p className="text-sm text-ink-muted">
              收录自真题文章的生词，可导出 PDF 离线背诵。
            </p>
          </div>
          <ExportPdfButton words={words} />
        </div>

        {/* 统计条 */}
        {words.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-5">
            <StatCell label="收录词条" value={stats.total} />
            <StatCell label="来源文章" value={stats.sources} />
            <StatCell label="最早添加" value={stats.earliest} />
          </div>
        )}
      </header>

      {words.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* 工具条 */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索单词或释义…"
                className="w-full pl-9 pr-3 py-2 bg-paper border border-line rounded-sm text-sm focus:outline-none focus:border-ochre"
              />
            </div>

            {/* 排序 */}
            <div className="inline-flex items-center gap-0.5 p-0.5 bg-paper-deep/40 border border-line rounded-sm">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                    sort === key
                      ? 'bg-ink text-paper'
                      : 'text-ink-muted hover:text-ochre-dark'
                  }`}
                >
                  {SORT_LABELS[key]}
                </button>
              ))}
            </div>

            <button
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-ink-muted border border-line rounded-sm hover:text-seal hover:border-seal/40 transition-all"
              title="清空全部生词"
            >
              <Trash2 className="w-3 h-3" /> 清空
            </button>
          </div>

          {/* 确认清空 */}
          {confirmClear && (
            <div className="paper-card p-4 mb-4 border-seal/40 bg-seal/5 animate-slide-up">
              <div className="flex items-center gap-3">
                <Trash2 className="w-4 h-4 text-seal flex-shrink-0" />
                <p className="text-sm text-ink-soft flex-1">
                  确定清空全部 {words.length} 个生词吗？此操作不可恢复，建议先导出 PDF。
                </p>
                <button
                  onClick={() => {
                    clearAll()
                    setConfirmClear(false)
                  }}
                  className="px-3 py-1.5 bg-seal text-paper rounded-sm text-xs hover:bg-seal-dark"
                >
                  确认清空
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1.5 text-ink-muted text-xs hover:text-ink"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 列表 */}
          {displayWords.length === 0 ? (
            <div className="paper-card p-8 text-center text-ink-muted text-sm">
              未找到匹配「{search}」的生词。
            </div>
          ) : (
            <div className="space-y-2">
              {displayWords.map((item, i) => (
                <VocabItemRow
                  key={item.id}
                  item={item}
                  index={i}
                  onRemove={removeWord}
                />
              ))}
            </div>
          )}

          {/* 底部统计 */}
          <div className="mt-6 text-center text-xs text-ink-muted font-mono">
            显示 {displayWords.length} / {words.length} 词
          </div>
        </>
      )}

      {/* 返回入口 */}
      <div className="mt-8 text-center">
        <Link
          to="/papers"
          className="inline-flex items-center gap-1 scholar-tag hover:bg-ochre-pale"
        >
          <BookOpen className="w-3 h-3" /> 回到卷宗添加更多生词
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="paper-card p-3 text-center">
      <div className="text-2xl font-serif font-bold text-ochre-dark">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="paper-card p-12 text-center">
      <div className="inline-flex w-14 h-14 rounded-sm bg-ochre-pale/50 items-center justify-center mb-4">
        <NotebookPen className="w-6 h-6 text-ochre-dark" />
      </div>
      <p className="font-serif italic text-ink-muted text-lg mb-1">生词本尚空</p>
      <p className="text-sm text-ink-muted mb-6">
        在阅读文章时，划选英文单词即可加入生词本。
      </p>
      <Link to="/papers" className="scholar-tag hover:bg-ochre-pale">
        <BookOpen className="w-3 h-3" /> 开始阅读
      </Link>
    </div>
  )
}
