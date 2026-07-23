// 题号导航栏（右栏）：按分区展示所有题号，点击滚动到对应题目
// 显示答题状态色块

import type { Paper, QuestionStatus } from '../../types'

interface QuestionNavProps {
  paper: Paper
  /** questionId → status 映射 */
  getStatus: (questionId: number) => QuestionStatus | null
  isMarked: (questionId: number) => boolean
  activeQuestionId: number | null
  onQuestionClick: (questionId: number) => void
}

const SECTION_LABEL: Record<string, string> = {
  cloze: '英语知识运用',
  reading: '阅读理解',
  newType: '新题型',
  translation: '翻译',
  writing: '写作',
}

export default function QuestionNav({
  paper,
  getStatus,
  isMarked,
  activeQuestionId,
  onQuestionClick,
}: QuestionNavProps) {
  return (
    <nav className="w-full">
      {paper.sections.map((sec) => (
        <div key={sec.id} className="mb-4">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <h3 className="font-serif text-xs font-bold text-ochre-dark">
              {SECTION_LABEL[sec.type] ?? sec.title}
            </h3>
            <span className="text-[10px] text-ink-muted font-mono">
              {sec.questions.length}题
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {sec.questions.map((q) => {
              const status = getStatus(q.id)
              const marked = isMarked(q.id)
              const isActive = activeQuestionId === q.id

              return (
                <button
                  key={q.id}
                  onClick={() => onQuestionClick(q.id)}
                  className={`relative aspect-square flex items-center justify-center
                             text-xs font-mono font-bold rounded-sm border transition-all
                             ${getStatusClass(status, marked, isActive)}`}
                  title={`第 ${q.id} 题`}
                >
                  {q.id}
                  {marked && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-seal" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

function getStatusClass(
  status: QuestionStatus | null,
  marked: boolean,
  active: boolean,
): string {
  if (active) {
    return 'border-ink bg-ink text-paper ring-2 ring-ochre ring-offset-1'
  }
  if (!status || status === 'unanswered') {
    return marked
      ? 'border-seal/50 text-seal bg-seal/5'
      : 'border-line text-ink-muted hover:border-ochre hover:text-ochre-dark'
  }
  if (status === 'correct') {
    return 'border-green-500 text-green-700 bg-green-50'
  }
  if (status === 'submitted') {
    // 已提交但无标准答案（新题型 / 主观题）
    return 'border-ochre text-ochre-dark bg-ochre-pale/40'
  }
  // wrong
  return 'border-seal/50 text-seal-dark bg-seal/5'
}
