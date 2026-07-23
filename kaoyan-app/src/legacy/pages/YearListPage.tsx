// 年份卷宗列表页：英语一/英语二筛选 + 年份卡片

import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Filter, Library } from 'lucide-react'
import { getExamIndex } from '../lib/dataLoader'
import { useProgress } from '../context/ProgressContext'
import type { Subject } from '../types'

type FilterKey = 'all' | '英语一' | '英语二'

export default function YearListPage() {
  const index = getExamIndex()
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = (searchParams.get('subject') as FilterKey | null) ?? 'all'
  const [filter, setFilter] = useState<FilterKey>(initial)
  const { getExamStats } = useProgress()

  const filteredExams = useMemo(() => {
    const list = filter === 'all' ? index.exams : index.exams.filter((e) => e.subject === filter)
    return [...list].sort((a, b) => b.year - a.year)
  }, [index, filter])

  function setFilterAndUrl(next: FilterKey) {
    setFilter(next)
    if (next === 'all') setSearchParams({})
    else setSearchParams({ subject: next })
  }

  const counts = {
    all: index.exams.length,
    '英语一': index.exams.filter((e) => e.subject === '英语一').length,
    '英语二': index.exams.filter((e) => e.subject === '英语二').length,
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Library className="w-5 h-5 text-ochre-dark" />
          <h1 className="font-serif text-3xl font-bold text-ink">卷宗目录</h1>
        </div>
        <p className="text-sm text-ink-muted">
          选择年份与科目，进入对应试卷。所有真题均按官方结构拆分存储。
        </p>
      </header>

      {/* 筛选条 */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="scholar-tag">
          <Filter className="w-3 h-3" /> 筛选
        </span>
        {(['all', '英语一', '英语二'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilterAndUrl(key)}
            className={`px-3 py-1.5 rounded-sm text-sm border transition-all ${
              filter === key
                ? 'bg-ink text-paper border-ink'
                : 'bg-paper text-ink-soft border-line hover:border-ochre hover:text-ochre-dark'
            }`}
          >
            {key === 'all' ? '全部' : key}
            <span className="ml-1.5 text-xs opacity-70 font-mono">{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* 年份卡片网格 */}
      {filteredExams.length === 0 ? (
        <div className="paper-card p-12 text-center">
          <Library className="w-8 h-8 text-ink-muted/40 mx-auto mb-3" />
          <p className="text-ink-muted">该筛选下暂无卷宗。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map((entry, i) => {
            const stats = getExamStats(entry.key)
            const subjectLabel: Subject = entry.subject
            const completionPct =
              stats.total > 0 ? Math.round((stats.answered / entry.questionCount) * 100) : 0

            return (
              <Link
                key={entry.key}
                to={`/exam/${entry.key}`}
                className="paper-card paper-card-hover p-5 group block animate-slide-up relative overflow-hidden"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {/* 年份大数字水印 */}
                <div className="absolute -right-2 -top-3 font-serif font-bold text-7xl text-ochre/8 select-none pointer-events-none">
                  {entry.year}
                </div>

                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <span className="font-serif text-2xl font-bold text-ink">{entry.year}</span>
                    <span className={subjectLabel === '英语一' ? 'stamp-badge' : 'scholar-tag'}>
                      {subjectLabel}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {entry.sections.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] px-1.5 py-0.5 bg-paper-deep/60 text-ink-muted rounded-sm font-mono"
                      >
                        {sectionLabel(s)}
                      </span>
                    ))}
                  </div>

                  {/* 进度条 */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-ink-muted">进度</span>
                      <span className="font-mono text-ochre-dark">{completionPct}%</span>
                    </div>
                    <div className="h-1.5 bg-paper-deep rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-ochre to-ochre-dark transition-all"
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-line-soft">
                    <span className="text-xs text-ink-muted">
                      已答 {stats.answered} / {entry.questionCount}
                    </span>
                    <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-ochre-dark group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function sectionLabel(type: string): string {
  const map: Record<string, string> = {
    cloze: '完形',
    reading: '阅读',
    newType: '新题型',
    translation: '翻译',
    writing: '写作',
  }
  return map[type] ?? type
}
