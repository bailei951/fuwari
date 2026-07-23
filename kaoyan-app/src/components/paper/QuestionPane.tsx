// 题目区（中栏）：按分区渲染所有题目
// 学习模式：选选项 → 提交 → 显示答案与解析
// 原卷模式：仅展示题干与选项，不显示答案
// 支持上一题/下一题导航按钮 + 原文定位跳转

import { useState } from 'react'
import { Check, Flag, FileText, ChevronDown, ChevronUp, ChevronDown as ChevronNext, MapPin } from 'lucide-react'
import type { Paper, Question, OptionKey, ReadMode } from '../../types'
import { useProgress } from '../../context/ProgressContext'

interface QuestionPaneProps {
  paper: Paper
  mode: ReadMode
  activeQuestionId: number | null
  onQuestionClick: (q: Question) => void
  /** 上一题回调（无则隐藏按钮） */
  onPrev?: (() => void) | null
  /** 下一题回调（无则隐藏按钮） */
  onNext?: (() => void) | null
  /** 当前题在整卷中的位置（1-based），用于显示 "3/52" */
  currentIndex?: number
  /** 总题数 */
  totalCount?: number
  /** 跳转到原文定位（点击解析中"原文定位"按钮触发） */
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
  mode,
  activeQuestionId,
  onQuestionClick,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
  onLocate,
}: QuestionPaneProps) {
  return (
    <div className="px-4 py-4 space-y-6">
      {/* 顶部导航条：上一题 / 当前位置 / 下一题 */}
      {(onPrev || onNext) && currentIndex !== undefined && totalCount !== undefined && (
        <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-paper/95 backdrop-blur-sm border-b border-line flex items-center justify-between gap-2">
          <button
            onClick={() => onPrev?.()}
            disabled={!onPrev}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-ink-soft hover:text-ochre-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="上一题（←）"
          >
            <ChevronUp className="w-3.5 h-3.5" />
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
        <section key={sec.id} data-section-id={sec.id}>
          <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-line">
            <h2 className="font-serif text-sm font-bold text-ochre-dark">
              {SECTION_LABEL[sec.type] ?? sec.title}
            </h2>
            <span className="text-[10px] text-ink-muted font-mono">
              {sec.questions.length} 题
            </span>
          </div>
          <div className="space-y-3">
            {sec.questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                paperId={paper.id}
                mode={mode}
                isActive={activeQuestionId === q.id}
                onClick={() => onQuestionClick(q)}
                onLocate={onLocate}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// =================================================================
// 单题卡片
// =================================================================

interface QuestionCardProps {
  question: Question
  paperId: string
  mode: ReadMode
  isActive: boolean
  onClick: () => void
  onLocate?: (q: Question) => void
}

function QuestionCard({ question, paperId, mode, isActive, onClick, onLocate }: QuestionCardProps) {
  const { getProgress, selectOption, submitAnswer, toggleMark } = useProgress()
  const [showAnalysis, setShowAnalysis] = useState(false)

  const progress = getProgress(paperId, question.id)
  const isStudy = mode === 'study'
  const submitted = progress.submittedAt !== null
  const hasOptions = Object.values(question.options).some((v) => v && v.trim().length > 0)
  // 是否有解析内容（结构化对象或旧字符串任一非空）
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

  function handleSubmit() {
    submitAnswer(paperId, question.id, question.answer)
    setShowAnalysis(true)
  }

  const optionKeys: OptionKey[] = ['A', 'B', 'C', 'D']

  return (
    <div
      data-question-id={question.id}
      className={`paper-card p-3 transition-all scroll-mt-2 ${
        isActive ? 'ring-2 ring-ochre shadow-paper-hover' : ''
      }`}
    >
      {/* 题头 */}
      <div
        className="flex items-start gap-2 cursor-pointer"
        onClick={onClick}
      >
        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center font-mono text-xs font-bold rounded-sm bg-ink text-paper">
          {question.id}
        </span>
        {question.question && (
          <p className="flex-1 text-sm text-ink-soft leading-relaxed pt-0.5">
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
      {hasOptions && (
        <ul className="mt-2 ml-8 space-y-1">
          {optionKeys.map((key) => {
            const text = question.options[key]
            if (!text) return null
            const isSelected = progress.selected === key
            const isCorrect = question.answer === key
            const showResult = isStudy && submitted

            return (
              <li key={key}>
                <button
                  onClick={() => handleSelect(key)}
                  disabled={!isStudy || submitted}
                  className={`w-full text-left px-2.5 py-1.5 rounded-sm text-xs leading-relaxed
                             border transition-all flex items-start gap-2
                             ${getOptionClass(isStudy, isSelected, isCorrect, showResult)}`}
                >
                  <span className="flex-shrink-0 font-mono font-bold w-4">
                    {key}
                  </span>
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

      {/* 操作区（学习模式） */}
      {isStudy && hasOptions && (
        <div className="flex items-center gap-2 mt-2 ml-8">
          {!submitted ? (
            <button
              onClick={handleSubmit}
              disabled={!progress.selected}
              className="px-3 py-1 text-xs bg-ink text-paper rounded-sm hover:bg-ochre-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              确认提交
            </button>
          ) : (
            <span className={`text-xs font-medium ${progress.status === 'correct' ? 'text-green-700' : 'text-seal-dark'}`}>
              {progress.status === 'correct' ? '✓ 答对' : '✗ 答错'}
              <span className="ml-2 text-ink-muted font-mono">
                正确答案：{question.answer}
              </span>
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
              解析
              <ChevronDown className={`w-3 h-3 transition-transform ${showAnalysis ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      )}

      {/* 原卷模式答案提示 */}
      {!isStudy && hasOptions && (
        <p className="mt-1.5 ml-8 text-[10px] text-ink-muted/50 italic">
          切换至学习模式可答题与查看解析
        </p>
      )}

      {/* 解析 */}
      {isStudy && submitted && showAnalysis && hasAnalysis && (
        <div className="mt-2 ml-8 p-2.5 bg-paper-deep/30 rounded-sm border border-line-soft">
          {/* 核心解析 */}
          {question.analysis.coreAnalysis && (
            <p className="text-xs text-ink-soft leading-relaxed whitespace-pre-wrap mb-2">
              {question.analysis.coreAnalysis}
            </p>
          )}
          {/* 兼容旧字符串：analysisText 优先显示（仅当 coreAnalysis 为空时） */}
          {!question.analysis.coreAnalysis && question.analysisText && (
            <p className="text-xs text-ink-soft leading-relaxed whitespace-pre-wrap mb-2">
              {question.analysisText}
            </p>
          )}
          {/* 原文定位 */}
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
          {/* 选项分析 */}
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
          {/* 相关词汇 */}
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

function getOptionClass(
  isStudy: boolean,
  isSelected: boolean,
  isCorrect: boolean,
  showResult: boolean,
): string {
  if (!isStudy) {
    return 'border-line bg-transparent cursor-default'
  }
  if (showResult) {
    if (isCorrect) return 'border-green-500 bg-green-50 text-green-700'
    if (isSelected && !isCorrect) return 'border-seal/50 bg-seal/5 text-seal-dark'
    return 'border-line bg-transparent opacity-60'
  }
  if (isSelected) return 'border-ochre bg-ochre-pale/40 text-ink'
  return 'border-line bg-transparent hover:border-ochre/50 hover:bg-ochre-pale/20'
}
