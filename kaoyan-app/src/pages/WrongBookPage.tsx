// 错题本页面：展示错题与标记题，按年份/题型筛选，支持跳转重练
//
// 数据来源：ProgressContext.store → collectWrongItems / collectMarkedItems
// 路由：/wrongbook
// 入口：HistoryPage 顶部卡片、HomePage 快捷入口

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { XCircle, Flag, Loader2, BookOpen, ArrowRight, Filter } from 'lucide-react'
import { useProgress } from '../context/ProgressContext'
import {
  collectWrongItems,
  collectMarkedItems,
  filterItems,
  groupByYear,
  groupByType,
  sortByRecent,
  SECTION_LABEL,
  type WrongItem,
  type WrongGroupByYear,
} from '../lib/wrongBook'
import type { SectionType } from '../types'

type ViewMode = 'wrong' | 'marked'

export default function WrongBookPage() {
  const { store } = useProgress()
  const [mode, setMode] = useState<ViewMode>('wrong')
  const [items, setItems] = useState<WrongItem[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<SectionType | 'all'>('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const collect = mode === 'wrong' ? collectWrongItems : collectMarkedItems
    collect(store)
      .then((list) => {
        if (cancelled) return
        setItems(sortByRecent(list))
        setLoading(false)
      })
      .catch((err) => {
        console.error('[WrongBook] 加载失败', err)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [store, mode])

  // 筛选后的列表
  const filtered = useMemo(() => {
    let list = filterItems(items, mode === 'wrong' ? 'wrong' : 'marked')
    if (yearFilter !== 'all') list = list.filter((i) => i.year === yearFilter)
    if (typeFilter !== 'all') list = list.filter((i) => i.type === typeFilter)
    return list
  }, [items, mode, yearFilter, typeFilter])

  // 按年份分组展示
  const yearGroups = useMemo(() => groupByYear(filtered), [filtered])

  // 类型统计
  const typeStats = useMemo(() => {
    const groups = groupByType(items)
    return groups
  }, [items])

  // 年份列表
  const yearOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.year))
    return Array.from(set).sort((a, b) => b - a)
  }, [items])

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 animate-fade-in">
      {/* 头部 */}
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <XCircle className="w-5 h-5 text-seal-dark" />
          <h1 className="font-serif text-3xl font-bold text-ink">错题本</h1>
        </div>
        <p className="text-sm text-ink-muted">
          集中复习错题与标记题，点击题目可直接跳回原卷重练。
        </p>
      </header>

      {/* 视图切换：错题 / 标记 */}
      <div className="inline-flex items-center gap-0.5 p-0.5 bg-paper-deep/40 border border-line rounded-sm mb-4">
        <button
          onClick={() => setMode('wrong')}
          className={`px-3 py-1 text-xs rounded-sm transition-colors ${
            mode === 'wrong' ? 'bg-seal text-paper' : 'text-ink-muted hover:text-seal-dark'
          }`}
        >
          <XCircle className="w-3 h-3 inline mr-1" />
          错题
        </button>
        <button
          onClick={() => setMode('marked')}
          className={`px-3 py-1 text-xs rounded-sm transition-colors ${
            mode === 'marked' ? 'bg-seal text-paper' : 'text-ink-muted hover:text-seal-dark'
          }`}
        >
          <Flag className="w-3 h-3 inline mr-1" />
          标记题
        </button>
      </div>

      {/* 加载中 */}
      {loading ? (
        <div className="paper-card p-12 text-center text-ink-muted">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
          加载中…
        </div>
      ) : items.length === 0 ? (
        <EmptyState mode={mode} />
      ) : (
        <>
          {/* 题型统计条 */}
          <div className="space-y-2 mb-4">
            {/* 题型筛选 */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-ink text-paper border-ink'
                    : 'border-line text-ink-muted hover:border-ochre hover:text-ochre-dark'
                }`}
              >
                全部题型
                <span className="ml-1 font-mono">{items.length}</span>
              </button>
              {typeStats.map(({ type, items: typeItems }) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                  className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                    typeFilter === type
                      ? 'bg-ink text-paper border-ink'
                      : 'border-line text-ink-muted hover:border-ochre hover:text-ochre-dark'
                  }`}
                >
                  {SECTION_LABEL[type]}
                  <span className="ml-1 font-mono">{typeItems.length}</span>
                </button>
              ))}
            </div>
            {/* 年份筛选 */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3 h-3 text-ink-muted flex-shrink-0" />
              <button
                onClick={() => setYearFilter('all')}
                className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                  yearFilter === 'all'
                    ? 'bg-ink text-paper border-ink'
                    : 'border-line text-ink-muted hover:border-ochre hover:text-ochre-dark'
                }`}
              >
                全部年份
              </button>
              {yearOptions.map((y) => (
                <button
                  key={y}
                  onClick={() => setYearFilter(yearFilter === y ? 'all' : y)}
                  className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                    yearFilter === y
                      ? 'bg-ink text-paper border-ink'
                      : 'border-line text-ink-muted hover:border-ochre hover:text-ochre-dark'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* 列表（按年份分组） */}
          {filtered.length === 0 ? (
            <div className="paper-card p-8 text-center text-ink-muted text-sm">
              当前筛选条件下无题目。
            </div>
          ) : (
            <div className="space-y-6">
              {yearGroups.map((group) => (
                <YearGroup key={group.year} group={group} />
              ))}
            </div>
          )}

          {/* 底部统计 */}
          <div className="mt-8 text-center text-xs text-ink-muted font-mono">
            显示 {filtered.length} / {items.length} 题
            {yearFilter !== 'all' || typeFilter !== 'all' ? (
              <button
                onClick={() => {
                  setYearFilter('all')
                  setTypeFilter('all')
                }}
                className="ml-2 px-2 py-0.5 text-seal-dark hover:bg-seal/5 rounded-sm"
              >
                清除筛选
              </button>
            ) : null}
          </div>
        </>
      )}

      {/* 返回入口 */}
      <div className="mt-8 text-center">
        <Link
          to="/history"
          className="inline-flex items-center gap-1 scholar-tag hover:bg-ochre-pale"
        >
          <BookOpen className="w-3 h-3" /> 返回学习记录
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

// ============================================================
// 年份分组
// ============================================================

function YearGroup({ group }: { group: WrongGroupByYear }) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2 pb-1 border-b border-line">
        <h2 className="font-serif text-lg font-bold text-ink">{group.year}</h2>
        <span className="text-[10px] text-ink-muted font-mono">
          {group.items.length} 题
        </span>
      </div>
      <ul className="space-y-2">
        {group.items.map((item) => (
          <WrongItemRow key={`${item.paperId}-${item.questionId}`} item={item} />
        ))}
      </ul>
    </section>
  )
}

// ============================================================
// 错题条目
// ============================================================

function WrongItemRow({ item }: { item: WrongItem }) {
  const typeLabel = SECTION_LABEL[item.type]
  const questionText =
    item.question ||
    (item.type === 'cloze' ? `（完形第 ${item.questionId} 空）` : `（第 ${item.questionId} 题）`)

  return (
    <li className="paper-card p-3 hover:shadow-paper-hover transition-all group">
      <div className="flex items-start gap-3">
        {/* 题号 */}
        <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center font-mono text-xs font-bold rounded-sm bg-seal/10 text-seal-dark">
          {item.questionId}
        </span>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {/* 题型 + 年份 */}
          <div className="flex items-center gap-2 mb-1 text-[10px] text-ink-muted">
            <span className="scholar-tag text-[10px]">{typeLabel}</span>
            <span className="font-mono">
              {item.year} {item.subject}
            </span>
            {item.marked && (
              <span className="inline-flex items-center gap-0.5 text-seal-dark">
                <Flag className="w-2.5 h-2.5" /> 已标记
              </span>
            )}
          </div>

          {/* 题干 */}
          <p className="text-sm text-ink-soft leading-relaxed mb-2 line-clamp-2">
            {questionText}
          </p>

          {/* 选项简要：仅展示正确答案 + 用户答案 */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-700">
              <span className="font-mono font-bold mr-1">正确</span>
              {item.answer ? `${item.answer}. ${item.options[item.answer] ?? '—'}` : '—'}
            </span>
            {item.userAnswer && item.userAnswer !== item.answer && (
              <span className="text-seal-dark">
                <span className="font-mono font-bold mr-1">你选</span>
                {item.userAnswer}. {item.options[item.userAnswer] ?? '—'}
              </span>
            )}
          </div>
        </div>

        {/* 操作 */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <Link
            to={`/paper/${item.paperId}`}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-ink text-paper rounded-sm hover:bg-ochre-dark transition-colors"
            title="跳回原卷重练"
          >
            <ArrowRight className="w-3 h-3" /> 重练
          </Link>
        </div>
      </div>
    </li>
  )
}

// ============================================================
// 空状态
// ============================================================

function EmptyState({ mode }: { mode: ViewMode }) {
  const isWrong = mode === 'wrong'
  return (
    <div className="paper-card p-12 text-center">
      <div className="inline-flex w-14 h-14 rounded-sm bg-ochre-pale/50 items-center justify-center mb-4">
        {isWrong ? (
          <XCircle className="w-6 h-6 text-ochre-dark" />
        ) : (
          <Flag className="w-6 h-6 text-ochre-dark" />
        )}
      </div>
      <p className="font-serif italic text-ink-muted text-lg mb-1">
        {isWrong ? '尚无错题记录' : '尚无标记题'}
      </p>
      <p className="text-sm text-ink-muted mb-6">
        {isWrong
          ? '做题后答错的题目会自动汇总到这里，便于复习。'
          : '在做题时点击"标记"按钮，可以将不确定的题收藏到此。'}
      </p>
      <Link to="/papers" className="scholar-tag hover:bg-ochre-pale">
        <BookOpen className="w-3 h-3" /> 开始做题
      </Link>
    </div>
  )
}
