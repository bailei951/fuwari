// 题目区（中栏）：按分区渲染所有题目
// 答题 · 解析（默认关闭，点击"查看解析"展开） · 按题型整体提交
// 客观题（完形/阅读/新题型）：选项作答；新题型选项可至 A-G，无标准答案时仅记录
// 主观题（翻译/写作）：文本作答 + 参考答案/评分标准 + 自评

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
// 分区块：题目列表 + 按题型整体提交
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
  const { getProgress, submitAnswer, submitSelection, submitSubjective } = useProgress()

  const questions = section.questions

  // 统计：已提交 / 已作答未提交
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
      <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-line">
        <h2 className="font-serif text-sm font-bold text-ochre-dark">
          {SECTION_LABEL[section.type] ?? section.title}
        </h2>
        <span className="text-[10px] text-ink-muted font-mono">
          {questions.length} 题
        </span>
        {section.directions && (
          <span className="text-[10px] text-ink-muted/70 italic ml-auto truncate max-w-[55%]" title={section.directions}>
            {section.directions.slice(0, 40)}…
          </span>
        )}
      </div>

      <div className="space-y-3">
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

      {/* 按题型整体提交 */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleSectionSubmit}
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
          已提交 {stats.submitted}/{questions.length}
          {stats.pending > 0 && ` · 待提交 ${stats.pending}`}
        </span>
      </div>
    </section>
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
      className={`paper-card p-3 transition-all scroll-mt-2 ${
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
                  className={`w-full text-left px-2.5 py-1.5 rounded-sm text-xs leading-relaxed
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
      <div className="flex items-center gap-2 mt-2 ml-8">
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
      className={`paper-card p-3 transition-all scroll-mt-2 ${
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
