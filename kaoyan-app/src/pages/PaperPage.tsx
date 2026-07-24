// 整卷答题页：三栏布局（左文章 · 中题目 · 右题号）
// 答题 · 解析 · 查词/翻译 · 批注
// 点击题号 → 左栏滚动到文章定位 + 中栏滚动到题目
// 键盘快捷键：A/B/C/D 选选项、Enter 提交、← → 切题、M 标记

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2, FileQuestion } from 'lucide-react'
import { loadPaper } from '../lib/dataLoader'
import { useRecent } from '../context/RecentContext'
import { useProgress } from '../context/ProgressContext'
import PaperHeader from '../components/paper/PaperHeader'
import ArticlePane from '../components/paper/ArticlePane'
import QuestionPane from '../components/paper/QuestionPane'
import FloatingQuestionNav from '../components/paper/FloatingQuestionNav'
import type { Paper, Question } from '../types'

export default function PaperPage() {
  const { paperId } = useParams<{ paperId: string }>()
  const [paper, setPaper] = useState<Paper | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null)
  /** 自增 token：重置答题后递增，强制子组件重置内部状态（如展开的解析） */
  const [resetToken, setResetToken] = useState(0)

  const { pushRecent } = useRecent()
  const { getProgress, selectOption, submitAnswer, toggleMark, resetExam, getExamStats } =
    useProgress()

  const articleRef = useRef<HTMLDivElement>(null)
  const questionRef = useRef<HTMLDivElement>(null)

  // 加载试卷
  useEffect(() => {
    if (!paperId) return
    setLoading(true)
    loadPaper(paperId).then((p) => {
      setPaper(p)
      setLoading(false)
      if (p) pushRecent(paperId)
    })
  }, [paperId, pushRecent])

  // 扁平化所有题目（用于上下题导航）
  const allQuestions = useMemo<Question[]>(() => {
    if (!paper) return []
    return paper.sections.flatMap((s) => s.questions)
  }, [paper])

  const totalCount = allQuestions.length

  // 已作答题数（用于重置确认提示）
  const answeredCount = useMemo(
    () => (paperId ? getExamStats(paperId).answered : 0),
    [paperId, getExamStats, resetToken],
  )

  // 当前题在序列中的位置（1-based）
  const currentIndex = useMemo(() => {
    if (activeQuestionId == null) return 0
    const idx = allQuestions.findIndex((q) => q.id === activeQuestionId)
    return idx >= 0 ? idx + 1 : 0
  }, [activeQuestionId, allQuestions])

  // 当前题对象
  const activeQuestion = useMemo<Question | null>(() => {
    if (activeQuestionId == null) return null
    return allQuestions.find((q) => q.id === activeQuestionId) ?? null
  }, [activeQuestionId, allQuestions])

  // 滚动到题目：同时滚动中栏题目 + 左栏文章定位
  // 滚动到题目：题目卡片居中定位 + 桌面端左栏文章同步定位
  // 移动端（<lg）：文章和题目在同一滚动容器，仅滚动到题目卡片（居中）
  // 桌面端（≥lg）：左右栏独立滚动，题目居中 + 文章定位
  const scrollToQuestion = useCallback(
    (qId: number) => {
      setActiveQuestionId(qId)

      const isMobile = window.innerWidth < 1024 // lg 断点

      // 等待 DOM 更新后再滚动，避免 re-render 与 scroll 冲突导致抖动
      requestAnimationFrame(() => {
        // 中栏：滚动到题目卡片，居中定位（非置顶）
        const qEl = questionRef.current?.querySelector(`[data-question-id="${qId}"]`)
        if (qEl) {
          qEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }

        // 移动端：跳过文章滚动
        if (isMobile) return

        // 桌面端：左栏滚动到文章对应位置
        if (paper) {
          const question = paper.sections
            .flatMap((s) => s.questions)
            .find((q) => q.id === qId)
          if (question && question.articleId) {
            const blankEl = articleRef.current?.querySelector(`[data-blank-num="${qId}"]`)
            if (blankEl) {
              blankEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
              return
            }
            const paraEl = articleRef.current?.querySelector(
              `[data-article-id="${question.articleId}"] [data-paragraph-index="${question.position}"]`,
            )
            paraEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
      })
    },
    [paper],
  )

  // 上一题 / 下一题
  const goToPrev = useCallback(() => {
    if (!paperId || currentIndex <= 1) return
    const prevQ = allQuestions[currentIndex - 2]
    if (prevQ) scrollToQuestion(prevQ.id)
  }, [paperId, currentIndex, allQuestions, scrollToQuestion])

  const goToNext = useCallback(() => {
    if (!paperId || currentIndex === 0 || currentIndex >= totalCount) return
    const nextQ = allQuestions[currentIndex]
    if (nextQ) scrollToQuestion(nextQ.id)
  }, [paperId, currentIndex, totalCount, allQuestions, scrollToQuestion])

  // 键盘快捷键
  useEffect(() => {
    if (!paperId) return
    const pid = paperId
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // 无激活题时，← → 仅激活第一题
      if (activeQuestionId == null) {
        if (e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault()
          const first = allQuestions[0]
          if (first) scrollToQuestion(first.id)
        }
        return
      }

      const q = activeQuestion
      if (!q) return
      // 主观题（翻译/写作）不走字母快捷键
      const isObjective = !q.subjective

      switch (e.key) {
        case 'a':
        case 'A':
        case 'b':
        case 'B':
        case 'c':
        case 'C':
        case 'd':
        case 'D':
        case 'e':
        case 'E':
        case 'f':
        case 'F':
        case 'g':
        case 'G': {
          if (!isObjective) return
          e.preventDefault()
          const opt = e.key.toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
          if (!getProgress(pid, q.id).submittedAt) {
            selectOption(pid, q.id, opt)
          }
          break
        }
        case 'Enter': {
          e.preventDefault()
          const p = getProgress(pid, q.id)
          if (!p.submittedAt && p.selected && q.answer) {
            submitAnswer(pid, q.id, q.answer)
          } else if (p.submittedAt) {
            goToNext()
          }
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          goToPrev()
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          goToNext()
          break
        }
        case 'm':
        case 'M': {
          e.preventDefault()
          toggleMark(pid, q.id)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    paperId,
    activeQuestionId,
    activeQuestion,
    allQuestions,
    totalCount,
    currentIndex,
    getProgress,
    selectOption,
    submitAnswer,
    toggleMark,
    scrollToQuestion,
    goToPrev,
    goToNext,
  ])

  // 滚动到分区
  const scrollToSection = useCallback((sectionId: string) => {
    const el = articleRef.current?.querySelector(`[data-section-id="${sectionId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // 处理题目点击（中栏点击题目 → 左栏滚动到文章定位）
  const handleQuestionClick = useCallback(
    (q: Question) => {
      setActiveQuestionId(q.id)
      if (q.articleId) {
        const blankEl = articleRef.current?.querySelector(`[data-blank-num="${q.id}"]`)
        if (blankEl) {
          blankEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
        const paraEl = articleRef.current?.querySelector(
          `[data-article-id="${q.articleId}"] [data-paragraph-index="${q.position}"]`,
        )
        paraEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    [],
  )

  // 完形/新题型空格点击 → 中栏滚动到题目
  const handleBlankClick = useCallback(
    (questionId: number) => {
      scrollToQuestion(questionId)
    },
    [scrollToQuestion],
  )

  // 解析中"原文定位"按钮 → 滚动左栏文章
  const handleLocate = useCallback(
    (q: Question) => {
      if (!q.articleId) return
      const blankEl = articleRef.current?.querySelector(`[data-blank-num="${q.id}"]`)
      if (blankEl) {
        blankEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        blankEl.classList.add('ring-2', 'ring-ochre')
        setTimeout(() => blankEl.classList.remove('ring-2', 'ring-ochre'), 1500)
        return
      }
      const paraEl = articleRef.current?.querySelector(
        `[data-article-id="${q.articleId}"] [data-paragraph-index="${q.position}"]`,
      )
      if (paraEl) {
        paraEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
        paraEl.classList.add('ring-2', 'ring-ochre')
        setTimeout(() => paraEl.classList.remove('ring-2', 'ring-ochre'), 1500)
      }
    },
    [],
  )

  // 题号导航的 status 回调
  const getQuestionStatus = useCallback(
    (qId: number) => {
      if (!paperId) return null
      return getProgress(paperId, qId).status
    },
    [paperId, getProgress],
  )

  const isQuestionMarked = useCallback(
    (qId: number) => {
      if (!paperId) return false
      return getProgress(paperId, qId).marked
    },
    [paperId, getProgress],
  )

  function handleReset() {
    if (!paperId) return
    resetExam(paperId)
    setActiveQuestionId(null)
    setResetToken((t) => t + 1)
    // 滚回顶部
    articleRef.current?.scrollTo({ top: 0 })
    questionRef.current?.scrollTo({ top: 0 })
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 animate-fade-in">
        <div className="paper-card p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-ochre-dark mb-3" />
          <p className="text-sm text-ink-muted">试卷加载中…</p>
        </div>
      </div>
    )
  }
  if (!paper) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 animate-fade-in">
        <div className="paper-card p-12 text-center">
          <FileQuestion className="w-10 h-10 mx-auto text-ink-muted/40 mb-3" />
          <p className="font-serif italic text-ink-muted text-lg mb-1">试卷不存在</p>
          <p className="text-sm text-ink-muted mb-6">该试卷可能尚未录入或链接有误。</p>
          <Link to="/papers" className="scholar-tag hover:bg-ochre-pale">
            返回卷宗
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:h-[calc(100vh-3.5rem)]">
      <PaperHeader
        paper={paper}
        sections={paper.sections}
        onSectionJump={scrollToSection}
        onReset={handleReset}
        answeredCount={answeredCount}
      />

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* 左栏：文章 */}
        <div className="flex-1 lg:min-w-0 lg:border-r lg:border-line">
          <ArticlePane
            ref={articleRef}
            paper={paper}
            activeQuestionId={activeQuestionId}
            onBlankClick={handleBlankClick}
          />
        </div>

        {/* 中栏：题目（底部留出悬浮导航空间） */}
        <div
          ref={questionRef}
          className="flex-1 lg:min-w-0 lg:overflow-y-auto border-t lg:border-t-0 pb-16 lg:pb-4 overscroll-contain"
        >
          <QuestionPane
            key={resetToken}
            paper={paper}
            paperId={paper.id}
            activeQuestionId={activeQuestionId}
            onQuestionClick={handleQuestionClick}
            onLocate={handleLocate}
          />
        </div>
      </div>

      {/* 悬浮题号导航（桌面 + 移动端通用，固定定位可展开/收起） */}
      <FloatingQuestionNav
        paper={paper}
        getStatus={getQuestionStatus}
        isMarked={isQuestionMarked}
        activeQuestionId={activeQuestionId}
        currentIndex={currentIndex}
        totalCount={totalCount}
        onQuestionClick={scrollToQuestion}
        onPrev={currentIndex > 1 ? goToPrev : null}
        onNext={currentIndex > 0 && currentIndex < totalCount ? goToNext : null}
      />
    </div>
  )
}
