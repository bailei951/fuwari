// 专项训练页：按题型/年份/数量/模式抽取【完整题型单元】，整篇作答
//
// 单元 = 一篇文章 + 该文章下所有题目（整篇完形 / 整篇阅读 / 整篇新题型 / 翻译 / 写作）
// 流程：
//   1. 配置面板：题型 / 年份范围 / 单元数 / 模式 → 开始训练
//   2. 单元作答：展示完整文章 + 全部题目，逐题作答后"提交本单元"
//   3. 结果统计：按单元统计答对/答错/未答、正确率
//
// URL query: ?type=reading 自动预选题型

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Dice5,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Flag,
  BookOpen,
  Target,
  TrendingUp,
  Send,
  CheckCircle2 as CheckDone,
  FileText,
  ChevronDown,
  Award,
} from 'lucide-react'
import { useProgress } from '../context/ProgressContext'
import {
  drawUnits,
  getYearRange,
  DEFAULT_CONFIG,
  type TrainingUnit,
  type TrainingConfig,
} from '../lib/training'
import { SECTION_LABEL } from '../lib/wrongBook'
import type { SectionType, OptionKey, Question, Block } from '../types'

type Phase = 'config' | 'training' | 'result'

const TYPE_OPTIONS: Array<{ value: SectionType | 'all'; label: string }> = [
  { value: 'all', label: '全部客观题' },
  { value: 'cloze', label: SECTION_LABEL.cloze },
  { value: 'reading', label: SECTION_LABEL.reading },
  { value: 'newType', label: SECTION_LABEL.newType },
  { value: 'translation', label: SECTION_LABEL.translation },
  { value: 'writing', label: SECTION_LABEL.writing },
]

const MODE_OPTIONS: Array<{ value: TrainingConfig['mode']; label: string }> = [
  { value: 'all', label: '全部单元' },
  { value: 'wrong', label: '仅含错题' },
  { value: 'marked', label: '仅含标记题' },
]

const COUNT_OPTIONS = [3, 5, 10, 15]

export default function TrainingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { store, getProgress } = useProgress()

  const yearRange = useMemo(() => getYearRange(), [])

  const [config, setConfig] = useState<TrainingConfig>(() => {
    const queryType = searchParams.get('type') as SectionType | null
    return {
      ...DEFAULT_CONFIG,
      type:
        queryType &&
        ['cloze', 'reading', 'newType', 'translation', 'writing'].includes(queryType)
          ? queryType
          : 'all',
      yearFrom: yearRange.min,
      yearTo: yearRange.max,
    }
  })
  const [phase, setPhase] = useState<Phase>('config')
  const [loading, setLoading] = useState(false)
  const [units, setUnits] = useState<TrainingUnit[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)

  // 同步 query 参数到配置
  useEffect(() => {
    const queryType = searchParams.get('type') as SectionType | null
    if (queryType && queryType !== config.type) {
      setConfig((c) => ({ ...c, type: queryType }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function handleStart() {
    setLoading(true)
    try {
      const result = await drawUnits(config, store)
      setUnits(result)
      setCurrentIdx(0)
      setPhase(result.length > 0 ? 'training' : 'config')
    } catch (err) {
      console.error('[training] 抽题失败', err)
    } finally {
      setLoading(false)
    }
  }

  function handleRestart() {
    setUnits([])
    setCurrentIdx(0)
    setPhase('config')
  }

  const currentUnit = units[currentIdx]

  // 结果统计：基于 ProgressContext 状态（提交后写入 store）
  const resultStats = useMemo(() => {
    if (phase !== 'result') return null
    let correct = 0
    let wrong = 0
    let unanswered = 0
    let subjective = 0
    for (const unit of units) {
      for (const q of unit.questions) {
        const p = getProgress(unit.paperId, q.id)
        if (q.subjective) {
          if (p.submittedAt) subjective++
          else unanswered++
          continue
        }
        if (p.status === 'correct') correct++
        else if (p.status === 'wrong') wrong++
        else unanswered++
      }
    }
    const total = correct + wrong + unanswered + subjective
    const answered = correct + wrong
    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0
    return { correct, wrong, unanswered, subjective, total, answered, accuracy, unitCount: units.length }
  }, [phase, units, getProgress])

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 animate-fade-in">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Dice5 className="w-5 h-5 text-ochre-dark" />
          <h1 className="font-serif text-3xl font-bold text-ink">专项训练</h1>
        </div>
        <p className="text-sm text-ink-muted">
          按完整题型单元训练：每轮抽取整篇完形 / 整篇阅读 / 整篇新题型等，整篇作答后整体提交。
        </p>
      </header>

      {phase === 'config' && (
        <ConfigPanel
          config={config}
          setConfig={setConfig}
          yearRange={yearRange}
          loading={loading}
          onStart={handleStart}
          onTypeChange={(t) => {
            setConfig((c) => ({ ...c, type: t }))
            const next = new URLSearchParams(searchParams)
            if (t === 'all') next.delete('type')
            else next.set('type', t)
            setSearchParams(next, { replace: true })
          }}
        />
      )}

      {phase === 'training' && currentUnit && (
        <UnitView
          unit={currentUnit}
          index={currentIdx}
          total={units.length}
          onPrev={currentIdx > 0 ? () => setCurrentIdx(currentIdx - 1) : null}
          onNext={
            currentIdx < units.length - 1
              ? () => setCurrentIdx(currentIdx + 1)
              : () => setPhase('result')
          }
          onExit={handleRestart}
        />
      )}

      {phase === 'training' && units.length > 0 && !currentUnit && (
        <div className="paper-card p-6 text-center text-sm text-ink-muted">
          已完成全部单元。
          <button
            onClick={() => setPhase('result')}
            className="ml-2 text-ochre-dark underline"
          >
            查看结果
          </button>
        </div>
      )}

      {phase === 'result' && resultStats && (
        <ResultView stats={resultStats} onRestart={handleRestart} />
      )}
    </div>
  )
}

// ============================================================
// 配置面板
// ============================================================

interface ConfigPanelProps {
  config: TrainingConfig
  setConfig: React.Dispatch<React.SetStateAction<TrainingConfig>>
  yearRange: { min: number; max: number }
  loading: boolean
  onStart: () => void
  onTypeChange: (t: SectionType | 'all') => void
}

function ConfigPanel({
  config,
  setConfig,
  yearRange,
  loading,
  onStart,
  onTypeChange,
}: ConfigPanelProps) {
  return (
    <div className="space-y-4">
      {/* 题型选择 */}
      <section className="paper-card p-4">
        <h2 className="font-serif text-sm font-bold text-ink mb-3">题型</h2>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onTypeChange(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
                config.type === opt.value
                  ? 'bg-ink text-paper border-ink'
                  : 'border-line text-ink-muted hover:border-ochre hover:text-ochre-dark'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-ink-muted mt-2">
          每轮抽取整篇题型单元（如一整篇完形含 20 空、一整篇阅读含 5 题），而非零散题目。
        </p>
      </section>

      {/* 年份范围 */}
      <section className="paper-card p-4">
        <h2 className="font-serif text-sm font-bold text-ink mb-3">年份范围</h2>
        <div className="flex items-center gap-2 text-sm">
          <select
            value={config.yearFrom}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                yearFrom: Math.min(parseInt(e.target.value, 10), c.yearTo),
              }))
            }
            className="px-3 py-1.5 text-xs bg-paper-deep border border-line rounded-sm focus:outline-none focus:border-ochre"
          >
            {Array.from(
              { length: yearRange.max - yearRange.min + 1 },
              (_, i) => yearRange.min + i,
            ).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="text-ink-muted">至</span>
          <select
            value={config.yearTo}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                yearTo: Math.max(parseInt(e.target.value, 10), c.yearFrom),
              }))
            }
            className="px-3 py-1.5 text-xs bg-paper-deep border border-line rounded-sm focus:outline-none focus:border-ochre"
          >
            {Array.from(
              { length: yearRange.max - yearRange.min + 1 },
              (_, i) => yearRange.min + i,
            ).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* 模式 */}
      <section className="paper-card p-4">
        <h2 className="font-serif text-sm font-bold text-ink mb-3">单元来源</h2>
        <div className="flex flex-wrap gap-2">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setConfig((c) => ({ ...c, mode: opt.value }))}
              className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
                config.mode === opt.value
                  ? 'bg-ink text-paper border-ink'
                  : 'border-line text-ink-muted hover:border-ochre hover:text-ochre-dark'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-ink-muted mt-2">
          "仅含错题/标记题"：抽取包含至少一道错题/标记题的整篇单元，重练整篇。
        </p>
      </section>

      {/* 数量 */}
      <section className="paper-card p-4">
        <h2 className="font-serif text-sm font-bold text-ink mb-3">抽取单元数</h2>
        <div className="flex flex-wrap gap-2">
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setConfig((c) => ({ ...c, count: n }))}
              className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
                config.count === n
                  ? 'bg-ink text-paper border-ink'
                  : 'border-line text-ink-muted hover:border-ochre hover:text-ochre-dark'
              }`}
            >
              {n} 篇
            </button>
          ))}
        </div>
      </section>

      {/* 开始按钮 */}
      <button
        onClick={onStart}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-ink text-paper rounded-sm hover:bg-ochre-dark transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> 抽题中…
          </>
        ) : (
          <>
            <Dice5 className="w-4 h-4" /> 开始训练
          </>
        )}
      </button>

      {loading && (
        <p className="text-center text-xs text-ink-muted">
          正在加载试卷数据，首次加载可能稍慢…
        </p>
      )}
    </div>
  )
}

// ============================================================
// 单元作答视图：完整文章 + 全部题目 + 整体提交
// ============================================================

interface UnitViewProps {
  unit: TrainingUnit
  index: number
  total: number
  onPrev: (() => void) | null
  onNext: (() => void) | null
  onExit: () => void
}

function UnitView({ unit, index, total, onPrev, onNext, onExit }: UnitViewProps) {
  const {
    getProgress,
    selectOption,
    submitAnswer,
    submitSelection,
    setTextAnswer,
    submitSubjective,
    setSelfScore,
    toggleMark,
  } = useProgress()
  const [activeQId, setActiveQId] = useState<number | null>(
    unit.questions[0]?.id ?? null,
  )

  // 切换单元时重置激活题
  useEffect(() => {
    setActiveQId(unit.questions[0]?.id ?? null)
  }, [unit])

  // 统计：已提交 / 待提交
  const stats = unit.questions.reduce(
    (acc, q) => {
      const p = getProgress(unit.paperId, q.id)
      if (p.submittedAt) acc.submitted++
      else if (q.subjective ? p.textAnswer?.trim() : p.selected) acc.pending++
      return acc
    },
    { submitted: 0, pending: 0 },
  )
  const allSubmitted = stats.submitted === unit.questions.length
  const canSubmit = stats.pending > 0 && !allSubmitted

  function handleUnitSubmit() {
    for (const q of unit.questions) {
      const p = getProgress(unit.paperId, q.id)
      if (p.submittedAt) continue
      if (q.subjective) {
        if (p.textAnswer?.trim()) submitSubjective(unit.paperId, q.id)
      } else if (p.selected) {
        const ans = q.answer
        if (ans) submitAnswer(unit.paperId, q.id, ans)
        else submitSelection(unit.paperId, q.id)
      }
    }
  }

  function handleBlankClick(qId: number) {
    setActiveQId(qId)
    const el = document.getElementById(`train-q-${qId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="space-y-4">
      {/* 进度条 */}
      <div className="paper-card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-ink-muted font-mono">
            单元 {index + 1} / {total}
          </span>
          <div className="flex items-center gap-2">
            <span className="scholar-tag text-[10px]">
              {SECTION_LABEL[unit.sectionType]}
            </span>
            <span className="text-[10px] text-ink-muted font-mono">
              {unit.year} {unit.subject}
            </span>
          </div>
        </div>
        <div className="h-1.5 bg-paper-deep rounded-full overflow-hidden">
          <div
            className="h-full bg-ochre-dark transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* 文章（含完形空格） */}
      {unit.article && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-line">
            <BookOpen className="w-4 h-4 text-ochre-dark flex-shrink-0" />
            <h3 className="font-serif text-sm font-bold text-ink truncate">
              {unit.article.title ?? '正文'}
            </h3>
            <span className="text-[10px] text-ink-muted font-mono ml-auto">
              {unit.questions.length} 题
            </span>
          </div>
          {unit.directions && (
            <p className="text-xs text-ink-muted italic mb-3 leading-relaxed">
              {unit.directions}
            </p>
          )}
          <TrainingArticle
            blocks={unit.article.blocks}
            sectionType={unit.sectionType}
            paperId={unit.paperId}
            activeQuestionId={activeQId}
            onBlankClick={handleBlankClick}
            getProgress={getProgress}
          />
        </div>
      )}

      {/* 题目列表 */}
      <div className="space-y-3">
        {unit.questions.map((q) =>
          q.subjective ? (
            <TrainingSubjectiveCard
              key={q.id}
              question={q}
              paperId={unit.paperId}
              isActive={activeQId === q.id}
              onClick={() => setActiveQId(q.id)}
              getProgress={getProgress}
              setTextAnswer={setTextAnswer}
              setSelfScore={setSelfScore}
              toggleMark={toggleMark}
            />
          ) : (
            <TrainingObjectiveCard
              key={q.id}
              question={q}
              paperId={unit.paperId}
              isActive={activeQId === q.id}
              onClick={() => setActiveQId(q.id)}
              getProgress={getProgress}
              selectOption={selectOption}
              toggleMark={toggleMark}
            />
          ),
        )}
      </div>

      {/* 整体提交 */}
      <div className="paper-card p-3 flex items-center gap-2">
        <button
          onClick={handleUnitSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-ink text-paper rounded-sm hover:bg-ochre-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {allSubmitted ? (
            <>
              <CheckDone className="w-3.5 h-3.5" /> 本单元已提交
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" /> 提交本单元
            </>
          )}
        </button>
        <span className="text-[10px] text-ink-muted font-mono">
          已提交 {stats.submitted}/{unit.questions.length}
          {stats.pending > 0 && ` · 待提交 ${stats.pending}`}
        </span>
      </div>

      {/* 导航 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPrev?.()}
          disabled={!onPrev}
          className="inline-flex items-center gap-1 px-3 py-2 text-xs border border-line rounded-sm hover:bg-paper-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-3 h-3" /> 上一单元
        </button>
        <button
          onClick={() => onNext?.()}
          disabled={!onNext}
          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs bg-ink text-paper rounded-sm hover:bg-ochre-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {index === total - 1 ? (
            <>
              <Target className="w-3 h-3" /> 查看结果
            </>
          ) : (
            <>
              下一单元 <ArrowRight className="w-3 h-3" />
            </>
          )}
        </button>
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1 px-3 py-2 text-xs text-ink-muted hover:text-seal-dark transition-colors"
          title="退出训练"
        >
          <RotateCcw className="w-3 h-3" /> 退出
        </button>
      </div>
    </div>
  )
}

// ============================================================
// 训练用文章渲染（简化版：支持完形空格、阅读段落）
// ============================================================

interface TrainingArticleProps {
  blocks: Block[]
  sectionType: SectionType
  paperId: string
  activeQuestionId: number | null
  onBlankClick: (qId: number) => void
  getProgress: (paperId: string, qId: number) => {
    selected: OptionKey | null
    status: string
    submittedAt: string | null
  }
}

function TrainingArticle({
  blocks,
  sectionType,
  paperId,
  activeQuestionId,
  onBlankClick,
  getProgress,
}: TrainingArticleProps) {
  const hasBlanks = sectionType === 'cloze' || sectionType === 'newType'

  if (!hasBlanks) {
    // 阅读/翻译/写作文章：每段一个 <p>
    return (
      <div className="article-body text-article-base space-y-2">
        {blocks.map((block, i) => {
          if (block.type !== 'paragraph') return null
          return <p key={i} className="text-ink-soft leading-relaxed">{block.content}</p>
        })}
      </div>
    )
  }

  // 含空格文章：把连续的 paragraph + blank 合并到同一段
  const segments: React.ReactNode[] = []
  let currentPara: React.ReactNode[] = []
  let paraIndex = 0

  const flushPara = (key: number) => {
    if (currentPara.length > 0) {
      segments.push(
        <p key={`p-${key}`} className="text-ink-soft leading-relaxed">
          {currentPara}
        </p>,
      )
      paraIndex++
      currentPara = []
    }
  }

  blocks.forEach((block, i) => {
    if (block.type === 'paragraph') {
      if (block.content === '') {
        flushPara(i)
      } else {
        currentPara.push(<span key={`t-${i}`}>{block.content}</span>)
      }
    } else {
      const num = block.blankId
      const isActive = activeQuestionId === num
      const p = getProgress(paperId, num)
      const submitted = p.submittedAt !== null
      const classes = ['cloze-blank']
      if (submitted) {
        if (p.status === 'correct') classes.push('correct')
        else if (p.status === 'wrong') classes.push('wrong')
        else classes.push('answered')
      } else if (p.selected) {
        classes.push('answered')
      }
      if (isActive) classes.push('active')
      currentPara.push(
        <span
          key={`b-${i}`}
          className={classes.join(' ')}
          onClick={(e) => {
            e.stopPropagation()
            onBlankClick(num)
          }}
        >
          {submitted ? p.selected : num}
        </span>,
      )
    }
  })
  flushPara(blocks.length)

  return <div className="article-body text-article-base space-y-2">{segments}</div>
}

// ============================================================
// 客观题卡片
// ============================================================

interface ObjectiveCardProps {
  question: Question
  paperId: string
  isActive: boolean
  onClick: () => void
  getProgress: (paperId: string, qId: number) => {
    selected: OptionKey | null
    status: string
    submittedAt: string | null
    marked: boolean
  }
  selectOption: (paperId: string, qId: number, opt: OptionKey) => void
  toggleMark: (paperId: string, qId: number) => void
}

function TrainingObjectiveCard({
  question,
  paperId,
  isActive,
  onClick,
  getProgress,
  selectOption,
  toggleMark,
}: ObjectiveCardProps) {
  const progress = getProgress(paperId, question.id)
  const submitted = progress.submittedAt !== null
  const hasKey = !!question.answer
  const optionKeys = (Object.keys(question.options) as OptionKey[])
    .filter((k) => question.options[k])
    .sort()
  const [showAnalysis, setShowAnalysis] = useState(false)

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
      id={`train-q-${question.id}`}
      className={`paper-card p-4 scroll-mt-2 transition-all ${
        isActive ? 'ring-2 ring-ochre shadow-paper-hover' : ''
      }`}
    >
      {/* 题头 */}
      <div className="flex items-start gap-2 cursor-pointer" onClick={onClick}>
        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center font-mono text-xs font-bold rounded-sm bg-ink text-paper">
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
        <ul className="mt-2 ml-8 space-y-1">
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
                  className={`w-full text-left px-2.5 py-1.5 rounded-sm text-xs leading-relaxed border transition-all flex items-start gap-2 ${
                    showResult
                      ? isCorrect
                        ? 'border-green-500 bg-green-50/50 text-green-700'
                        : isSelected && !isCorrect
                          ? 'border-seal/50 bg-seal/5 text-seal-dark'
                          : 'border-line bg-transparent opacity-60'
                      : isSelected
                        ? 'border-ochre bg-ochre-pale/40 text-ink'
                        : 'border-line bg-transparent hover:border-ochre/50 hover:bg-ochre-pale/20'
                  } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className="flex-shrink-0 font-mono font-bold w-4">{key}</span>
                  <span className="flex-1 text-ink-soft">{text}</span>
                  {showResult && isCorrect && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* 操作区 */}
      <div className="flex items-center gap-2 mt-2 ml-8 flex-wrap">
        {submitted && hasKey && (
          <span
            className={`text-xs font-medium ${
              progress.status === 'correct' ? 'text-green-700' : 'text-seal-dark'
            }`}
          >
            {progress.status === 'correct' ? '✓ 答对' : '✗ 答错'}
            <span className="ml-2 text-ink-muted font-mono">正确答案：{question.answer}</span>
          </span>
        )}
        {submitted && !hasKey && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ochre-dark">
            <CheckCircle2 className="w-3 h-3" /> 已提交
            <span className="text-ink-muted font-mono">（参考答案待补充）</span>
          </span>
        )}
        {!submitted && optionKeys.length > 0 && (
          <span className="text-[10px] text-ink-muted/60 italic">
            作答后点击下方"提交本单元"
          </span>
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

      {/* 解析 */}
      {submitted && showAnalysis && hasAnalysis && (
        <div className="mt-2 ml-8 p-2.5 bg-paper-deep/30 rounded-sm border border-line-soft">
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
            <p className="text-xs text-ochre-dark italic mt-2 pt-2 border-t border-line-soft">
              原文定位：{question.analysis.location}
            </p>
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
                <span key={i} className="scholar-tag text-[10px] mr-1">
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 主观题卡片（翻译 / 写作）
// ============================================================

interface SubjectiveCardProps {
  question: Question
  paperId: string
  isActive: boolean
  onClick: () => void
  getProgress: (paperId: string, qId: number) => {
    textAnswer?: string
    selfScore?: number
    submittedAt: string | null
    marked: boolean
  }
  setTextAnswer: (paperId: string, qId: number, text: string) => void
  setSelfScore: (paperId: string, qId: number, score: number) => void
  toggleMark: (paperId: string, qId: number) => void
}

function TrainingSubjectiveCard({
  question,
  paperId,
  isActive,
  onClick,
  getProgress,
  setTextAnswer,
  setSelfScore,
  toggleMark,
}: SubjectiveCardProps) {
  const progress = getProgress(paperId, question.id)
  const submitted = progress.submittedAt !== null
  const subj = question.subjective
  if (!subj) return null

  const text = progress.textAnswer ?? ''
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const selfScore = progress.selfScore

  return (
    <div
      id={`train-q-${question.id}`}
      className={`paper-card p-4 scroll-mt-2 transition-all ${
        isActive ? 'ring-2 ring-ochre shadow-paper-hover' : ''
      }`}
    >
      {/* 题头 */}
      <div className="flex items-start gap-2 cursor-pointer" onClick={onClick}>
        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center font-mono text-xs font-bold rounded-sm bg-ochre-dark text-paper">
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
      <div className="mt-2 ml-8">
        <textarea
          value={text}
          onChange={(e) => setTextAnswer(paperId, question.id, e.target.value)}
          disabled={submitted}
          placeholder={
            question.type === 'translation' ? '在此输入你的译文…' : '在此输入你的作文…'
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
          <div>
            <div className="text-[10px] font-mono text-ink-muted/60 uppercase mb-0.5">
              {question.type === 'translation' ? '参考译文' : '参考范文'}
            </div>
            {subj.reference ? (
              <p className="text-xs text-ink-soft leading-relaxed whitespace-pre-wrap font-serif">
                {subj.reference}
              </p>
            ) : (
              <p className="text-xs text-ink-muted/60 italic">
                参考答案待补充，可对照真题解析自评。
              </p>
            )}
          </div>
          {subj.scoringCriteria && subj.scoringCriteria.length > 0 && (
            <div className="pt-2 border-t border-line-soft">
              <div className="text-[10px] font-mono text-ink-muted/60 uppercase mb-1">
                评分标准
              </div>
              <ul className="space-y-0.5">
                {subj.scoringCriteria.map((c, i) => (
                  <li
                    key={i}
                    className="text-xs text-ink-muted leading-relaxed flex items-start gap-1.5"
                  >
                    <span className="text-ochre-dark/60 font-mono mt-0.5">{i + 1}.</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {subj.maxScore && (
            <div className="pt-2 border-t border-line-soft">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-ink-muted/60 uppercase">
                  自评分数
                </span>
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
                onChange={(e) =>
                  setSelfScore(paperId, question.id, parseInt(e.target.value, 10))
                }
                className="w-full accent-ochre-dark"
              />
            </div>
          )}
        </div>
      )}

      {!submitted && (
        <p className="mt-1.5 ml-8 text-[10px] text-ink-muted/60 italic">
          作答后点击下方"提交本单元"查看参考答案与评分标准。
        </p>
      )}
    </div>
  )
}

// ============================================================
// 结果视图
// ============================================================

interface ResultViewProps {
  stats: {
    correct: number
    wrong: number
    unanswered: number
    subjective: number
    total: number
    answered: number
    accuracy: number
    unitCount: number
  }
  onRestart: () => void
}

function ResultView({ stats, onRestart }: ResultViewProps) {
  const { correct, wrong, unanswered, subjective, total, accuracy, unitCount } = stats

  return (
    <div className="space-y-4">
      <div className="paper-card p-8 text-center">
        <div className="inline-flex w-16 h-16 rounded-sm bg-ochre-pale/50 items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 text-ochre-dark" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-ink mb-1">训练完成</h2>
        <p className="text-sm text-ink-muted mb-6">
          本轮共 {unitCount} 个单元、{total} 道题
        </p>

        {/* 正确率大数字 */}
        <div className="mb-6">
          <div
            className={`text-5xl font-serif font-bold ${
              accuracy >= 60
                ? 'text-green-700'
                : accuracy >= 40
                  ? 'text-ochre-dark'
                  : 'text-seal-dark'
            }`}
          >
            {accuracy}%
          </div>
          <div className="text-xs text-ink-muted mt-1">客观题正确率</div>
        </div>

        {/* 分项统计 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="p-3 bg-green-50/40 rounded-sm border border-green-500/20">
            <CheckCircle2 className="w-4 h-4 mx-auto text-green-600 mb-1" />
            <div className="text-xl font-serif font-bold text-green-700">{correct}</div>
            <div className="text-[10px] text-ink-muted">答对</div>
          </div>
          <div className="p-3 bg-seal/5 rounded-sm border border-seal/20">
            <XCircle className="w-4 h-4 mx-auto text-seal-dark mb-1" />
            <div className="text-xl font-serif font-bold text-seal-dark">{wrong}</div>
            <div className="text-[10px] text-ink-muted">答错</div>
          </div>
          <div className="p-3 bg-paper-deep/40 rounded-sm border border-line">
            <div className="text-xl font-serif font-bold text-ink-muted mt-1">{unanswered}</div>
            <div className="text-[10px] text-ink-muted">未答</div>
          </div>
          <div className="p-3 bg-ochre-pale/30 rounded-sm border border-ochre/30">
            <Award className="w-4 h-4 mx-auto text-ochre-dark mb-1" />
            <div className="text-xl font-serif font-bold text-ochre-dark">{subjective}</div>
            <div className="text-[10px] text-ink-muted">主观题</div>
          </div>
        </div>

        <button
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-paper rounded-sm text-sm hover:bg-ochre-dark transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> 再来一轮
        </button>
      </div>
    </div>
  )
}
