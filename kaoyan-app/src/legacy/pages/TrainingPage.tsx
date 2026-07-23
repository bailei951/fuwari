// 随机训练页：按题型从全部卷宗随机抽题，作答进度计入原卷
// 选择题型 + 题数 → 生成随机批次 → 逐题作答 → 可重新抽题 / 查看来源

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Dice5,
  RefreshCw,
  BookOpen,
  Target,
  Shuffle,
  CheckCircle2,
} from 'lucide-react'
import { loadAllExams } from '../lib/dataLoader'
import { useProgress } from '../context/ProgressContext'
import QuestionItem from '../components/quiz/QuestionItem'
import type { Exam, Question, SectionType } from '../types'

type TrainingType = Exclude<SectionType, 'writing'>

interface TrainingMeta {
  label: string
  icon: string
  desc: string
}

const TRAINING_META: Record<TrainingType, TrainingMeta> = {
  cloze: { label: '完形填空', icon: '◼', desc: '词语搭配 / 语境辨析' },
  reading: { label: '阅读理解', icon: '▤', desc: '细节 / 主旨 / 推断' },
  newType: { label: '新题型', icon: '▦', desc: '七选五 / 排序 / 标题' },
  translation: { label: '翻译', icon: '◑', desc: '英译汉（四选一）' },
}

interface BatchItem {
  examKey: string
  year: number
  subject: string
  sectionType: SectionType
  passageId?: string
  question: Question
}

const BATCH_SIZES = [5, 10, 15]

export default function TrainingPage() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<TrainingType>('reading')
  const [batchSize, setBatchSize] = useState(5)
  const [batch, setBatch] = useState<BatchItem[]>([])
  const [shuffling, setShuffling] = useState(false)

  const { store } = useProgress()

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

  // 按题型统计可用题量
  const typeCounts = useMemo(() => {
    const counts: Record<TrainingType, number> = {
      cloze: 0,
      reading: 0,
      newType: 0,
      translation: 0,
    }
    for (const exam of exams) {
      for (const section of exam.sections) {
        if (section.type in counts) {
          counts[section.type as TrainingType] += section.questions.length
        }
      }
    }
    return counts
  }, [exams])

  // 全题池（按所选题型）
  const pool = useMemo(() => {
    const items: BatchItem[] = []
    for (const exam of exams) {
      const key = `${exam.year}-${exam.subject === '英语一' ? 'english1' : 'english2'}`
      for (const section of exam.sections) {
        if (section.type !== selectedType) continue
        for (const q of section.questions) {
          const passage = section.passages?.find((p) => p.id === q.passageId)
          items.push({
            examKey: key,
            year: exam.year,
            subject: exam.subject,
            sectionType: section.type,
            passageId: passage?.id,
            question: q,
          })
        }
      }
    }
    return items
  }, [exams, selectedType])

  function shuffle() {
    if (pool.length === 0) return
    setShuffling(true)
    // Fisher-Yates 抽样
    const copy = [...pool]
    const n = Math.min(batchSize, copy.length)
    const result: BatchItem[] = []
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * copy.length)
      result.push(copy[idx])
      copy.splice(idx, 1)
    }
    setBatch(result)
    setTimeout(() => {
      setShuffling(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 100)
  }

  // 批次统计
  const batchStats = useMemo(() => {
    if (batch.length === 0) return null
    let answered = 0
    let correct = 0
    let wrong = 0
    for (const item of batch) {
      const p = store[item.examKey]?.[item.question.id]
      if (p?.submittedAt) {
        answered++
        if (p.status === 'correct') correct++
        else wrong++
      }
    }
    return { total: batch.length, answered, correct, wrong }
  }, [batch, store])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center text-ink-muted">
        <Dice5 className="w-8 h-8 mx-auto mb-3 animate-pulse text-ochre-dark/50" />
        正在准备骰盅…
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 animate-fade-in">
      {/* 页头 */}
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Dice5 className="w-5 h-5 text-ochre-dark" />
          <h1 className="font-serif text-3xl font-bold text-ink">随机训练</h1>
        </div>
        <p className="text-sm text-ink-muted">
          从全部卷宗随机抽题，作答进度会计入对应试卷。
        </p>
      </header>

      {/* 配置面板 */}
      <section className="paper-card p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-4 h-4 text-ochre-dark" />
          <h2 className="font-serif font-bold text-ink text-sm">选择训练题型</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
          {(Object.keys(TRAINING_META) as TrainingType[]).map((type) => {
            const m = TRAINING_META[type]
            const count = typeCounts[type]
            const active = selectedType === type
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                disabled={count === 0}
                className={`p-3 rounded-sm border text-left transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  active
                    ? 'border-ink bg-ink text-paper shadow-paper'
                    : 'border-line hover:border-ochre hover:bg-paper-deep/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-lg ${active ? 'text-ochre' : 'text-ochre-dark'}`}>
                    {m.icon}
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      active ? 'text-paper/70' : 'text-ink-muted'
                    }`}
                  >
                    {count} 题
                  </span>
                </div>
                <div className={`font-serif font-bold text-sm ${active ? 'text-paper' : 'text-ink'}`}>
                  {m.label}
                </div>
                <div className={`text-[10px] mt-0.5 ${active ? 'text-paper/70' : 'text-ink-muted'}`}>
                  {m.desc}
                </div>
              </button>
            )
          })}
        </div>

        {/* 题数选择 + 抽题按钮 */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-line-soft">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">抽题数</span>
            <div className="inline-flex items-center gap-0.5 p-0.5 bg-paper-deep/40 border border-line rounded-sm">
              {BATCH_SIZES.map((n) => (
                <button
                  key={n}
                  onClick={() => setBatchSize(n)}
                  className={`px-2.5 py-1 text-xs rounded-sm transition-all ${
                    batchSize === n
                      ? 'bg-paper text-ochre-dark font-medium shadow-paper'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={shuffle}
            disabled={pool.length === 0 || shuffling}
            className="inline-flex items-center gap-2 px-5 py-2 bg-ink text-paper rounded-sm text-sm font-medium hover:bg-ochre-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-paper hover:shadow-paper-hover"
          >
            {batch.length > 0 ? (
              <>
                <RefreshCw className={`w-3.5 h-3.5 ${shuffling ? 'animate-spin' : ''}`} /> 重新抽题
              </>
            ) : (
              <>
                <Shuffle className="w-3.5 h-3.5" /> 开始训练
              </>
            )}
          </button>

          <span className="text-xs text-ink-muted ml-auto font-mono">
            题池 {pool.length} 题
          </span>
        </div>
      </section>

      {/* 批次内容 */}
      {batch.length === 0 ? (
        <div className="paper-card p-12 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-ochre-pale/50 items-center justify-center mb-4">
            <Dice5 className="w-6 h-6 text-ochre-dark" />
          </div>
          <p className="font-serif italic text-ink-muted text-lg mb-1">掷骰，开始今日训练。</p>
          <p className="text-sm text-ink-muted">
            选择题型与题数，点击「开始训练」随机抽题。
          </p>
        </div>
      ) : (
        <>
          {/* 批次统计 */}
          {batchStats && (
            <section className="paper-card p-4 mb-4">
              <div className="flex items-center gap-4 text-xs">
                <span className="font-serif font-bold text-ink text-sm">本批进度</span>
                <span className="text-ink-muted">
                  已答 <span className="font-mono text-ochre-dark">{batchStats.answered}</span> / {batchStats.total}
                </span>
                {batchStats.correct > 0 && (
                  <span className="text-green-700">对 {batchStats.correct}</span>
                )}
                {batchStats.wrong > 0 && (
                  <span className="text-seal-dark">错 {batchStats.wrong}</span>
                )}
                {batchStats.answered === batchStats.total && (
                  <span className="inline-flex items-center gap-1 text-green-700 ml-auto">
                    <CheckCircle2 className="w-3 h-3" /> 全部完成
                  </span>
                )}
              </div>
              {/* 进度条 */}
              <div className="mt-2 h-1.5 bg-paper-deep rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-ochre to-ochre-dark transition-all duration-300"
                  style={{
                    width: `${Math.round((batchStats.answered / batchStats.total) * 100)}%`,
                  }}
                />
              </div>
            </section>
          )}

          {/* 题目列表 */}
          <div className="space-y-3">
            {batch.map((item, idx) => (
              <TrainingCard key={`${item.examKey}-${item.question.id}`} item={item} index={idx} />
            ))}
          </div>

          {/* 底部重抽 */}
          <div className="mt-6 text-center">
            <button
              onClick={shuffle}
              className="inline-flex items-center gap-2 px-5 py-2 border border-ink/20 text-ink rounded-sm text-sm font-medium hover:border-ochre hover:text-ochre-dark transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 再来一批
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function TrainingCard({ item, index }: { item: BatchItem; index: number }) {
  const sectionRoute = item.sectionType === 'reading' ? 'reading' : item.sectionType

  return (
    <div className="paper-card p-4">
      {/* 来源标识 */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-line-soft">
        <span className="font-mono text-xs text-ochre-dark">#{index + 1}</span>
        <span className="scholar-tag">{item.year} {item.subject}</span>
        <span className="scholar-tag">{TRAINING_META[item.sectionType as TrainingType]?.label}</span>
        <Link
          to={`/exam/${item.examKey}/${sectionRoute}`}
          className="ml-auto text-xs text-ink-muted hover:text-ochre-dark transition-colors inline-flex items-center gap-0.5"
        >
          源卷 <BookOpen className="w-3 h-3" />
        </Link>
      </div>

      <QuestionItem examKey={item.examKey} question={item.question} />
    </div>
  )
}
