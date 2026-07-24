// 文章区（左栏）：渲染所有分区的文章，内含 ArticleView
// 每个分区有标题，每个文章独立支持查词/翻译/批注/空格

import { forwardRef } from 'react'
import ArticleView from './ArticleView'
import type { Paper } from '../../types'

interface ArticlePaneProps {
  paper: Paper
  activeQuestionId: number | null
  onBlankClick: (questionId: number) => void
}

const SECTION_LABEL: Record<string, string> = {
  cloze: '英语知识运用',
  reading: '阅读理解',
  newType: '新题型',
  translation: '翻译',
  writing: '写作',
}

const ArticlePane = forwardRef<HTMLDivElement, ArticlePaneProps>(
  function ArticlePane({ paper, activeQuestionId, onBlankClick }, ref) {
    return (
      <div ref={ref} className="lg:h-full lg:overflow-y-auto px-3 sm:px-4 py-3 sm:py-4">
        {/* 分区导航锚点 */}
        {paper.sections.map((sec) => (
          <div key={sec.id} data-section-id={sec.id} className="mb-4 sm:mb-6">
            <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-line">
              <h2 className="font-serif text-sm font-bold text-ochre-dark">
                {SECTION_LABEL[sec.type] ?? sec.title}
              </h2>
              <span className="text-[10px] text-ink-muted font-mono">
                {sec.articles.length} 篇 · {sec.questions.length} 题
              </span>
            </div>
            {sec.directions && (
              <p className="text-xs text-ink-muted italic mb-3 leading-relaxed">
                {sec.directions}
              </p>
            )}
            {sec.articles.map((art) => (
              <ArticleView
                key={art.id}
                article={art}
                paperId={paper.id}
                activeQuestionId={activeQuestionId}
                onBlankClick={onBlankClick}
              />
            ))}
          </div>
        ))}
      </div>
    )
  },
)

export default ArticlePane
