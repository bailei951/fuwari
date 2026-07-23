// 阅读做题页：左侧文章 + 右侧题目，左右分栏（移动端可切换）

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  AlertCircle,
  BookOpen,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
} from 'lucide-react'
import { loadExam, getIndexByKey } from '../lib/dataLoader'
import ArticleView from '../components/article/ArticleView'
import QuestionItem from '../components/quiz/QuestionItem'
import QuestionNav from '../components/quiz/QuestionNav'
import { useProgress } from '../context/ProgressContext'
import type { Exam, Passage, Question } from '../types'

type MobileView = 'article' | 'quiz'

export default function ReadingPage() {
  const { examKey = '' } = useParams<{ examKey: string }>()
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePassageId, setActivePassageId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>('article')

  const { getProgress } = useProgress()
  const indexEntry = getIndexByKey(examKey)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadExam(examKey).then((loaded) => {
      if (!cancelled && loaded) {
        setExam(loaded)
        const readingSection = loaded.sections.find((s) => s.type === 'reading')
        const firstPassage = readingSection?.passages?.[0]
        if (firstPassage) setActivePassageId(firstPassage.id)
        setLoading(false)
      } else if (!cancelled) {
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [examKey])

  const readingSection = useMemo(
    () => exam?.sections.find((s) => s.type === 'reading'),
    [exam],
  )

  const passages = readingSection?.passages ?? []
  const activePassage: Passage | undefined = passages.find((p) => p.id === activePassageId)

  // 当前 passage 关联的题目（按 passageId 筛选；未指定 passageId 的题全归到当前 passage 视图）
  const passageQuestions: Question[] = useMemo(() => {
    if (!readingSection) return []
    if (!activePassage) return readingSection.questions
    return readingSection.questions.filter(
      (q) => !q.passageId || q.passageId === activePassage.id,
    )
  }, [readingSection, activePassage])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center text-ink-muted">
        <Clock className="w-8 h-8 mx-auto mb-3 animate-pulse text-ochre-dark/50" />
        正在翻开卷宗…
      </div>
    )
  }

  if (!exam || !readingSection || !indexEntry) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-4 text-seal/60" />
        <p className="font-serif text-xl text-ink mb-2">未找到该试卷的阅读部分</p>
        <p className="text-sm text-ink-muted mb-6">key: {examKey}</p>
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
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 flex items-center gap-3 flex-wrap">
          <Link
            to={`/exam/${examKey}`}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ochre-dark transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> {exam.year} {exam.subject}
          </Link>
          <span className="text-ink-muted">/</span>
          <span className="text-sm font-serif font-bold text-ink">阅读理解</span>

          {/* 文章切换 */}
          {passages.length > 1 && (
            <div className="flex items-center gap-1 ml-2">
              {passages.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePassageId(p.id)
                    setMobileView('article')
                  }}
                  className={`px-2.5 py-0.5 text-xs rounded-sm border transition-all ${
                    activePassageId === p.id
                      ? 'bg-ink text-paper border-ink'
                      : 'border-line text-ink-muted hover:border-ochre hover:text-ochre-dark'
                  }`}
                >
                  Text {i + 1}
                </button>
              ))}
            </div>
          )}

          {/* 移动端视图切换 */}
          <div className="md:hidden ml-auto inline-flex items-center gap-0.5 p-0.5 bg-paper-deep/40 border border-line rounded-sm">
            <button
              onClick={() => setMobileView('article')}
              className={`px-2 py-1 text-xs rounded-sm flex items-center gap-1 ${
                mobileView === 'article' ? 'bg-paper text-ochre-dark' : 'text-ink-muted'
              }`}
            >
              <BookOpen className="w-3 h-3" /> 文章
            </button>
            <button
              onClick={() => setMobileView('quiz')}
              className={`px-2 py-1 text-xs rounded-sm flex items-center gap-1 ${
                mobileView === 'quiz' ? 'bg-paper text-ochre-dark' : 'text-ink-muted'
              }`}
            >
              <ListChecks className="w-3 h-3" /> 题目
            </button>
          </div>

          {/* 桌面端切换图标（仅显示用） */}
          <LayoutGrid className="hidden md:block w-4 h-4 text-ink-muted ml-auto" />
        </div>
      </header>

      {/* 主体：左右分栏 */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {/* 左侧：文章 */}
          <section
            className={`md:block ${mobileView === 'article' ? 'block' : 'hidden'} md:h-[calc(100vh-9rem)] md:sticky md:top-28`}
          >
            {activePassage ? (
              <ArticleView passage={activePassage} examKey={examKey} />
            ) : (
              <div className="paper-card p-8 text-center text-ink-muted text-sm">
                请选择一篇文章
              </div>
            )}
          </section>

          {/* 右侧：题目 */}
          <section
            className={`md:block ${mobileView === 'quiz' ? 'block' : 'hidden'} space-y-3`}
          >
            {/* 题号导航 */}
            {passageQuestions.length > 0 && (
              <QuestionNav
                questions={passageQuestions}
                getStatus={getStatus}
              />
            )}

            {/* 题目列表 */}
            <div className="space-y-3">
              {passageQuestions.map((q) => (
                <QuestionItem key={q.id} examKey={examKey} question={q} />
              ))}
            </div>

            {/* 翻页 */}
            {passages.length > 1 && (
              <div className="flex items-center justify-between pt-3">
                <button
                  onClick={() => {
                    const idx = passages.findIndex((p) => p.id === activePassageId)
                    if (idx > 0) {
                      setActivePassageId(passages[idx - 1].id)
                      setMobileView('article')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }}
                  disabled={!activePassage || passages.findIndex((p) => p.id === activePassageId) === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-ink-soft border border-line rounded-sm hover:border-ochre hover:text-ochre-dark transition-all disabled:opacity-30"
                >
                  <ChevronLeft className="w-3 h-3" /> 上一文
                </button>
                <button
                  onClick={() => {
                    const idx = passages.findIndex((p) => p.id === activePassageId)
                    if (idx < passages.length - 1) {
                      setActivePassageId(passages[idx + 1].id)
                      setMobileView('article')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }}
                  disabled={
                    !activePassage ||
                    passages.findIndex((p) => p.id === activePassageId) === passages.length - 1
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-ink-soft border border-line rounded-sm hover:border-ochre hover:text-ochre-dark transition-all disabled:opacity-30"
                >
                  下一文 <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* 完成提示 */}
            <Link
              to={`/exam/${examKey}`}
              className="block paper-card paper-card-hover p-4 text-center text-sm text-ochre-dark hover:underline"
            >
              完成本文，返回试卷目录 →
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}
