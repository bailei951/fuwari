// 卷宗页：展示全部试卷，按英语一/英语二/统一卷分组
// 每张卡片显示：年份、科目、题量、完成度、正确率、错题数

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Library, Filter } from 'lucide-react'
import { getExamIndex } from '../lib/dataLoader'
import { useProgress } from '../context/ProgressContext'
import type { Subject } from '../types'

type FilterKey = 'all' | 'english1' | 'english2' | 'old'

const FILTER_LABELS: Record<FilterKey, string> = {
  all: '全部',
  english1: '英语一',
  english2: '英语二',
  old: '统一卷',
}

function subjectToFilter(subject: Subject): FilterKey {
  if (subject === '英语一') return 'english1'
  if (subject === '英语二') return 'english2'
  return 'old'
}

export default function PapersPage() {
  const index = getExamIndex()
  const { getExamStats } = useProgress()
  const [filter, setFilter] = useState<FilterKey>('all')

  // 按年份降序分组
  const papers = useMemo(() => {
    const filtered = index.exams.filter(
      (e) => filter === 'all' || subjectToFilter(e.subject) === filter,
    )
    return filtered.sort((a, b) => b.year - a.year)
  }, [index, filter])

  // 统计概览
  const overview = useMemo(() => {
    const total = index.exams.length
    let answeredTotal = 0
    let correctTotal = 0
    for (const e of index.exams) {
      const s = getExamStats(e.key)
      answeredTotal += s.answered
      correctTotal += s.correct
    }
    return {
      total,
      answered: answeredTotal,
      correct: correctTotal,
      accuracy: answeredTotal > 0 ? Math.round((correctTotal / answeredTotal) * 100) : 0,
    }
  }, [index, getExamStats])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in">
      {/* 头部 */}
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Library className="w-5 h-5 text-ochre-dark" />
          <h1 className="font-serif text-3xl font-bold text-ink">真题卷宗</h1>
        </div>
        <p className="text-sm text-ink-muted">
          共收录 {overview.total} 套真题，已答 {overview.answered} 题，正确率 {overview.accuracy}%
        </p>
      </header>

      {/* 筛选条 */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-3.5 h-3.5 text-ink-muted" />
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-paper-deep/40 border border-line rounded-sm">
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                filter === key
                  ? 'bg-ink text-paper'
                  : 'text-ink-muted hover:text-ochre-dark'
              }`}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* 卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {papers.map((entry) => {
          const stats = getExamStats(entry.key)
          const total = entry.questionCount
          const answered = stats.answered
          const correct = stats.correct
          const wrong = stats.wrong
          const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0
          const progress = total > 0 ? Math.round((answered / total) * 100) : 0

          return (
            <Link
              key={entry.key}
              to={`/paper/${entry.key}`}
              className="paper-card p-4 hover:shadow-paper-hover hover:border-ochre/40 transition-all group"
            >
              {/* 年份 + 科目 */}
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-2xl font-bold text-ink group-hover:text-ochre-dark transition-colors">
                    {entry.year}
                  </span>
                  <span className="text-xs text-ink-muted">{entry.subject}</span>
                </div>
                <span className="text-[10px] font-mono text-ink-muted">
                  {total}题
                </span>
              </div>

              {/* 进度条 */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] text-ink-muted mb-1">
                  <span>完成进度</span>
                  <span className="font-mono">
                    {answered}/{total}
                  </span>
                </div>
                <div className="h-1.5 bg-paper-deep rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      progress === 100
                        ? 'bg-green-500'
                        : progress > 0
                          ? 'bg-ochre-dark'
                          : ''
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* 统计 */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Stat label="已答" value={answered} />
                <Stat label="正确率" value={`${accuracy}%`} highlight={accuracy >= 60 ? 'good' : accuracy > 0 ? 'bad' : ''} />
                <Stat label="错题" value={wrong} highlight={wrong > 0 ? 'bad' : ''} />
              </div>
            </Link>
          )
        })}
      </div>

      {papers.length === 0 && (
        <div className="paper-card p-12 text-center text-ink-muted">
          没有匹配的试卷
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  highlight = '',
}: {
  label: string
  value: number | string
  highlight?: 'good' | 'bad' | ''
}) {
  const colorClass =
    highlight === 'good'
      ? 'text-green-700'
      : highlight === 'bad'
        ? 'text-seal-dark'
        : 'text-ink'
  return (
    <div className="text-center bg-paper-deep/30 rounded-sm py-1.5">
      <div className={`text-sm font-mono font-bold ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-ink-muted">{label}</div>
    </div>
  )
}
