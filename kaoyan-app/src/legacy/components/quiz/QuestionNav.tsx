// 题号导航网格：展示所有题号 + 状态颜色，点击滚动定位

import { useEffect, useState } from 'react'

interface QuestionNavProps {
  questions: { id: number }[]
  examKey: string
  /** 获取每题状态：unanswered/correct/wrong/marked */
  getStatus: (questionId: number) => 'unanswered' | 'correct' | 'wrong' | 'marked' | 'marked-correct' | 'marked-wrong'
}

export default function QuestionNav({ questions, getStatus }: Omit<QuestionNavProps, 'examKey'>) {
  const [activeId, setActiveId] = useState<number | null>(null)

  // 监听滚动，高亮当前题
  useEffect(() => {
    const handler = () => {
      let current: number | null = null
      for (const q of questions) {
        const el = document.getElementById(`question-${q.id}`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top >= 80 && rect.top <= 300) {
          current = q.id
          break
        }
        if (rect.top < 80) current = q.id
      }
      setActiveId(current)
    }
    window.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => window.removeEventListener('scroll', handler)
  }, [questions])

  function handleClick(id: number) {
    const el = document.getElementById(`question-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="paper-card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-ink-muted">题号导航</span>
        <div className="flex items-center gap-2 text-[10px] text-ink-muted">
          <Legend color="bg-green-400" label="对" />
          <Legend color="bg-seal" label="错" />
          <Legend color="bg-ochre" label="标记" />
          <Legend color="bg-line" label="未答" />
        </div>
      </div>
      <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
        {questions.map((q) => {
          const status = getStatus(q.id)
          let bgClass = 'bg-paper-deep text-ink-muted hover:bg-paper-dark border-line'
          if (status === 'correct' || status === 'marked-correct') {
            bgClass = 'bg-green-100 text-green-800 border-green-300'
          } else if (status === 'wrong' || status === 'marked-wrong') {
            bgClass = 'bg-seal/10 text-seal-dark border-seal/40'
          } else if (status === 'marked') {
            bgClass = 'bg-ochre-pale/60 text-ochre-dark border-ochre/40'
          }
          const isActive = activeId === q.id
          return (
            <button
              key={q.id}
              onClick={() => handleClick(q.id)}
              className={`h-7 flex items-center justify-center text-xs font-mono border rounded-sm transition-all ${bgClass} ${
                isActive ? 'ring-2 ring-ochre ring-offset-1' : ''
              }`}
              title={`第 ${q.id} 题`}
            >
              {q.id}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className={`w-2 h-2 rounded-sm ${color}`} />
      {label}
    </span>
  )
}
