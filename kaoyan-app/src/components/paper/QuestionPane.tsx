// 题目区（中栏）：按分区渲染所有题目
// - 阅读：按篇章分组，每篇独立提交 + 修改重交
// - 新题型：待选段落面板 + 紧凑题号选择器（选项 A-H）
// - 完形/翻译/写作：整题型提交
// 解析默认关闭，点击"查看解析"展开；主观题（翻译/写作）文本作答 + 参考答案/评分标准 + 自评

import { useState } from 'react'
import {
  Check,
  Flag,
  FileText,
  ChevronDown,
  ChevronUp as ChevronPrev,
  ChevronDown as ChevronNext,
  MapPin,
  Send,
  CheckCircle2,
  CircleDot,
  Award,
  RotateCcw,
  ListOrdered,
} from 'lucide-react'
import type { Paper, Question, OptionKey } from '../../types'
import { useProgress } from '../../context/ProgressContext'

interface QuestionPaneProps {
  paper: Paper
  paperId: string
  activeQuestionId: number | null
  onQuestionClick: (q: Question) => void
  /** 上一题回调（无则隐藏按钮） */
  onPrev?: (() => void) | null
  /** 下一题回调（无则隐藏按钮） */
  onNext?: (() => void) | null
  /** 当前题在整卷中的位置（1-based） */
  currentIndex?: number
  /** 总题数 */
  totalCount?: number
  /** 跳转到原文定位 */
  onLocate?: (q: Question) => void
}

const SECTION_LABEL: Record<string, string> = {
  cloze: '英语知识运用',
  reading: '阅读理解',
  newType: '新题型',
  translation: '翻译',
  writing: '写作',
}

export default function QuestionPane({
  paper,
  paperId,
  activeQuestionId,
  onQuestionClick,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
  onLocate,
}: QuestionPaneProps) {
  return (
    <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-6">
      {/* 顶部导航条：上一题 / 当前位置 / 下一题 */}
      {(onPrev || onNext) && currentIndex !== undefined && totalCount !== undefined && (
        <div className="sticky top-0 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 bg-paper/95 backdrop-blur-sm border-b border-line flex items-center justify-between gap-2">
          <button
            onClick={() => onPrev?.()}
            disabled={!onPrev}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-ink-soft hover:text-ochre-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="上一题（←）"
          >
            <ChevronPrev className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">上一题</span>
          </button>
          <span className="text-[11px] font-mono text-ink-muted">
            {currentIndex} / {totalCount}
          </span>
          <button
            onClick={() => onNext?.()}
            disabled={!onNext}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-ink-soft hover:text-ochre-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="下一题（→ 或 Enter）"
          >
            <span className="hidden sm:inline">下一题</span>
            <ChevronNext className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {paper.sections.map((sec) => (
        <SectionBlock
          key={sec.id}
          section={sec}
          paperId={paperId}
          activeQuestionId={activeQuestionId}
          onQuestionClick={onQuestionClick}
          onLocate={onLocate}
        />
      ))}
    </div>
  )
}

// =================================================================
// 分区块：按题型分发渲染
// - reading：按篇章分组，每篇独立提交 + 修改重交
// - newType：待选段落面板 + 紧凑题号选择器
// - 其他（cloze/translation/writing）：整题型提交
// =================================================================

interface SectionBlockProps {
  section: Paper['sections'][number]
  paperId: string
  activeQuestionId: number | null
  onQuestionClick: (q: Question) => void
  onLocate?: (q: Question) => void
}

function SectionBlock({
  section,
  paperId,
  activeQuestionId,
  onQuestionClick,
  onLocate,
}: SectionBlockProps) {
  if (section.type === 'reading') {
    return (
      <ReadingSection
        section={section}
        paperId={paperId}
        activeQuestionId={activeQuestionId}
        onQuestionClick={onQuestionClick}
        onLocate={onLocate}
      />
    )
  }
  if (section.type === 'newType') {
    return (
      <NewTypeSection
        section={section}
        paperId={paperId}
        activeQuestionId={activeQuestionId}
        onQuestionClick={onQuestionClick}
        onLocate={onLocate}
      />
    )
  }
  return (
    <DefaultSection
      section={section}
      paperId={paperId}
      activeQuestionId={activeQuestionId}
      onQuestionClick={onQuestionClick}
      onLocate={onLocate}
    />
  )
}

// =================================================================
// 默认区块（完形 / 翻译 / 写作）：整题型提交
// =================================================================

function DefaultSection({
  section,
  paperId,
  activeQuestionId,
  onQuestionClick,
  onLocate,
}: SectionBlockProps) {
  const { getProgress, submitAnswer, submitSelection, submitSubjective } = useProgress()

  const questions = section.questions

  const stats = questions.reduce(
    (acc, q) => {
      const p = getProgress(paperId, q.id)
      if (p.submittedAt) acc.submitted++
      else if (q.subjective ? p.textAnswer?.trim() : p.selected) acc.pending++
      return acc
    },
    { submitted: 0, pending: 0 },
  )

  const allSubmitted = stats.submitted === questions.length
  const canSubmit = stats.pending > 0 && !allSubmitted

  function handleSectionSubmit() {
    for (const q of questions) {
      const p = getProgress(paperId, q.id)
      if (p.submittedAt) continue
      if (q.subjective) {
        if (p.textAnswer?.trim()) submitSubjective(paperId, q.id)
      } else if (p.selected) {
        const ans = q.answer
        if (ans) submitAnswer(paperId, q.id, ans)
        else submitSelection(paperId, q.id)
      }
    }
  }

  return (
    <section data-section-id={section.id}>
      <SectionHeader section={section} questionCount={questions.length} />
      <div className="space-y-2 sm:space-y-3">
        {questions.map((q) =>
          q.subjective ? (
            <SubjectiveCard
              key={q.id}
              question={q}
              paperId={paperId}
              isActive={activeQuestionId === q.id}
              onClick={() => onQuestionClick(q)}
            />
          ) : (
            <ObjectiveCard
              key={q.id}
              question={q}
              paperId={paperId}
              isActive={activeQuestionId === q.id}
              onClick={() => onQuestionClick(q)}
              onLocate={onLocate}
            />
          ),
        )}
      </div>
      <SubmitBar
        onSubmit={handleSectionSubmit}
        canSubmit={canSubmit}
        allSubmitted={allSubmitted}
        submitted={stats.submitted}
        total={questions.length}
        pending={stats.pending}
      />
    </section>
  )
}

// =================================================================
// 阅读理解：按篇章分组，每篇独立提交 + 修改重交
// =================================================================

function ReadingSection({
  section,
  paperId,
  activeQuestionId,
  onQuestionClick,
  onLocate,
}: SectionBlockProps) {
  const articleMap = new Map(section.articles.map((a) => [a.id, a]))
  // 按 articleId 分组，保持文章顺序
  const groups: Array<{ articleId: string; title: string; questions: Question[] }> = []
  const seen = new Set<string>()
  for (const q of section.questions) {
    const aid = q.articleId || '_none'
    if (!seen.has(aid)) {
      seen.add(aid)
      groups.push({
        articleId: aid,
        title: articleMap.get(aid)?.title ?? `篇章 ${groups.length + 1}`,
        questions: [],
      })
    }
    groups[groups.length - 1].questions.push(q)
  }

  return (
    <section data-section-id={section.id}>
      <SectionHeader section={section} questionCount={section.questions.length} />
      <div className="space-y-5">
        {groups.map((g, idx) => (
          <PassageBlock
            key={g.articleId}
            title={g.title}
            index={idx + 1}
            questions={g.questions}
            paperId={paperId}
            activeQuestionId={activeQuestionId}
            onQuestionClick={onQuestionClick}
            onLocate={onLocate}
          />
        ))}
      </div>
    </section>
  )
}

interface PassageBlockProps {
  title: string
  index: number
  questions: Question[]
  paperId: string
  activeQuestionId: number | null
  onQuestionClick: (q: Question) => void
  onLocate?: (q: Question) => void
}

function PassageBlock({
  title,
  index,
  questions,
  paperId,
  activeQuestionId,
  onQuestionClick,
  onLocate,
}: PassageBlockProps) {
  const { getProgress, submitAnswer, submitSelection, reopenAnswer } = useProgress()

  const stats = questions.reduce(
    (acc, q) => {
      const p = getProgress(paperId, q.id)
      if (p.submittedAt) acc.submitted++
      else if (p.selected) acc.pending++
      return acc
    },
    { submitted: 0, pending: 0 },
  )

  const allSubmitted = stats.submitted === questions.length
  const canSubmit = stats.pending > 0 && !allSubmitted

  function handlePassageSubmit() {
    for (const q of questions) {
      const p = getProgress(paperId, q.id)
      if (p.submittedAt) continue
      if (p.selected) {
        const ans = q.answer
        if (ans) submitAnswer(paperId, q.id, ans)
        else submitSelection(paperId, q.id)
      }
    }
  }

  function handleReopen() {
    for (const q of questions) {
      const p = getProgress(paperId, q.id)
      if (p.submittedAt) reopenAnswer(paperId, q.id)
    }
  }

  return (
    <div className="border border-line rounded-sm p-3 bg-paper/50">
      {/* 篇章标题 + 状态 */}
      <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-line-soft">
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center font-mono text-[10px] font-bold rounded-sm bg-ochre-pale text-ochre-dark">
          {index}
        </span>
        <span className="font-serif text-xs font-bold text-ink">{title}</span>
        <span className="text-[10px] text-ink-muted font-mono ml-auto">
          {questions.length} 题
        </span>
        {allSubmitted && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-green-700 bg-green-50 border border-green-500/30 rounded-sm">
            <CheckCircle2 className="w-2.5 h-2.5" /> 已提交
          </span>
        )}
        {!allSubmitted && stats.submitted > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-ochre-dark bg-ochre-pale/50 border border-ochre/30 rounded-sm">
            部分提交
          </span>
        )}
        {!allSubmitted && stats.submitted === 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-ink-muted bg-paper-deep/40 border border-line rounded-sm">
            未提交
          </span>
        )}
      </div>

      {/* 题目 */}
      <div className="space-y-2 sm:space-y-3">
        {questions.map((q) => (
          <ObjectiveCard
            key={q.id}
            question={q}
            paperId={paperId}
            isActive={activeQuestionId === q.id}
            onClick={() => onQuestionClick(q)}
            onLocate={onLocate}
          />
        ))}
      </div>

      {/* 篇章提交 / 修改 */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          onClick={handlePassageSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-ink text-paper rounded-sm hover:bg-ochre-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {allSubmitted ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" /> 本篇已提交
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" /> 提交本篇
            </>
          )}
        </button>
        {allSubmitted && (
          <button
            onClick={handleReopen}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-ink-soft border border-line rounded-sm hover:border-ochre hover:text-ochre-dark transition-colors"
            title="重开本篇答案以修改后重新提交"
          >
            <RotateCcw className="w-3 h-3" /> 修改答案
          </button>
        )}
        <span className="text-[10px] text-ink-muted font-mono">
          已提交 {stats.submitted}/{questions.length}
          {stats.pending > 0 && ` · 待提交 ${stats.pending}`}
        </span>
      </div>
    </div>
  )
}

// =================================================================
// 新题型（段落排序 / 匹配）：待选段落面板 + 紧凑选择器
// =================================================================

function NewTypeSection({
  section,
  paperId,
  activeQuestionId,
  onQuestionClick,
  onLocate,
}: SectionBlockProps) {
  const { getProgress, selectOption, submitAnswer, submitSelection, toggleMark, reopenAnswer } =
    useProgress()
  const [showAnalysis, setShowAnalysis] = useState<Record<number, boolean>>({})

  const questions = section.questions

  // 从首题提取共享选项（所有段落），A-H 排序
  const sharedOptions = questions[0]?.options ?? {}
  const allOptionKeys = (Object.keys(sharedOptions) as OptionKey[])
    .filter((k) => sharedOptions[k])
    .sort()

  // 从 article 读取已放置段落与顺序结构
  const article = section.articles[0]
  const placedSet = new Set<OptionKey>(article?.placedParagraphs ?? [])
  const paragraphOrder = article?.paragraphOrder

  // 区分已放置段落（仅展示）与待选段落（可选择）
  const placedKeys = allOptionKeys.filter((k) => placedSet.has(k))
  const selectableKeys = allOptionKeys.filter((k) => !placedSet.has(k))

  const stats = questions.reduce(
    (acc, q) => {
      const p = getProgress(paperId, q.id)
      if (p.submittedAt) acc.submitted++
      else if (p.selected) acc.pending++
      return acc
    },
    { submitted: 0, pending: 0 },
  )

  const allSubmitted = stats.submitted === questions.length
  const canSubmit = stats.pending > 0 && !allSubmitted

  function handleSubmitAll() {
    for (const q of questions) {
      const p = getProgress(paperId, q.id)
      if (p.submittedAt) continue
      if (p.selected) {
        const ans = q.answer
        if (ans) submitAnswer(paperId, q.id, ans)
        else submitSelection(paperId, q.id)
      }
    }
  }

  function handleReopenAll() {
    for (const q of questions) {
      const p = getProgress(paperId, q.id)
      if (p.submittedAt) reopenAnswer(paperId, q.id)
    }
  }

  return (
    <section data-section-id={section.id}>
      <SectionHeader section={section} questionCount={questions.length} />

      {/* 段落顺序结构（如 "F → 41 → 42 → H → 43 → C → 44 → 45"） */}
      {paragraphOrder && (
        <div className="mb-3 p-2.5 bg-ochre-pale/30 border border-ochre/20 rounded-sm">
          <div className="flex items-center gap-1.5 mb-1 text-ochre-dark">
            <ListOrdered className="w-3.5 h-3.5" />
            <span className="font-serif text-xs font-bold">段落顺序</span>
            <span className="text-[10px] text-ink-muted ml-auto">字母=已放置 · 数字=待填空</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap font-mono text-xs text-ink-soft">
            {paragraphOrder
              .split('→')
              .map((t) => t.trim())
              .filter(Boolean)
              .map((token, i) => {
                const isPlaced = /^[A-H]$/.test(token)
                return (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-ink-muted">→</span>}
                    <span
                      className={`px-1.5 py-0.5 rounded-sm ${
                        isPlaced
                          ? 'bg-green-50 text-green-700 border border-green-500/30'
                          : 'bg-ink text-paper'
                      }`}
                    >
                      {token}
                    </span>
                  </span>
                )
              })}
          </div>
        </div>
      )}

      {/* 已放置段落（只读展示，不可选择） */}
      {placedKeys.length > 0 && (
        <div className="mb-3 p-3 bg-green-50/40 border border-green-500/20 rounded-sm">
          <div className="flex items-center gap-1.5 mb-2 text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-serif text-xs font-bold">已放置段落</span>
            <span className="text-[10px] text-ink-muted font-mono ml-auto">
              共 {placedKeys.length} 项（已在文中）
            </span>
          </div>
          <ul className="space-y-1.5">
            {placedKeys.map((key) => {
              const text = sharedOptions[key]
              if (!text) return null
              return (
                <li key={key} className="flex items-start gap-2 opacity-80">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center font-mono text-[10px] font-bold rounded-sm bg-green-100 text-green-700 border border-green-500/30">
                    {key}
                  </span>
                  <span className="flex-1 text-xs text-ink-soft leading-relaxed font-serif">
                    {text}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 待选段落面板（可选择，排除已放置） */}
      {selectableKeys.length > 0 && (
        <div className="mb-3 p-3 bg-paper-deep/30 border border-line-soft rounded-sm">
          <div className="flex items-center gap-1.5 mb-2 text-ochre-dark">
            <ListOrdered className="w-3.5 h-3.5" />
            <span className="font-serif text-xs font-bold">待选段落</span>
            <span className="text-[10px] text-ink-muted font-mono ml-auto">
              共 {selectableKeys.length} 项
            </span>
          </div>
          <ul className="space-y-1.5">
            {selectableKeys.map((key) => {
              const text = sharedOptions[key]
              if (!text) return null
              return (
                <li key={key} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center font-mono text-[10px] font-bold rounded-sm bg-ochre-pale/60 text-ochre-dark border border-ochre/30">
                    {key}
                  </span>
                  <span className="flex-1 text-xs text-ink-soft leading-relaxed font-serif">
                    {text}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 紧凑题号选择器 */}
      <div className="space-y-2">
        {questions.map((q) => {
          const p = getProgress(paperId, q.id)
          const submitted = p.submittedAt !== null
          const hasKey = !!q.answer
          const isCorrect = p.status === 'correct'
          const ansOpen = showAnalysis[q.id] ?? false
          const hasAnalysis =
            !!q.analysis.coreAnalysis ||
            !!q.analysisText ||
            !!q.analysis.location ||
            (q.analysis.optionAnalysis !== undefined &&
              Object.values(q.analysis.optionAnalysis).some((v) => !!v))

          return (
            <div
              key={q.id}
              data-question-id={q.id}
              className={`paper-card p-2.5 transition-all scroll-mt-2 ${
                activeQuestionId === q.id ? 'ring-2 ring-ochre shadow-paper-hover' : ''
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center font-mono text-xs font-bold rounded-sm bg-ink text-paper cursor-pointer"
                  onClick={() => onQuestionClick(q)}
                >
                  {q.id}
                </span>

                {/* 紧凑字母选择器（仅待选段落，不含已放置） */}
                <div className="flex items-center gap-1 flex-wrap">
                  {selectableKeys.map((key) => {
                    const isSelected = p.selected === key
                    const isAnswer = q.answer === key
                    const showResult = submitted && hasKey
                    return (
                      <button
                        key={key}
                        onClick={() => !submitted && selectOption(paperId, q.id, key)}
                        disabled={submitted}
                        className={`w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center font-mono text-xs font-bold rounded-sm border transition-all ${
                          showResult
                            ? isAnswer
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : isSelected && !isAnswer
                                ? 'border-seal/50 bg-seal/5 text-seal-dark'
                                : 'border-line bg-transparent text-ink-muted opacity-60'
                            : isSelected
                              ? 'border-ochre bg-ochre-pale/60 text-ochre-dark'
                              : 'border-line bg-transparent text-ink-soft hover:border-ochre/50 hover:bg-ochre-pale/30'
                        } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {key}
                      </button>
                    )
                  })}
                </div>

                {/* 状态反馈 */}
                {submitted && hasKey && (
                  <span
                    className={`text-[11px] font-medium ${
                      isCorrect ? 'text-green-700' : 'text-seal-dark'
                    }`}
                  >
                    {isCorrect ? '✓' : '✗'} 正确：{q.answer}
                  </span>
                )}
                {submitted && !hasKey && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ochre-dark">
                    <CircleDot className="w-3 h-3" /> 已提交
                  </span>
                )}

                {/* 标记 + 解析 */}
                <button
                  onClick={() => toggleMark(paperId, q.id)}
                  className={`ml-auto p-1 rounded-sm transition-colors ${
                    p.marked
                      ? 'text-seal-dark bg-seal/5'
                      : 'text-ink-muted hover:text-seal-dark'
                  }`}
                  title={p.marked ? '取消标记' : '标记'}
                >
                  <Flag className="w-3 h-3" fill={p.marked ? 'currentColor' : 'none'} />
                </button>
                {submitted && hasAnalysis && (
                  <button
                    onClick={() =>
                      setShowAnalysis((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                    }
                    className="p-1 text-ochre-dark hover:bg-ochre-pale/40 rounded-sm transition-colors"
                    title="查看解析"
                  >
                    <FileText className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* 题干（如有） */}
              {q.question && (
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed whitespace-pre-wrap pl-8">
                  {q.question}
                </p>
              )}

              {/* 解析 */}
              {submitted && ansOpen && hasAnalysis && (
                <div className="mt-2 ml-8 p-2 bg-paper-deep/30 rounded-sm border border-line-soft">
                  {q.analysis.coreAnalysis && (
                    <p className="text-xs text-ink-soft leading-relaxed whitespace-pre-wrap mb-1.5">
                      {q.analysis.coreAnalysis}
                    </p>
                  )}
                  {!q.analysis.coreAnalysis && q.analysisText && (
                    <p className="text-xs text-ink-soft leading-relaxed whitespace-pre-wrap mb-1.5">
                      {q.analysisText}
                    </p>
                  )}
                  {q.analysis.location && (
                    <p className="text-xs text-ochre-dark italic mt-1.5 pt-1.5 border-t border-line-soft flex items-start gap-1">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      原文定位：{q.analysis.location}
                      {onLocate && (
                        <button
                          onClick={() => onLocate(q)}
                          className="ml-1 px-1.5 py-0.5 text-[10px] not-italic font-mono bg-ochre-pale/40 hover:bg-ochre-pale text-ochre-dark rounded-sm transition-colors"
                        >
                          跳转 →
                        </button>
                      )}
                    </p>
                  )}
                  {Object.keys(q.analysis.optionAnalysis ?? {}).length > 0 && (
                    <ul className="text-xs text-ink-muted mt-1.5 pt-1.5 border-t border-line-soft space-y-0.5">
                      {(Object.keys(q.analysis.optionAnalysis) as OptionKey[]).map((k) => {
                        const text = q.analysis.optionAnalysis[k]
                        if (!text) return null
                        return (
                          <li key={k}>
                            <span className="font-mono font-bold mr-1">{k}.</span>
                            {text}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 整体提交 / 修改 */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          onClick={handleSubmitAll}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-ink text-paper rounded-sm hover:bg-ochre-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {allSubmitted ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" /> 本题型已提交
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" /> 提交本题型
            </>
          )}
        </button>
        {allSubmitted && (
          <button
            onClick={handleReopenAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-ink-soft border border-line rounded-sm hover:border-ochre hover:text-ochre-dark transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> 修改答案
          </button>
        )}
        <span className="text-[10px] text-ink-muted font-mono">
          已提交 {stats.submitted}/{questions.length}
          {stats.pending > 0 && ` · 待提交 ${stats.pending}`}
        </span>
      </div>
    </section>
  )
}

// =================================================================
// 共用：分区标题栏 / 提交栏
// =================================================================

function SectionHeader({
  section,
  questionCount,
}: {
  section: Paper['sections'][number]
  questionCount: number
}) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-line">
      <h2 className="font-serif text-sm font-bold text-ochre-dark">
        {SECTION_LABEL[section.type] ?? section.title}
      </h2>
      <span className="text-[10px] text-ink-muted font-mono">{questionCount} 题</span>
      {section.directions && (
        <span
          className="text-[10px] text-ink-muted/70 italic ml-auto truncate max-w-[55%]"
          title={section.directions}
        >
          {section.directions.slice(0, 40)}…
        </span>
      )}
    </div>
  )
}

function SubmitBar({
  onSubmit,
  canSubmit,
  allSubmitted,
  submitted,
  total,
  pending,
}: {
  onSubmit: () => void
  canSubmit: boolean
  allSubmitted: boolean
  submitted: number
  total: number
  pending: number
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-ink text-paper rounded-sm hover:bg-ochre-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {allSubmitted ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5" /> 本题型已提交
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5" /> 提交本题型
          </>
        )}
      </button>
      <span className="text-[10px] text-ink-muted font-mono">
        已提交 {submitted}/{total}
        {pending > 0 && ` · 待提交 ${pending}`}
      </span>
    </div>
  )
}

// =================================================================
// 客观题卡片（完形 / 阅读 / 新题型）
// =================================================================

interface ObjectiveCardProps {
  question: Question
  paperId: string
  isActive: boolean
  onClick: () => void
  onLocate?: (q: Question) => void
}

function ObjectiveCard({ question, paperId, isActive, onClick, onLocate }: ObjectiveCardProps) {
  const { getProgress, selectOption, toggleMark } = useProgress()
  const [showAnalysis, setShowAnalysis] = useState(false)

  const progress = getProgress(paperId, question.id)
  const submitted = progress.submittedAt !== null
  const hasKey = !!question.answer
  const optionKeys = (Object.keys(question.options) as OptionKey[])
    .filter((k) => question.options[k])
    .sort()

  const hasAnalysis =
    !!question.analysis.coreAnalysis ||
    !!question.analysisText ||
    !!question.analysis.location ||
    (question.analysis.optionAnalysis !== undefined &&
      Object.values(question.analysis.optionAnalysis).some((v) => !!v)) ||
    (question.analysis.vocab?.length ?? 0) > 0

  function handleSelect(opt: OptionKey) {
    if (submitted) return
    selectOption(paperId, question.id, opt)
  }

  return (
    <div
      data-question-id={question.id}
      className={`paper-card p-2 sm:p-3 transition-all scroll-mt-2 ${
        isActive ? 'ring-2 ring-ochre shadow-paper-hover' : ''
      }`}
    >
      {/* 题头 */}
      <div className="flex items-start gap-1.5 sm:gap-2 cursor-pointer" onClick={onClick}>
        <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center font-mono text-[11px] sm:text-xs font-bold rounded-sm bg-ink text-paper">
          {question.id}
        </span>
        {question.question && (
          <p className="flex-1 text-sm text-ink-soft leading-relaxed pt-0.5 whitespace-pre-wrap">
            {question.question}
          </p>
        )}
        {!question.question && (
          <span className="flex-1 text-xs text-ink-muted italic pt-1">
            （见文章中空格 {question.id}）
          </span>
        )}
      </div>

      {/* 选项 */}
      {optionKeys.length > 0 && (
        <ul className="mt-1.5 sm:mt-2 ml-6 sm:ml-8 space-y-1">
          {optionKeys.map((key) => {
            const text = question.options[key]
            if (!text) return null
            const isSelected = progress.selected === key
            const isCorrect = question.answer === key
            const showResult = submitted && hasKey

            return (
              <li key={key}>
                <button
                  onClick={() => handleSelect(key)}
                  disabled={submitted}
                  className={`w-full text-left px-2.5 py-2 sm:py-1.5 rounded-sm text-xs leading-relaxed
                             border transition-all flex items-start gap-2
                             ${getOptionClass(isSelected, isCorrect, showResult)}`}
                >
                  <span className="flex-shrink-0 font-mono font-bold w-4">{key}</span>
                  <span className="flex-1 text-ink-soft">{text}</span>
                  {showResult && isCorrect && (
                    <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* 操作区 */}
      <div className="flex items-center gap-2 mt-1.5 sm:mt-2 ml-6 sm:ml-8">
        {/* 提交后反馈 */}
        {submitted && hasKey && (
          <span className={`text-xs font-medium ${progress.status === 'correct' ? 'text-green-700' : 'text-seal-dark'}`}>
            {progress.status === 'correct' ? '✓ 答对' : '✗ 答错'}
            <span className="ml-2 text-ink-muted font-mono">正确答案：{question.answer}</span>
          </span>
        )}
        {submitted && !hasKey && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ochre-dark">
            <CircleDot className="w-3 h-3" /> 已提交
            <span className="text-ink-muted font-mono">（参考答案待补充）</span>
          </span>
        )}
        {!submitted && optionKeys.length > 0 && (
          <span className="text-[10px] text-ink-muted/60 italic">作答后点击下方"提交本题型"</span>
        )}

        <button
          onClick={() => toggleMark(paperId, question.id)}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-sm border transition-colors ${
            progress.marked
              ? 'text-seal border-seal/40 bg-seal/5'
              : 'text-ink-muted border-line hover:text-seal hover:border-seal/40'
          }`}
        >
          <Flag className="w-3 h-3" />
          {progress.marked ? '已标记' : '标记'}
        </button>
        {submitted && hasAnalysis && (
          <button
            onClick={() => setShowAnalysis((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs text-ochre-dark hover:bg-ochre-pale/40 rounded-sm transition-colors"
          >
            <FileText className="w-3 h-3" />
            查看解析
            <ChevronDown className={`w-3 h-3 transition-transform ${showAnalysis ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* 解析（默认关闭，点击展开） */}
      {submitted && showAnalysis && hasAnalysis && (
        <div className="mt-1.5 sm:mt-2 ml-6 sm:ml-8 p-2.5 bg-paper-deep/30 rounded-sm border border-line-soft">
          {question.analysis.coreAnalysis && (
            <p className="text-xs text-ink-soft leading-relaxed whitespace-pre-wrap mb-2">
              {question.analysis.coreAnalysis}
            </p>
          )}
          {!question.analysis.coreAnalysis && question.analysisText && (
            <p className="text-xs text-ink-soft leading-relaxed whitespace-pre-wrap mb-2">
              {question.analysisText}
            </p>
          )}
          {question.analysis.location && (
            <div className="text-xs text-ochre-dark italic mt-2 pt-2 border-t border-line-soft flex items-start gap-1.5">
              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <span>原文定位：{question.analysis.location}</span>
                {onLocate && (
                  <button
                    onClick={() => onLocate(question)}
                    className="ml-2 px-1.5 py-0.5 text-[10px] not-italic font-mono bg-ochre-pale/40 hover:bg-ochre-pale text-ochre-dark rounded-sm transition-colors"
                    title="跳转到原文"
                  >
                    跳转 →
                  </button>
                )}
              </div>
            </div>
          )}
          {Object.keys(question.analysis.optionAnalysis ?? {}).length > 0 && (
            <ul className="text-xs text-ink-muted mt-2 pt-2 border-t border-line-soft space-y-1">
              {(Object.keys(question.analysis.optionAnalysis) as OptionKey[]).map((k) => {
                const text = question.analysis.optionAnalysis[k]
                if (!text) return null
                return (
                  <li key={k}>
                    <span className="font-mono font-bold mr-1.5">{k}.</span>
                    {text}
                  </li>
                )
              })}
            </ul>
          )}
          {question.analysis.vocab && question.analysis.vocab.length > 0 && (
            <div className="text-xs mt-2 pt-2 border-t border-line-soft">
              <span className="text-ink-muted">相关词汇：</span>
              {question.analysis.vocab.map((v, i) => (
                <span key={i} className="scholar-tag text-[10px] mr-1">{v}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getOptionClass(isSelected: boolean, isCorrect: boolean, showResult: boolean): string {
  if (showResult) {
    if (isCorrect) return 'border-green-500 bg-green-50 text-green-700'
    if (isSelected && !isCorrect) return 'border-seal/50 bg-seal/5 text-seal-dark'
    return 'border-line bg-transparent opacity-60'
  }
  if (isSelected) return 'border-ochre bg-ochre-pale/40 text-ink'
  return 'border-line bg-transparent hover:border-ochre/50 hover:bg-ochre-pale/20'
}

// =================================================================
// 主观题卡片（翻译 / 写作）：文本作答 + 参考答案 + 评分标准 + 自评
// =================================================================

interface SubjectiveCardProps {
  question: Question
  paperId: string
  isActive: boolean
  onClick: () => void
}

function SubjectiveCard({ question, paperId, isActive, onClick }: SubjectiveCardProps) {
  const { getProgress, setTextAnswer, setSelfScore, toggleMark } = useProgress()
  const progress = getProgress(paperId, question.id)
  const submitted = progress.submittedAt !== null
  const subj = question.subjective
  if (!subj) return null

  const text = progress.textAnswer ?? ''
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const selfScore = progress.selfScore

  return (
    <div
      data-question-id={question.id}
      className={`paper-card p-2 sm:p-3 transition-all scroll-mt-2 ${
        isActive ? 'ring-2 ring-ochre shadow-paper-hover' : ''
      }`}
    >
      {/* 题头 */}
      <div className="flex items-start gap-1.5 sm:gap-2 cursor-pointer" onClick={onClick}>
        <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center font-mono text-[11px] sm:text-xs font-bold rounded-sm bg-ochre-dark text-paper">
          {question.id}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap pt-0.5">
            {question.question}
          </p>
          {subj.wordLimit && (
            <p className="text-[10px] text-ink-muted mt-1">
              要求：{subj.wordLimit}
              {subj.maxScore ? ` · 满分 ${subj.maxScore} 分` : ''}
            </p>
          )}
        </div>
      </div>

      {/* 答题区 */}
      <div className="mt-1.5 sm:mt-2 ml-6 sm:ml-8">
        <textarea
          value={text}
          onChange={(e) => setTextAnswer(paperId, question.id, e.target.value)}
          disabled={submitted}
          placeholder={
            question.type === 'translation'
              ? '在此输入你的译文…'
              : '在此输入你的作文…'
          }
          rows={question.type === 'translation' ? 3 : 8}
          className="w-full p-2.5 text-sm text-ink-soft bg-paper-deep/30 border border-line-soft rounded-sm resize-y leading-relaxed focus:outline-none focus:border-ochre disabled:opacity-70 font-serif"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-ink-muted font-mono">
            {question.type === 'writing' ? `${wordCount} 词` : `${text.length} 字`}
          </span>
          <button
            onClick={() => toggleMark(paperId, question.id)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-sm border transition-colors ${
              progress.marked
                ? 'text-seal border-seal/40 bg-seal/5'
                : 'text-ink-muted border-line hover:text-seal hover:border-seal/40'
            }`}
          >
            <Flag className="w-3 h-3" />
            {progress.marked ? '已标记' : '标记'}
          </button>
        </div>
      </div>

      {/* 提交后：参考答案 + 评分标准 + 自评 */}
      {submitted && (
        <div className="mt-2 ml-8 p-2.5 bg-paper-deep/30 rounded-sm border border-line-soft space-y-2">
          <div className="flex items-center gap-1.5 text-ochre-dark">
            <Award className="w-3.5 h-3.5" />
            <span className="font-serif text-xs font-bold">参考答案与评分</span>
          </div>
          {/* 参考译文/范文 */}
          <div>
            <div className="text-[10px] font-mono text-ink-muted/60 uppercase mb-0.5">
              {question.type === 'translation' ? '参考译文' : '参考范文'}
            </div>
            {subj.reference ? (
              <p className="text-xs text-ink-soft leading-relaxed whitespace-pre-wrap font-serif">
                {subj.reference}
              </p>
            ) : (
              <p className="text-xs text-ink-muted/60 italic">参考答案待补充，可对照真题解析自评。</p>
            )}
          </div>
          {/* 评分标准 */}
          {subj.scoringCriteria && subj.scoringCriteria.length > 0 && (
            <div className="pt-2 border-t border-line-soft">
              <div className="text-[10px] font-mono text-ink-muted/60 uppercase mb-1">评分标准</div>
              <ul className="space-y-0.5">
                {subj.scoringCriteria.map((c, i) => (
                  <li key={i} className="text-xs text-ink-muted leading-relaxed flex items-start gap-1.5">
                    <span className="text-ochre-dark/60 font-mono mt-0.5">{i + 1}.</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* 自评 */}
          {subj.maxScore && (
            <div className="pt-2 border-t border-line-soft">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-ink-muted/60 uppercase">自评分数</span>
                <span className="text-xs font-mono font-bold text-ochre-dark">
                  {selfScore ?? '--'} / {subj.maxScore}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={subj.maxScore}
                step={1}
                value={selfScore ?? 0}
                onChange={(e) => setSelfScore(paperId, question.id, parseInt(e.target.value, 10))}
                className="w-full accent-ochre-dark"
              />
            </div>
          )}
          {/* 重新编辑：清除提交状态需重置整卷；此处保留文本可继续编辑 */}
        </div>
      )}

      {/* 未提交提示 */}
      {!submitted && (
        <p className="mt-1.5 ml-8 text-[10px] text-ink-muted/60 italic">
          作答后点击下方"提交本题型"查看参考答案与评分标准。
        </p>
      )}
    </div>
  )
}
