// 单篇文章视图：block 渲染 + 完形/新题型空格 + 划词查词/翻译 + 批注高亮
// 阅读理解文章支持批注；完形/新题型文章仅支持查词/翻译（空格会破坏字符偏移）

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Highlighter } from 'lucide-react'
import WordPopup from '../article/WordPopup'
import SelectionToolbar from '../article/SelectionToolbar'
import AnnotationEditor from '../article/AnnotationEditor'
import AnnotationList from '../article/AnnotationList'
import { useTextSelection } from '../../hooks/useTextSelection'
import { useAnnotations } from '../../context/AnnotationContext'
import { useProgress } from '../../context/ProgressContext'
import { applyHighlights, computeRangeOffsets, jumpToAnnotation } from '../../lib/annotationDom'
import type { Article, HighlightColor, Annotation, OptionKey, Block } from '../../types'

interface ArticleViewProps {
  article: Article
  paperId: string
  /** 当前激活的题号（用于高亮空格/段落） */
  activeQuestionId: number | null
  onBlankClick: (questionId: number) => void
}

type EditorState =
  | { mode: 'create'; text: string; start: number; end: number }
  | { mode: 'edit'; annotation: Annotation }
  | null

export default function ArticleView({
  article,
  paperId,
  activeQuestionId,
  onBlankClick,
}: ArticleViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const { selection, clear } = useTextSelection(textRef, { minLength: 1 })
  const { getAnnotations, addAnnotation, updateAnnotation, removeAnnotation, clearArticle } =
    useAnnotations()
  const { getProgress } = useProgress()

  // 含空格的题型（完形 / 新题型段落排序）：空格会破坏批注偏移，故不支持批注
  const hasBlanks = article.type === 'cloze' || article.type === 'newType'
  const articleId = `${paperId}:${article.id}`
  const annotations = getAnnotations(articleId)

  const [lookup, setLookup] = useState<{ text: string; rect: DOMRect } | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)

  // 新选区出现时关闭旧弹窗
  useLayoutEffect(() => {
    if (selection) setLookup(null)
  }, [selection])

  // 高亮渲染（仅无空格文章）
  useLayoutEffect(() => {
    if (hasBlanks) return
    const el = textRef.current
    if (!el) return
    applyHighlights(el, annotations)
  }, [annotations, article.id, hasBlanks])

  // 切换文章时清理
  useLayoutEffect(() => {
    setEditor(null)
    setLookup(null)
  }, [article.id])

  function openPopup() {
    if (!selection) return
    setLookup({ text: selection.text, rect: selection.rect })
    clear()
  }

  function handleAnnotate() {
    if (!selection || !textRef.current) return
    const offsets = computeRangeOffsets(textRef.current, selection.range)
    if (!offsets) return
    setEditor({ mode: 'create', text: selection.text, start: offsets.start, end: offsets.end })
    clear()
  }

  function handleEditorSave(note: string, color: HighlightColor) {
    if (!editor) return
    if (editor.mode === 'create') {
      addAnnotation({
        articleId,
        text: editor.text,
        startOffset: editor.start,
        endOffset: editor.end,
        note,
        color,
      })
    } else {
      updateAnnotation(editor.annotation.id, { note, color })
    }
    setEditor(null)
  }

  function handleArticleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    const mark = target.closest('mark.annot-mark')
    if (!mark) return
    const id = mark.getAttribute('data-annot-id')
    if (!id) return
    const ann = annotations.find((a) => a.id === id)
    if (ann) setEditor({ mode: 'edit', annotation: ann })
  }

  function handleJumpTo(id: string) {
    const el = textRef.current
    if (el) jumpToAnnotation(el, id)
  }

  // 空格状态
  function getBlankStatus(blankNum: number): { selected: OptionKey | null; status: string; submitted: boolean } {
    const p = getProgress(paperId, blankNum)
    return {
      selected: p.selected,
      status: p.status,
      submitted: p.submittedAt !== null,
    }
  }

  const editorProps = useMemo(() => {
    if (!editor) return null
    if (editor.mode === 'create') {
      return {
        open: true,
        selectedText: editor.text,
        initialNote: '',
        initialColor: 'yellow' as HighlightColor,
        onClose: () => setEditor(null),
        onSave: handleEditorSave,
      }
    }
    return {
      open: true,
      selectedText: editor.annotation.text,
      initialNote: editor.annotation.note,
      initialColor: editor.annotation.color,
      onClose: () => setEditor(null),
      onSave: handleEditorSave,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  return (
    <article
      ref={containerRef}
      data-article-id={article.id}
      className="mb-6 scroll-mt-2"
    >
      {/* 文章标题 */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-1.5 border-b border-line">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-ochre-dark flex-shrink-0" />
          <h3 className="font-serif text-sm font-bold text-ink truncate">
            {article.title ?? '正文'}
          </h3>
          {!hasBlanks && annotations.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-seal bg-seal/5 border border-seal/30 rounded-sm font-mono">
              <Highlighter className="w-2.5 h-2.5" />
              {annotations.length}
            </span>
          )}
        </div>
      </div>

      {/* 正文 */}
      <div
        ref={textRef}
        onClick={handleArticleClick}
        className="article-body text-article-base"
      >
        {renderBlocks(article.blocks, {
          hasBlanks,
          activeQuestionId,
          getBlankStatus,
          onBlankClick,
          articleId: article.id,
        })}
      </div>

      {/* 批注列表（仅无空格文章） */}
      {!hasBlanks && (
        <AnnotationList
          annotations={annotations}
          onEdit={(ann) => setEditor({ mode: 'edit', annotation: ann })}
          onRemove={removeAnnotation}
          onClearAll={() => clearArticle(articleId)}
          onJumpTo={handleJumpTo}
        />
      )}

      {/* 选区工具条 */}
      {selection && (
        <SelectionToolbar
          text={selection.text}
          rect={selection.rect}
          onLookup={openPopup}
          onTranslate={openPopup}
          onAnnotate={hasBlanks ? undefined : handleAnnotate}
        />
      )}

      {/* 查词/翻译弹窗 */}
      {lookup && (
        <WordPopup
          text={lookup.text}
          rect={lookup.rect}
          onClose={() => setLookup(null)}
          source={{ paperId, articleId: article.id }}
        />
      )}

      {/* 批注编辑器 */}
      {editorProps && <AnnotationEditor {...editorProps} />}
    </article>
  )
}

// =================================================================
// 统一 block 渲染：paragraph + blank 混合
// =================================================================

interface BlankStatus {
  selected: OptionKey | null
  status: string
  submitted: boolean
}

interface RenderBlocksOptions {
  hasBlanks: boolean
  activeQuestionId: number | null
  getBlankStatus: (n: number) => BlankStatus
  onBlankClick: (n: number) => void
  articleId: string
}

/**
 * 渲染 blocks 数组：
 * - paragraph block → <p> 标签，内含空段落时跳过
 * - blank block → <span class="cloze-blank">（完形 / 新题型）
 *
 * 含空格文章：连续的 paragraph + blank 在同一段内渲染
 * 无空格文章：每个 paragraph block 独立成段
 */
function renderBlocks(blocks: Block[], opts: RenderBlocksOptions) {
  if (!blocks || blocks.length === 0) return null

  if (!opts.hasBlanks) {
    // 阅读文章：每个 paragraph block 一个 <p>
    return blocks.map((block, i) => {
      if (block.type !== 'paragraph') return null
      return (
        <p
          key={i}
          data-paragraph-index={i}
          data-article-id={opts.articleId}
        >
          {block.content}
        </p>
      )
    })
  }

  // 含空格文章：把连续的 paragraph + blank 合并到同一段
  // 遇到空 content 的 paragraph 视为段落分隔
  const segments: React.ReactNode[] = []
  let currentPara: React.ReactNode[] = []
  let paraIndex = 0

  const flushPara = (key: number) => {
    if (currentPara.length > 0) {
      segments.push(
        <p
          key={`p-${key}`}
          data-paragraph-index={paraIndex}
          data-article-id={opts.articleId}
        >
          {currentPara}
        </p>,
      )
      paraIndex++
      currentPara = []
    }
  }

  blocks.forEach((block, i) => {
    if (block.type === 'paragraph') {
      // 空 content 视为段落分隔
      if (block.content === '') {
        flushPara(i)
      } else {
        currentPara.push(<span key={`t-${i}`}>{block.content}</span>)
      }
    } else {
      // blank block
      const num = block.blankId
      const isActive = opts.activeQuestionId === num
      const { selected, status, submitted } = opts.getBlankStatus(num)

      const classes = ['cloze-blank']
      if (submitted) {
        // 有标准答案：按对错着色；无标准答案（新题型 status='submitted'）：仅标记已答
        if (status === 'correct') classes.push('correct')
        else if (status === 'wrong') classes.push('wrong')
        else classes.push('answered')
      } else if (selected) {
        classes.push('answered')
      }
      if (isActive) classes.push('active')

      currentPara.push(
        <span
          key={`b-${i}`}
          className={classes.join(' ')}
          data-blank-num={num}
          onClick={(e) => {
            e.stopPropagation()
            opts.onBlankClick(num)
          }}
        >
          {submitted ? selected : num}
        </span>,
      )
    }
  })
  flushPara(blocks.length)

  return segments
}
