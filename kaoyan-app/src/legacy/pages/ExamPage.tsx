// 试卷详情页：展示该卷所有题型分区 + 进度统计
// 进入时记录到 recent

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Target, RotateCcw, ArrowRight, AlertCircle } from 'lucide-react'
import { loadExam, getIndexByKey } from '../lib/dataLoader'
import { useProgress } from '../context/ProgressContext'
import { useRecent } from '../context/RecentContext'
import type { Exam, SectionType } from '../types'

const SECTION_META: Record<
  SectionType,
  { label: string; desc: string; icon: string }
> = {
  cloze: { label: '英语知识运用', desc: '完形填空', icon: '◼' },
  reading: { label: '阅读理解', desc: '阅读 Part A', icon: '▤' },
  newType: { label: '新题型', desc: '阅读 Part B', icon: '▦' },
  translation: { label: '翻译', desc: '英译汉', icon: '◑' },
  writing: { label: '写作', desc: '短文写作', icon: '◆' },
}

export default function ExamPage() {
  const { examKey = '' } = useParams<{ examKey: string }>()
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)

  const { getExamStats, resetExam } = useProgress()
  const { pushRecent } = useRecent()

  const indexEntry = getIndexByKey(examKey)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadExam(examKey).then((loaded) => {
      if (!cancelled) {
        setExam(loaded)
        setLoading(false)
        if (loaded) pushRecent(examKey)
      }
    })
    return () => {
      cancelled = true
    }
  }, [examKey, pushRecent])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center text-ink-muted">
        <Clock className="w-8 h-8 mx-auto mb-3 animate-pulse text-ochre-dark/50" />
        正在翻开卷宗…
      </div>
    )
  }

  if (!exam || !indexEntry) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-4 text-seal/60" />
        <p className="font-serif text-xl text-ink mb-2">未找到该卷宗</p>
        <p className="text-sm text-ink-muted mb-6">key: {examKey}</p>
        <Link to="/exams" className="scholar-tag hover:bg-ochre-pale">
          <ArrowLeft className="w-3 h-3" /> 返回卷宗目录
        </Link>
      </div>
    )
  }

  const stats = getExamStats(examKey)
  const completionPct = Math.round((stats.answered / indexEntry.questionCount) * 100)
  const accuracyPct =
    stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : 0

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in">
      {/* 面包屑 */}
      <nav className="flex items-center gap-2 text-sm text-ink-muted mb-6">
        <Link to="/exams" className="hover:text-ochre-dark transition-colors">
          卷宗
        </Link>
        <span>/</span>
        <span className="text-ink">{exam.year} · {exam.subject}</span>
      </nav>

      {/* 试卷头部 */}
      <header className="paper-card p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className="absolute -right-4 -top-6 font-serif font-bold text-8xl md:text-9xl text-ochre/8 select-none pointer-events-none">
          {exam.year}
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <Link
              to="/exams"
              className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ochre-dark transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> 返回
            </Link>
            <span className={exam.subject === '英语一' ? 'stamp-badge' : 'scholar-tag'}>
              {exam.subject}
            </span>
            {exam.totalTime && (
              <span className="text-xs text-ink-muted font-mono">
                建议时长 {exam.totalTime} 分钟
              </span>
            )}
          </div>

          <h1 className="font-serif text-4xl md:text-5xl font-bold text-ink mb-2">
            {exam.year} 考研英语
            <span className="italic text-ochre-dark ml-2">{exam.subject}</span>
          </h1>
          <p className="text-sm text-ink-muted">
            本卷共 {indexEntry.questionCount} 题，含 {exam.sections.length} 个题型分区。
          </p>

          {/* 统计条 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <StatCell label="完成进度" value={`${completionPct}%`} sub={`${stats.answered}/${indexEntry.questionCount}`} />
            <StatCell label="正确率" value={`${accuracyPct}%`} sub={`${stats.correct} 对 / ${stats.wrong} 错`} />
            <StatCell label="已标记" value={`${stats.marked}`} sub="待回顾题" />
            <StatCell
              label="剩余"
              value={`${indexEntry.questionCount - stats.answered}`}
              sub="未作答"
            />
          </div>

          {/* 进度条 */}
          <div className="mt-5">
            <div className="h-2 bg-paper-deep rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-ochre to-ochre-dark transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          {/* 重置按钮 */}
          {stats.total > 0 && (
            <button
              onClick={() => {
                if (confirm(`确定清空「${exam.year} ${exam.subject}」的所有做题记录吗？此操作不可恢复。`)) {
                  resetExam(examKey)
                }
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-seal transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> 重置本卷进度
            </button>
          )}
        </div>
      </header>

      {/* 题型分区 */}
      <section>
        <div className="flex items-center gap-4 mb-5">
          <Target className="w-4 h-4 text-ochre-dark" />
          <h2 className="font-serif text-xl font-bold text-ink">题型分区</h2>
          <div className="h-px flex-1 bg-line" />
        </div>

        <div className="space-y-3">
          {exam.sections.map((section, i) => {
            const meta = SECTION_META[section.type]
            return (
              <SectionRow
                key={section.id}
                examKey={examKey}
                section={section}
                sectionType={section.type}
                meta={meta}
                index={i}
                questionCount={section.questions.length}
              />
            )
          })}
        </div>
      </section>

      {/* 跳转 */}
      <div className="mt-8 flex justify-between items-center">
        <Link to="/exams" className="scholar-tag hover:bg-ochre-pale">
          <ArrowLeft className="w-3 h-3" /> 其他卷宗
        </Link>
        <Link
          to="/progress"
          className="scholar-tag hover:bg-ochre-pale"
        >
          查看学习记录 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

// 注：以下组件用 useProgress 的 store 直接统计 section 进度
function SectionRow({
  examKey,
  section,
  sectionType,
  meta,
  index,
  questionCount,
}: {
  examKey: string
  section: Exam['sections'][number]
  sectionType: SectionType
  meta: { label: string; desc: string; icon: string }
  index: number
  questionCount: number
}) {
  const { store } = useProgress()
  const examProgress = store[examKey] ?? {}
  const answeredInSection = section.questions.filter(
    (q) => examProgress[q.id]?.submittedAt !== null,
  ).length
  const correctInSection = section.questions.filter(
    (q) => examProgress[q.id]?.status === 'correct',
  ).length

  const to =
    sectionType === 'reading'
      ? `/exam/${examKey}/reading`
      : `/exam/${examKey}/${sectionType}`

  return (
    <Link
      to={to}
      className="paper-card paper-card-hover p-5 group block animate-slide-up"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-sm bg-ochre-pale/50 flex items-center justify-center text-2xl text-ochre-dark flex-shrink-0">
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-serif font-bold text-ink">{meta.label}</h3>
            <span className="text-xs text-ink-muted">· {meta.desc}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span>{questionCount} 题</span>
            <span className="text-ochre-dark">已答 {answeredInSection}</span>
            {correctInSection > 0 && <span className="text-green-700">对 {correctInSection}</span>}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-ochre-dark group-hover:translate-x-0.5 transition-all flex-shrink-0" />
      </div>
    </Link>
  )
}

function StatCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="p-3 bg-paper-deep/40 rounded-sm">
      <div className="text-xs text-ink-muted mb-1">{label}</div>
      <div className="text-2xl font-serif font-bold text-ochre-dark">{value}</div>
      <div className="text-xs text-ink-muted font-mono">{sub}</div>
    </div>
  )
}
