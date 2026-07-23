// 通用题型做题页：处理完形填空 / 新题型 / 翻译
// 布局：题目 directions + （可选）文章 + 题目列表 + 题号导航
// 翻译题以「对照原文 + 自评 + 解析」呈现，仍走四选一流程以保持进度统一

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  AlertCircle,
  Info,
  BookOpen,
  ListChecks,
} from 'lucide-react'
import { loadExam, getIndexByKey } from '../lib/dataLoader'
import QuestionItem from '../components/quiz/QuestionItem'
import QuestionNav from '../components/quiz/QuestionNav'
import { useProgress } from '../context/ProgressContext'
import type { Exam, Passage, Question, SectionType } from '../types'

const SECTION_META: Record<
  SectionType,
  { label: string; icon: string; tip: string }
> = {
  cloze: {
    label: '英语知识运用',
    icon: '◼',
    tip: '阅读全文，选出每个空格的最佳选项。建议先通读再做题。',
  },
  newType: {
    label: '新题型',
    icon: '▦',
    tip: '阅读 Part B，按题型要求完成作答（七选五 / 排序 / 标题匹配等）。',
  },
  translation: {
    label: '翻译',
    icon: '◑',
    tip: '将画线部分译为中文，对照参考译文与解析自评。',
  },
  reading: { label: '阅读理解', icon: '▤', tip: '' },
  writing: { label: '写作', icon: '◆', tip: '' },
}

export default function SectionPage() {
  const { examKey = '', sectionType = '' } = useParams<{
    examKey: string
    sectionType: string
  }>()
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePassageId, setActivePassageId] = useState<string | null>(null)

  const { getProgress } = useProgress()
  const indexEntry = getIndexByKey(examKey)
  const meta = SECTION_META[sectionType as SectionType]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadExam(examKey).then((loaded) => {
      if (!cancelled && loaded) {
        setExam(loaded)
        const section = loaded.sections.find((s) => s.type === sectionType)
        const firstPassage = section?.passages?.[0]
        if (firstPassage) setActivePassageId(firstPassage.id)
        setLoading(false)
      } else if (!cancelled) {
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [examKey, sectionType])

  const section = useMemo(
    () => exam?.sections.find((s) => s.type === sectionType),
    [exam, sectionType],
  )

  const passages: Passage[] = section?.passages ?? []
  const activePassage: Passage | undefined = passages.find((p) => p.id === activePassageId)

  // 当前 passage 关联的题目；若 section 无 passage，则展示全部题
  const sectionQuestions: Question[] = useMemo(() => {
    if (!section) return []
    if (passages.length === 0) return section.questions
    if (!activePassage) return section.questions
    return section.questions.filter(
      (q) => !q.passageId || q.passageId === activePassage.id,
    )
  }, [section, passages.length, activePassage])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center text-ink-muted">
        <Clock className="w-8 h-8 mx-auto mb-3 animate-pulse text-ochre-dark/50" />
        正在翻开卷宗…
      </div>
    )
  }

  if (!exam || !section || !indexEntry || !meta) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-4 text-seal/60" />
        <p className="font-serif text-xl text-ink mb-2">未找到该题型分区</p>
        <p className="text-sm text-ink-muted mb-6">
          {examKey} / {sectionType}
        </p>
        <Link to={`/exam/${examKey}`} className="scholar-tag hover:bg-ochre-pale">
          <ArrowLeft className="w-3 h-3" /> 返回试卷
        </Link>
      </div>
    )
  }

  function getStatus(qid: number) {
    const p = getProgress(examKey, qid)
    if (!p.submittedAt) return p.marked ? ('marked' as const) : ('unanswered' as const)
    if (p.status === 'correct') return p.marked ? ('marked-correct' as const) : ('correct' as const)
    return p.marked ? ('marked-wrong' as const) : ('wrong' as const)
  }

  return (
    <div className="animate-fade-in">
      {/* 顶部工具条 */}
      <header className="sticky top-14 z-20 bg-paper/90 backdrop-blur-md border-b border-line">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-2 flex items-center gap-3 flex-wrap">
          <Link
            to={`/exam/${examKey}`}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ochre-dark transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> {exam.year} {exam.subject}
          </Link>
          <span className="text-ink-muted">/</span>
          <span className="text-sm font-serif font-bold text-ink">{meta.label}</span>

          {/* 多文章切换 */}
          {passages.length > 1 && (
            <div className="flex items-center gap-1 ml-2">
              {passages.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setActivePassageId(p.id)}
                  className={`px-2.5 py-0.5 text-xs rounded-sm border transition-all ${
                    activePassageId === p.id
                      ? 'bg-ink text-paper border-ink'
                      : 'border-line text-ink-muted hover:border-ochre hover:text-ochre-dark'
                  }`}
                >
                  Part {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-4">
        {/* 分区说明 */}
        <section className="paper-card p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-sm bg-ochre-pale/50 flex items-center justify-center text-xl text-ochre-dark flex-shrink-0">
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-xl font-bold text-ink mb-1">{section.title}</h1>
              {meta.tip && (
                <p className="text-xs text-ink-muted flex items-start gap-1.5">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {meta.tip}
                </p>
              )}
              {section.directions && (
                <blockquote className="mt-3 pl-3 border-l-2 border-ochre/40 text-xs text-ink-soft italic font-serif leading-relaxed">
                  {section.directions}
                </blockquote>
              )}
            </div>
          </div>
        </section>

        {/* 文章（若有） */}
        {activePassage && (
          <section className="paper-card overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line bg-paper-deep/30">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="w-4 h-4 text-ochre-dark flex-shrink-0" />
                <h2 className="font-serif font-bold text-ink text-sm truncate">
                  {activePassage.title ?? '正文'}
                </h2>
                <span className="text-xs text-ink-muted font-mono">
                  {activePassage.content.length} 字符
                </span>
              </div>
            </header>
            <div className="article-body text-base px-7 py-6">
              <pre className="whitespace-pre-wrap font-serif text-ink-soft leading-relaxed text-sm">
                {activePassage.content}
              </pre>
            </div>
          </section>
        )}

        {/* 题号导航 */}
        {sectionQuestions.length > 0 && (
          <QuestionNav questions={sectionQuestions} getStatus={getStatus} />
        )}

        {/* 题目列表 */}
        <div className="flex items-center gap-2 pt-2 pb-1">
          <ListChecks className="w-4 h-4 text-ochre-dark" />
          <h2 className="font-serif font-bold text-ink text-sm">
            题目（{sectionQuestions.length}）
          </h2>
          <div className="h-px flex-1 bg-line-soft" />
        </div>
        <div className="space-y-3">
          {sectionQuestions.map((q) => (
            <QuestionItem key={q.id} examKey={examKey} question={q} />
          ))}
        </div>

        {/* 返回 */}
        <Link
          to={`/exam/${examKey}`}
          className="block paper-card paper-card-hover p-4 text-center text-sm text-ochre-dark hover:underline mt-4"
        >
          完成本题型，返回试卷目录 →
        </Link>
      </div>
    </div>
  )
}
