// 单题卡片：选项 + 提交 + 状态徽章 + 标记按钮 + 展开解析

import { useState } from 'react'
import { ChevronDown, ChevronRight, Send, MapPin } from 'lucide-react'
import OptionButton from './OptionButton'
import AnswerBadge, { MarkButton } from './AnswerBadge'
import AnalysisPanel from '../analysis/AnalysisPanel'
import { useProgress } from '../../context/ProgressContext'
import type { OptionKey, Question } from '../../types'

interface QuestionItemProps {
  examKey: string
  question: Question
}

export default function QuestionItem({ examKey, question }: QuestionItemProps) {
  const { getProgress, selectOption, submitAnswer, toggleMark } = useProgress()
  const progress = getProgress(examKey, question.id)
  const submitted = progress.submittedAt !== null
  const [showAnalysis, setShowAnalysis] = useState(false)

  function handleSubmit() {
    if (!progress.selected) return
    submitAnswer(examKey, question.id, question.answer)
    // 自动展开解析
    setShowAnalysis(true)
  }

  return (
    <div
      id={`question-${question.id}`}
      className={`paper-card p-4 scroll-mt-20 transition-all ${
        submitted
          ? progress.status === 'correct'
            ? 'border-l-4 border-l-green-400'
            : 'border-l-4 border-l-seal/60'
          : ''
      }`}
    >
      {/* 题头 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="font-serif font-bold text-ochre-dark text-lg flex-shrink-0">
            {question.id}.
          </span>
          <div className="min-w-0">
            {question.question && (
              <p className="text-sm text-ink-soft leading-relaxed mb-1">{question.question}</p>
            )}
            {question.location && (
              <p className="text-xs text-ink-muted flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {question.location}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <AnswerBadge progress={progress} correctAnswer={submitted ? question.answer : undefined} />
          <MarkButton marked={progress.marked} onToggle={() => toggleMark(examKey, question.id)} />
        </div>
      </div>

      {/* 选项 */}
      <div className="space-y-2 mb-3">
        {(['A', 'B', 'C', 'D'] as OptionKey[]).map((key) => (
          <OptionButton
            key={key}
            optionKey={key}
            text={question.options[key]}
            selected={progress.selected === key}
            submitted={submitted}
            isCorrect={question.answer === key}
            isUserChoice={progress.selected === key}
            onSelect={(k) => selectOption(examKey, question.id, k)}
          />
        ))}
      </div>

      {/* 提交按钮 */}
      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={!progress.selected}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-ink text-paper rounded-sm text-sm hover:bg-ochre-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3 h-3" /> 提交答案
        </button>
      ) : (
        <button
          onClick={() => setShowAnalysis((v) => !v)}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs text-ochre-dark hover:underline"
        >
          {showAnalysis ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {showAnalysis ? '收起解析' : '查看解析'}
        </button>
      )}

      {/* 解析 */}
      {showAnalysis && submitted && (
        <div className="mt-3 pt-3 border-t border-line-soft animate-slide-up">
          <AnalysisPanel question={question} userAnswer={progress.selected} />
        </div>
      )}
    </div>
  )
}
