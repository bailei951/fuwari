// 专项训练页：按题型/年份/数量/模式抽题，逐题作答，查看结果
//
// 流程：
//   1. 配置面板：题型 / 年份范围 / 数量 / 模式 → 开始训练
//   2. 答题阶段：逐题展示题干 + 选项，支持选选项、提交、查看解析、上下题
//   3. 结果统计：答对/答错/未答、正确率、错题回顾入口
//
// URL query: ?type=reading 自动预选题型（来自 HistoryPage 题型浏览入口）

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
} from 'lucide-react'
import { useProgress } from '../context/ProgressContext'
import {
  drawQuestions,
  getYearRange,
  DEFAULT_CONFIG,
  type TrainingItem,
  type TrainingConfig,
} from '../lib/training'
import { SECTION_LABEL } from '../lib/wrongBook'
import type { SectionType, OptionKey } from '../types'

type Phase = 'config' | 'training' | 'result'

const TYPE_OPTIONS: Array<{ value: SectionType | 'all'; label: string }> = [
  { value: 'all', label: '全部题型' },
  { value: 'cloze', label: SECTION_LABEL.cloze },
  { value: 'reading', label: SECTION_LABEL.reading },
  { value: 'newType', label: SECTION_LABEL.newType },
]

const MODE_OPTIONS: Array<{ value: TrainingConfig['mode']; label: string }> = [
  { value: 'all', label: '全部题目' },
  { value: 'wrong', label: '仅错题' },
  { value: 'marked', label: '仅标记题' },
]

const COUNT_OPTIONS = [5, 10, 20, 30]

export default function TrainingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { store, getProgress, selectOption, submitAnswer, toggleMark } = useProgress()

  const yearRange = useMemo(() => getYearRange(), [])

  const [config, setConfig] = useState<TrainingConfig>(() => {
    const queryType = searchParams.get('type') as SectionType | null
    return {
      ...DEFAULT_CONFIG,
      type: queryType && ['cloze', 'reading', 'newType', 'translation', 'writing'].includes(queryType)
        ? queryType
        : 'all',
      yearFrom: yearRange.min,
      yearTo: yearRange.max,
    }
  })
  const [phase, setPhase] = useState<Phase>('config')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<TrainingItem[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, OptionKey>>({}) // 本轮作答记录

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
      const result = await drawQuestions(config, store)
      setItems(result)
      setAnswers({})
      setCurrentIdx(0)
      setPhase(result.length > 0 ? 'training' : 'config')
    } catch (err) {
      console.error('[training] 抽题失败', err)
    } finally {
      setLoading(false)
    }
  }

  function handleRestart() {
    setItems([])
    setAnswers({})
    setCurrentIdx(0)
    setPhase('config')
  }

  function handleSelect(qId: number, opt: OptionKey) {
    setAnswers((prev) => ({ ...prev, [qId]: opt }))
  }

  // 提交答案：同步到 ProgressContext（保留在原卷的答题记录）
  function handleSubmitAnswer(item: TrainingItem, opt: OptionKey) {
    const { paperId, question } = item
    selectOption(paperId, question.id, opt)
    submitAnswer(paperId, question.id, question.answer)
    setAnswers((prev) => ({ ...prev, [question.id]: opt }))
  }

  const currentItem = items[currentIdx]

  // 结果统计
  const resultStats = useMemo(() => {
    if (phase !== 'result') return null
    let correct = 0
    let wrong = 0
    let unanswered = 0
    for (const item of items) {
      const prog = getProgress(item.paperId, item.question.id)
      if (prog.status === 'correct') correct++
      else if (prog.status === 'wrong') wrong++
      else unanswered++
    }
    const total = items.length
    const answered = correct + wrong
    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0
    return { correct, wrong, unanswered, total, answered, accuracy }
  }, [phase, items, getProgress])

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 animate-fade-in">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Dice5 className="w-5 h-5 text-ochre-dark" />
          <h1 className="font-serif text-3xl font-bold text-ink">专项训练</h1>
        </div>
        <p className="text-sm text-ink-muted">
          针对薄弱题型集中训练，从全部真题或错题本中随机抽题。
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
            // 同步到 URL
            const next = new URLSearchParams(searchParams)
            if (t === 'all') next.delete('type')
            else next.set('type', t)
            setSearchParams(next, { replace: true })
          }}
        />
      )}

      {phase === 'training' && currentItem && (
        <TrainingView
          item={currentItem}
          index={currentIdx}
          total={items.length}
          selected={answers[currentItem.question.id] ?? null}
          progress={getProgress(currentItem.paperId, currentItem.question.id)}
          onSelect={(opt) => handleSelect(currentItem.question.id, opt)}
          onSubmit={(opt) => handleSubmitAnswer(currentItem, opt)}
          onToggleMark={() => toggleMark(currentItem.paperId, currentItem.question.id)}
          onPrev={currentIdx > 0 ? () => setCurrentIdx(currentIdx - 1) : null}
          onNext={
            currentIdx < items.length - 1
              ? () => setCurrentIdx(currentIdx + 1)
              : () => setPhase('result')
          }
          onExit={handleRestart}
        />
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
          注：翻译与写作为主观题，暂不支持专项训练。
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
        <h2 className="font-serif text-sm font-bold text-ink mb-3">题目来源</h2>
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
      </section>

      {/* 数量 */}
      <section className="paper-card p-4">
        <h2 className="font-serif text-sm font-bold text-ink mb-3">抽题数量</h2>
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
              {n} 题
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
// 答题视图
// ============================================================

interface TrainingViewProps {
  item: TrainingItem
  index: number
  total: number
  selected: OptionKey | null
  progress: {
    selected: OptionKey | null
    status: 'unanswered' | 'correct' | 'wrong'
    marked: boolean
    submittedAt: string | null
  }
  onSelect: (opt: OptionKey) => void
  onSubmit: (opt: OptionKey) => void
  onToggleMark: () => void
  onPrev: (() => void) | null
  onNext: (() => void) | null
  onExit: () => void
}

function TrainingView({
  item,
  index,
  total,
  selected,
  progress,
  onSelect,
  onSubmit,
  onToggleMark,
  onPrev,
  onNext,
  onExit,
}: TrainingViewProps) {
  const q = item.question
  const submitted = progress.status !== 'unanswered'
  const isCorrect = progress.status === 'correct'

  const options: OptionKey[] = ['A', 'B', 'C', 'D']
  const isCloze = q.type === 'cloze'

  return (
    <div className="space-y-4">
      {/* 进度条 */}
      <div className="paper-card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-ink-muted font-mono">
            {index + 1} / {total}
          </span>
          <div className="flex items-center gap-2">
            <span className="scholar-tag text-[10px]">
              {SECTION_LABEL[q.type]}
            </span>
            <span className="text-[10px] text-ink-muted font-mono">
              {item.year} {item.subject}
            </span>
            <button
              onClick={onToggleMark}
              className={`p-1 rounded-sm transition-colors ${
                progress.marked
                  ? 'text-seal-dark bg-seal/5'
                  : 'text-ink-muted hover:text-seal-dark'
              }`}
              title={progress.marked ? '取消标记' : '标记此题'}
            >
              <Flag className="w-3.5 h-3.5" fill={progress.marked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-paper-deep rounded-full overflow-hidden">
          <div
            className="h-full bg-ochre-dark transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* 题目卡片 */}
      <div className="paper-card p-5">
        {/* 完形上下文 */}
        {isCloze && item.articleFirstPara && (
          <div className="mb-4 p-3 bg-paper-deep/40 border-l-2 border-ochre rounded-sm">
            <p className="text-[10px] text-ink-muted mb-1">
              <BookOpen className="w-3 h-3 inline mr-1" />
              文章上下文（节选）
            </p>
            <p className="text-xs text-ink-soft font-serif leading-relaxed line-clamp-3">
              {item.articleFirstPara}…
            </p>
          </div>
        )}

        {/* 题干 */}
        {q.question ? (
          <p className="font-serif text-ink-soft text-article-sm leading-relaxed mb-4">
            {q.question}
          </p>
        ) : (
          <p className="font-serif italic text-ink-muted text-sm mb-4">
            {isCloze
              ? `完形填空第 ${q.id} 空，请根据上下文选择最佳答案。`
              : `第 ${q.id} 题`}
          </p>
        )}

        {/* 选项 */}
        <div className="space-y-2">
          {options.map((opt) => {
            const isSelected = selected === opt
            const isAnswer = q.answer === opt
            const showCorrect = submitted && isAnswer
            const showWrong = submitted && isSelected && !isAnswer

            return (
              <button
                key={opt}
                onClick={() => !submitted && onSelect(opt)}
                disabled={submitted}
                className={`w-full flex items-start gap-3 p-3 rounded-sm border text-left transition-all ${
                  showCorrect
                    ? 'border-green-500 bg-green-50/50'
                    : showWrong
                      ? 'border-seal/50 bg-seal/5'
                      : isSelected
                        ? 'border-ochre bg-ochre-pale/40'
                        : 'border-line hover:border-ochre/60 hover:bg-paper-deep/40'
                } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span
                  className={`flex-shrink-0 w-6 h-6 flex items-center justify-center font-mono text-xs font-bold rounded-sm border ${
                    showCorrect
                      ? 'bg-green-500 text-white border-green-500'
                      : showWrong
                        ? 'bg-seal text-paper border-seal'
                        : isSelected
                          ? 'bg-ochre text-paper border-ochre'
                          : 'bg-paper-deep text-ink-muted border-line'
                  }`}
                >
                  {opt}
                </span>
                <span className="flex-1 text-sm text-ink-soft leading-relaxed pt-0.5">
                  {q.options[opt]}
                </span>
                {showCorrect && (
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                )}
                {showWrong && (
                  <XCircle className="w-4 h-4 text-seal flex-shrink-0 mt-0.5" />
                )}
              </button>
            )
          })}
        </div>

        {/* 提交按钮 */}
        {!submitted && (
          <button
            onClick={() => selected && onSubmit(selected)}
            disabled={!selected}
            className="w-full mt-4 px-4 py-2.5 bg-ink text-paper rounded-sm text-sm hover:bg-ochre-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            提交答案
          </button>
        )}

        {/* 答案反馈 */}
        {submitted && (
          <div
            className={`mt-4 p-3 rounded-sm border ${
              isCorrect
                ? 'border-green-500/40 bg-green-50/30'
                : 'border-seal/30 bg-seal/5'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-seal-dark" />
              )}
              <span
                className={`font-serif text-sm font-bold ${
                  isCorrect ? 'text-green-700' : 'text-seal-dark'
                }`}
              >
                {isCorrect ? '答对了' : '答错了'}
              </span>
              <span className="text-xs text-ink-muted ml-auto">
                正确答案：<span className="font-mono font-bold text-ink">{q.answer}</span>
              </span>
            </div>
            {/* 解析 */}
            {q.analysis.coreAnalysis && (
              <p className="text-xs text-ink-soft leading-relaxed border-t border-line pt-2 mt-2">
                <span className="font-bold text-ochre-dark">解析：</span>
                {q.analysis.coreAnalysis}
              </p>
            )}
            {q.analysis.location && (
              <p className="text-xs text-ink-muted mt-1">
                <span className="font-bold">原文定位：</span>
                {q.analysis.location}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 导航 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPrev?.()}
          disabled={!onPrev}
          className="inline-flex items-center gap-1 px-3 py-2 text-xs border border-line rounded-sm hover:bg-paper-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-3 h-3" /> 上一题
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
              下一题 <ArrowRight className="w-3 h-3" />
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
// 结果视图
// ============================================================

interface ResultViewProps {
  stats: {
    correct: number
    wrong: number
    unanswered: number
    total: number
    answered: number
    accuracy: number
  }
  onRestart: () => void
}

function ResultView({ stats, onRestart }: ResultViewProps) {
  const { correct, wrong, unanswered, total, accuracy } = stats

  return (
    <div className="space-y-4">
      <div className="paper-card p-8 text-center">
        <div className="inline-flex w-16 h-16 rounded-sm bg-ochre-pale/50 items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 text-ochre-dark" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-ink mb-1">训练完成</h2>
        <p className="text-sm text-ink-muted mb-6">
          本轮共 {total} 题，已完成 {correct + wrong} 题
        </p>

        {/* 正确率大数字 */}
        <div className="mb-6">
          <div
            className={`text-5xl font-serif font-bold ${
              accuracy >= 60 ? 'text-green-700' : accuracy >= 40 ? 'text-ochre-dark' : 'text-seal-dark'
            }`}
          >
            {accuracy}%
          </div>
          <div className="text-xs text-ink-muted mt-1">正确率</div>
        </div>

        {/* 分项统计 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
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
