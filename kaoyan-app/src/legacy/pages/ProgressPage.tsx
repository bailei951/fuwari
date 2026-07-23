// 学习记录页：全局正确率统计 + 错题回顾 + 标记题回顾
// 数据全部来自 ProgressContext + 已加载的试卷 JSON（用于显示题干 / 答案）

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChartNoAxesColumn,
  Target,
  XCircle,
  CheckCircle2,
  Flag,
  ArrowRight,
  Filter,
  BookOpen,
  RotateCcw,
} from 'lucide-react'
import { loadAllExams, getExamIndex } from '../lib/dataLoader'
import { useProgress } from '../context/ProgressContext'
import AnalysisPanel from '../components/analysis/AnalysisPanel'
import type { Exam, OptionKey, Question, SectionType } from '../types'

type FilterKey = 'wrong' | 'marked' | 'all-submitted'

const SECTION_LABEL: Record<SectionType, string> = {
  cloze: '完形',
  reading: '阅读',
  newType: '新题型',
  translation: '翻译',
  writing: '写作',
}

interface ReviewItem {
  examKey: string
  year: number
  subject: string
  sectionType: SectionType
  question: Question
  userAnswer: OptionKey | null
  status: 'correct' | 'wrong'
  marked: boolean
}

export default function ProgressPage() {
  const { store, reload } = useProgress()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('wrong')
  const [examFilter, setExamFilter] = useState<string>('all')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadAllExams().then((loaded) => {
      if (!cancelled) {
        setExams(loaded)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 全局统计
  const globalStats = useMemo(() => {
    let answered = 0
    let correct = 0
    let wrong = 0
    let marked = 0
    for (const examProgress of Object.values(store)) {
      for (const p of Object.values(examProgress)) {
        if (p.submittedAt) {
          answered++
          if (p.status === 'correct') correct++
          else wrong++
        }
        if (p.marked) marked++
      }
    }
    return { answered, correct, wrong, marked, accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0 }
  }, [store])

  // 各卷宗统计
  const perExamStats = useMemo(() => {
    const index = getExamIndex()
    return index.exams.map((entry) => {
      const examProgress = store[entry.key] ?? {}
      const entries = Object.values(examProgress)
      const answered = entries.filter((p) => p.submittedAt).length
      const correct = entries.filter((p) => p.status === 'correct').length
      const wrong = entries.filter((p) => p.status === 'wrong').length
      const marked = entries.filter((p) => p.marked).length
      return {
        key: entry.key,
        year: entry.year,
        subject: entry.subject,
        total: entry.questionCount,
        answered,
        correct,
        wrong,
        marked,
        accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
      }
    })
  }, [store])

  // 汇总错题 / 标记题
  const reviewItems: ReviewItem[] = useMemo(() => {
    if (exams.length === 0) return []
    const items: ReviewItem[] = []
    for (const exam of exams) {
      const key = `${exam.year}-${exam.subject === '英语一' ? 'english1' : 'english2'}`
      const examProgress = store[key] ?? {}
      for (const section of exam.sections) {
        for (const q of section.questions) {
          const p = examProgress[q.id]
          if (!p || !p.submittedAt) continue
          if (filter === 'wrong' && p.status !== 'wrong') continue
          if (filter === 'marked' && !p.marked) continue
          if (examFilter !== 'all' && key !== examFilter) continue
          items.push({
            examKey: key,
            year: exam.year,
            subject: exam.subject,
            sectionType: section.type,
            question: q,
            userAnswer: p.selected,
            status: p.status as 'correct' | 'wrong',
            marked: p.marked,
          })
        }
      }
    }
    // 错题按时间倒序无法精确（需 submittedAt），此处按题号稳定排序
    items.sort((a, b) => a.year === b.year ? a.question.id - b.question.id : b.year - a.year)
    return items
  }, [exams, store, filter, examFilter])

  function handleResetAll() {
    if (!confirm('确定清空全部做题记录吗？此操作不可恢复，建议先导出存档。')) return
    setResetting(true)
    // 清空全部 progress + recent
    localStorage.removeItem('ky:progress')
    localStorage.removeItem('ky:recent')
    reload()
    setResetting(false)
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center text-ink-muted">
        <ChartNoAxesColumn className="w-8 h-8 mx-auto mb-3 animate-pulse text-ochre-dark/50" />
        正在整理卷宗…
      </div>
    )
  }

  if (globalStats.answered === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex w-14 h-14 rounded-full bg-ochre-pale/50 items-center justify-center mb-4">
          <ChartNoAxesColumn className="w-6 h-6 text-ochre-dark" />
        </div>
        <p className="font-serif italic text-ink-muted text-lg mb-1">尚无记录可阅。</p>
        <p className="text-sm text-ink-muted mb-6">先去完成一些题目，这里会汇集你的对错轨迹。</p>
        <Link to="/exams" className="scholar-tag hover:bg-ochre-pale inline-flex items-center gap-1">
          <BookOpen className="w-3 h-3" /> 翻开卷宗
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 animate-fade-in">
      {/* 页头 */}
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <ChartNoAxesColumn className="w-5 h-5 text-ochre-dark" />
          <h1 className="font-serif text-3xl font-bold text-ink">学习记录</h1>
        </div>
        <p className="text-sm text-ink-muted">
          汇集全部卷宗的作答轨迹，错题可一键回到原题重做。
        </p>
      </header>

      {/* 全局统计卡 */}
      <section className="paper-card p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="已作答" value={globalStats.answered} />
          <Stat label="答对" value={globalStats.correct} tone="green" />
          <Stat label="答错" value={globalStats.wrong} tone="red" />
          <Stat label="正确率" value={`${globalStats.accuracy}%`} tone="ochre" />
          <Stat label="标记题" value={globalStats.marked} tone="ochre" />
        </div>

        {/* 正确率进度条 */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
            <span>整体正确率</span>
            <span className="font-mono">{globalStats.accuracy}%</span>
          </div>
          <div className="h-2.5 bg-paper-deep rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ochre to-ochre-dark transition-all duration-500"
              style={{ width: `${globalStats.accuracy}%` }}
            />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-line-soft flex flex-wrap items-center gap-2">
          <button
            onClick={handleResetAll}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-seal transition-colors disabled:opacity-40"
          >
            <RotateCcw className="w-3 h-3" /> 清空全部记录
          </button>
          <span className="text-xs text-ink-muted/60 ml-auto font-mono">
            建议清空前先导出存档
          </span>
        </div>
      </section>

      {/* 各卷宗统计 */}
      <section className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-4 h-4 text-ochre-dark" />
          <h2 className="font-serif text-lg font-bold text-ink">分卷统计</h2>
          <div className="h-px flex-1 bg-line" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {perExamStats.map((s) => (
            <Link
              key={s.key}
              to={`/exam/${s.key}`}
              className="paper-card paper-card-hover p-4 group block"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-serif text-2xl font-bold text-ochre-dark">
                    {s.year}
                  </span>
                  <span className="ml-2 scholar-tag">{s.subject}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-ochre-dark group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <MiniStat label="已答" value={s.answered} total={s.total} />
                <MiniStat label="对" value={s.correct} tone="green" />
                <MiniStat label="错" value={s.wrong} tone="red" />
                <MiniStat label="标记" value={s.marked} tone="ochre" />
              </div>
              {s.answered > 0 && (
                <div className="mt-3 h-1.5 bg-paper-deep rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-ochre to-ochre-dark"
                    style={{ width: `${s.accuracy}%` }}
                  />
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* 错题 / 标记回顾 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-4 h-4 text-ochre-dark" />
          <h2 className="font-serif text-lg font-bold text-ink">回顾</h2>
          <div className="h-px flex-1 bg-line" />
        </div>

        {/* 筛选器 */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="inline-flex items-center gap-0.5 p-0.5 bg-paper-deep/40 border border-line rounded-sm">
            <FilterBtn active={filter === 'wrong'} onClick={() => setFilter('wrong')} tone="red">
              <XCircle className="w-3 h-3" /> 错题（{globalStats.wrong}）
            </FilterBtn>
            <FilterBtn active={filter === 'marked'} onClick={() => setFilter('marked')} tone="ochre">
              <Flag className="w-3 h-3" /> 标记（{globalStats.marked}）
            </FilterBtn>
            <FilterBtn active={filter === 'all-submitted'} onClick={() => setFilter('all-submitted')}>
              <CheckCircle2 className="w-3 h-3" /> 全部已答（{globalStats.answered}）
            </FilterBtn>
          </div>

          {/* 按卷宗筛选 */}
          <select
            value={examFilter}
            onChange={(e) => setExamFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-line rounded-sm bg-paper text-ink-soft focus:outline-none focus:border-ochre"
          >
            <option value="all">全部卷宗</option>
            {perExamStats.map((s) => (
              <option key={s.key} value={s.key}>
                {s.year} {s.subject}
              </option>
            ))}
          </select>
        </div>

        {/* 题目列表 */}
        {reviewItems.length === 0 ? (
          <div className="paper-card p-10 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-green-500/60" />
            <p className="font-serif italic text-ink-muted">
              {filter === 'wrong' ? '没有错题，干得漂亮。' : filter === 'marked' ? '尚未标记任何题。' : '该筛选下暂无记录。'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewItems.map((item) => (
              <ReviewCard key={`${item.examKey}-${item.question.id}`} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ReviewCard({ item }: { item: ReviewItem }) {
  const [expanded, setExpanded] = useState(false)
  const sectionRoute =
    item.sectionType === 'reading' ? 'reading' : item.sectionType

  return (
    <div className="paper-card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-serif font-bold text-ochre-dark text-lg">
            {item.question.id}.
          </span>
          <span className="scholar-tag">{item.year} {item.subject}</span>
          <span className="scholar-tag">{SECTION_LABEL[item.sectionType]}</span>
          {item.status === 'wrong' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-seal-dark bg-seal/10 border border-seal/30 rounded-sm">
              <XCircle className="w-2.5 h-2.5" /> 错
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-green-700 bg-green-100 border border-green-300 rounded-sm">
              <CheckCircle2 className="w-2.5 h-2.5" /> 对
            </span>
          )}
          {item.marked && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-ochre-dark bg-ochre-pale/60 border border-ochre/30 rounded-sm">
              <Flag className="w-2.5 h-2.5" /> 标
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-ochre-dark hover:underline"
          >
            {expanded ? '收起' : '展开'}
          </button>
          <Link
            to={`/exam/${item.examKey}/${sectionRoute}`}
            className="scholar-tag hover:bg-ochre-pale inline-flex items-center gap-0.5"
          >
            重做 <ArrowRight className="w-2.5 h-2.5" />
          </Link>
        </div>
      </div>

      {/* 题干 */}
      {item.question.question && (
        <p className="text-sm text-ink-soft leading-relaxed mb-2">{item.question.question}</p>
      )}

      {/* 你的答案 / 正确答案 */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-ink-muted">
          你的答案：
          <span
            className={`ml-1 px-1.5 py-0.5 font-mono font-bold rounded-sm border ${
              item.userAnswer === item.question.answer
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-seal/40 bg-seal/5 text-seal-dark'
            }`}
          >
            {item.userAnswer ?? '—'}
          </span>
        </span>
        <span className="text-ink-muted">
          正确答案：
          <span className="ml-1 px-1.5 py-0.5 font-mono font-bold rounded-sm border border-green-300 bg-green-100 text-green-700">
            {item.question.answer}
          </span>
        </span>
      </div>

      {/* 展开解析 */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-line-soft animate-slide-up">
          <AnalysisPanel question={item.question} userAnswer={item.userAnswer} />
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number | string
  tone?: 'default' | 'green' | 'red' | 'ochre'
}) {
  const colorMap = {
    default: 'text-ink',
    green: 'text-green-700',
    red: 'text-seal-dark',
    ochre: 'text-ochre-dark',
  } as const
  return (
    <div className="text-center">
      <div className={`text-3xl font-serif font-bold ${colorMap[tone]}`}>{value}</div>
      <div className="text-xs text-ink-muted mt-0.5">{label}</div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  total,
  tone = 'default',
}: {
  label: string
  value: number
  total?: number
  tone?: 'default' | 'green' | 'red' | 'ochre'
}) {
  const colorMap = {
    default: 'text-ink',
    green: 'text-green-700',
    red: 'text-seal-dark',
    ochre: 'text-ochre-dark',
  } as const
  return (
    <div className="text-center">
      <div className={`font-serif font-bold ${colorMap[tone]}`}>
        {value}
        {total !== undefined && <span className="text-ink-muted text-[10px]">/{total}</span>}
      </div>
      <div className="text-[10px] text-ink-muted">{label}</div>
    </div>
  )
}

function FilterBtn({
  active,
  onClick,
  children,
  tone = 'default',
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  tone?: 'default' | 'green' | 'red' | 'ochre'
}) {
  const activeColor = {
    default: 'bg-paper text-ink shadow-paper',
    green: 'bg-green-100 text-green-800',
    red: 'bg-seal/10 text-seal-dark',
    ochre: 'bg-ochre-pale/60 text-ochre-dark',
  }[tone]
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-sm transition-all ${
        active ? activeColor : 'text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
