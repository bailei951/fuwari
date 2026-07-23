// 试卷阅读顶部栏：返回 + 标题 + 阅读模式切换 + 字号控制 + 分区导航

import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, GraduationCap } from 'lucide-react'
import FontSizeControl from '../article/FontSizeControl'
import type { FontScale } from '../../hooks/useFontScale'
import type { ReadMode, Paper, Section } from '../../types'

interface PaperHeaderProps {
  paper: Paper
  mode: ReadMode
  onModeChange: (mode: ReadMode) => void
  fontScale: FontScale
  onFontIncrease: () => void
  onFontDecrease: () => void
  onFontReset: () => void
  sections: Section[]
  onSectionJump: (sectionId: string) => void
}

const SECTION_SHORT_LABEL: Record<string, string> = {
  cloze: '完形',
  reading: '阅读',
  newType: '新题型',
  translation: '翻译',
  writing: '作文',
}

export default function PaperHeader({
  paper,
  mode,
  onModeChange,
  fontScale,
  onFontIncrease,
  onFontDecrease,
  onFontReset,
  sections,
  onSectionJump,
}: PaperHeaderProps) {
  return (
    <header className="flex-shrink-0 border-b border-line bg-paper/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* 返回 */}
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ochre-dark transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">目录</span>
        </Link>

        {/* 标题 */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="font-serif text-sm sm:text-base font-bold text-ink truncate">
            {paper.year} {paper.subject}
          </h1>
          <span className="hidden md:inline text-xs text-ink-muted font-mono">
            {paper.sections.reduce((sum, s) => sum + s.questions.length, 0)} 题
          </span>
        </div>

        {/* 字号控制 */}
        <div className="hidden sm:block flex-shrink-0">
          <FontSizeControl
            scale={fontScale}
            onIncrease={onFontIncrease}
            onDecrease={onFontDecrease}
            onReset={onFontReset}
          />
        </div>

        {/* 模式切换 */}
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-paper-deep/40 border border-line rounded-sm flex-shrink-0">
          <button
            onClick={() => onModeChange('original')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-sm transition-colors ${
              mode === 'original'
                ? 'bg-ink text-paper'
                : 'text-ink-muted hover:text-ochre-dark'
            }`}
            title="原卷模式：接近 PDF 阅读体验"
          >
            <BookOpen className="w-3 h-3" />
            <span className="hidden sm:inline">原卷</span>
          </button>
          <button
            onClick={() => onModeChange('study')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-sm transition-colors ${
              mode === 'study'
                ? 'bg-ink text-paper'
                : 'text-ink-muted hover:text-ochre-dark'
            }`}
            title="学习模式：答题、解析、查词、批注"
          >
            <GraduationCap className="w-3 h-3" />
            <span className="hidden sm:inline">学习</span>
          </button>
        </div>
      </div>

      {/* 分区快捷导航 */}
      <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {sections.map((sec) => (
          <button
            key={sec.id}
            onClick={() => onSectionJump(sec.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-ink-muted hover:text-ochre-dark hover:bg-ochre-pale/40 rounded-sm transition-colors whitespace-nowrap"
          >
            {SECTION_SHORT_LABEL[sec.type] ?? sec.title}
            <span className="font-mono text-[10px] text-ink-muted/60">
              {sec.questions.length}
            </span>
          </button>
        ))}
      </div>
    </header>
  )
}
