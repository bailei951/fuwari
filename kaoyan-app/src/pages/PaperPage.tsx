// 整卷阅读页：三栏布局（左文章 · 中题目 · 右题号）
// 支持原卷模式（PDF 式浏览）与学习模式（答题 · 解析 · 查词 · 批注）
// 点击题号 → 左栏滚动到文章定位 + 中栏滚动到题目
// 键盘快捷键：A/B/C/D 选选项、Enter 提交、← → 切题、M 标记

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2, FileQuestion } from 'lucide-react'
import { loadPaper } from '../lib/dataLoader'
import { useRecent } from '../context/RecentContext'
import { useFontScale } from '../hooks/useFontScale'
import { useProgress } from '../context/ProgressContext'
import PaperHeader from '../components/paper/PaperHeader'
import ArticlePane from '../components/paper/ArticlePane'
import QuestionPane from '../components/paper/QuestionPane'
import QuestionNav from '../components/paper/QuestionNav'
import MobileQuestionNav from '../components/paper/MobileQuestionNav'
import type { Paper, ReadMode, Question } from '../types'

const MODE_STORAGE_KEY = 'ky:readMode'

export default function PaperPage() {
  const { paperId } = useParams<{ paperId: string }>()
  const [paper, setPaper] = useState<Paper | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<ReadMode>(() => {
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY) as ReadMode | null
      return stored === 'study' || stored === 'original' ? stored : 'study'
    } catch {
      return 'study'
    }
  })
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null)

  const fontScale = useFontScale()
  const { pushRecent } = useRecent()
  const { getProgress, selectOption, submitAnswer, toggleMark } = useProgress()

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

  // 持久化阅读模式
  useEffect(() => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode)
    } catch {
      /* 忽略 */
    }
  }, [mode])

  // 扁平化所有题目（用于上下题导航）
  const allQuestions = useMemo<Question[]>(() => {
    if (!paper) return []
    return paper.sections.flatMap((s) => s.questions)
  }, [paper])

  const totalCount = allQuestions.length

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
  const scrollToQuestion = useCallback(
    (qId: number) => {
      setActiveQuestionId(qId)

      // 中栏：滚动到题目卡片
      const qEl = questionRef.current?.querySelector(`[data-question-id="${qId}"]`)
      qEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })

      // 左栏：滚动到文章对应位置
      if (paper) {
        const question = paper.sections
          .flatMap((s) => s.questions)
          .find((q) => q.id === qId)
        if (question && question.articleId) {
          // 完形：滚动到对应空格
          const blankEl = articleRef.current?.querySelector(`[data-blank-num="${qId}"]`)
          if (blankEl) {
            blankEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
          }
          // 阅读：滚动到对应段落
          const paraEl = articleRef.current?.querySelector(
            `[data-article-id="${question.articleId}"] [data-paragraph-index="${question.position}"]`,
          )
          paraEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
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
    if (!paperId || mode !== 'study') return
    // 闭包外窄化：TS 在闭包内不会延续 narrowing，提取为本地 const
    const pid = paperId
    function onKey(e: KeyboardEvent) {
      // 忽略输入框中的按键
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      // 忽略带 Ctrl/Meta 的组合键
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

      switch (e.key) {
        case 'a':
        case 'A': {
          e.preventDefault()
          if (!getProgress(pid, q.id).submittedAt) {
            selectOption(pid, q.id, 'A')
          }
          break
        }
        case 'b':
        case 'B': {
          e.preventDefault()
          if (!getProgress(pid, q.id).submittedAt) {
            selectOption(pid, q.id, 'B')
          }
          break
        }
        case 'c':
        case 'C': {
          e.preventDefault()
          if (!getProgress(pid, q.id).submittedAt) {
            selectOption(pid, q.id, 'C')
          }
          break
        }
        case 'd':
        case 'D': {
          e.preventDefault()
          if (!getProgress(pid, q.id).submittedAt) {
            selectOption(pid, q.id, 'D')
          }
          break
        }
        case 'Enter': {
          e.preventDefault()
          const p = getProgress(pid, q.id)
          if (!p.submittedAt && p.selected) {
            submitAnswer(pid, q.id, q.answer)
          } else if (p.submittedAt) {
            // 已提交 → Enter 跳下一题
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
    mode,
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

  // 完形空格点击 → 中栏滚动到题目
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
      // 完形：滚动到对应空格
      const blankEl = articleRef.current?.querySelector(`[data-blank-num="${q.id}"]`)
      if (blankEl) {
        blankEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // 闪烁高亮
        blankEl.classList.add('ring-2', 'ring-ochre')
        setTimeout(() => blankEl.classList.remove('ring-2', 'ring-ochre'), 1500)
        return
      }
      // 阅读：滚动到对应段落
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
        mode={mode}
        onModeChange={setMode}
        fontScale={fontScale.scale}
        onFontIncrease={fontScale.increase}
        onFontDecrease={fontScale.decrease}
        onFontReset={fontScale.reset}
        sections={paper.sections}
        onSectionJump={scrollToSection}
      />

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* 左栏：文章（移动端底部留出悬浮条空间） */}
        <div className="flex-1 lg:min-w-0 lg:border-r lg:border-line pb-14 lg:pb-0">
          <ArticlePane
            ref={articleRef}
            paper={paper}
            mode={mode}
            activeQuestionId={activeQuestionId}
            onBlankClick={handleBlankClick}
          />
        </div>

        {/* 中栏：题目（移动端底部留出悬浮条空间） */}
        <div
          ref={questionRef}
          className="flex-1 lg:min-w-0 lg:overflow-y-auto border-t lg:border-t-0 lg:border-r lg:border-line pb-14 lg:pb-0"
        >
          <QuestionPane
            paper={paper}
            mode={mode}
            activeQuestionId={activeQuestionId}
            onQuestionClick={handleQuestionClick}
            onPrev={currentIndex > 1 ? goToPrev : null}
            onNext={currentIndex > 0 && currentIndex < totalCount ? goToNext : null}
            currentIndex={currentIndex}
            totalCount={totalCount}
            onLocate={handleLocate}
          />
        </div>

        {/* 右栏：题号导航（仅桌面） */}
        <aside className="hidden lg:block w-56 flex-shrink-0 lg:overflow-y-auto px-3 py-3">
          <div className="mb-3 pb-2 border-b border-line">
            <h2 className="font-serif text-xs font-bold text-ink-muted">题号导航</h2>
            <p className="text-[10px] text-ink-muted/70 font-mono mt-0.5">
              快捷键 A-D 选 · Enter 提交 · ← → 切题 · M 标记
            </p>
          </div>
          <QuestionNav
            paper={paper}
            mode={mode}
            getStatus={getQuestionStatus}
            isMarked={isQuestionMarked}
            activeQuestionId={activeQuestionId}
            onQuestionClick={scrollToQuestion}
          />
        </aside>
      </div>

      {/* 移动端底部题号抽屉（lg 以下显示，替代右栏） */}
      <MobileQuestionNav
        paper={paper}
        mode={mode}
        getStatus={getQuestionStatus}
        isMarked={isQuestionMarked}
        activeQuestionId={activeQuestionId}
        currentIndex={currentIndex}
        totalCount={totalCount}
        onQuestionClick={scrollToQuestion}
      />
    </div>
  )
}
