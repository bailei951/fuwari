// 单篇文章视图：block 渲染 + 完形/新题型空格 + 划词查词/翻译 + 批注高亮
// 阅读理解文章支持批注；完形/新题型文章仅支持查词/翻译（空格会破坏字符偏移）
//
// 使用者视角增强：
// - 段落序号：阅读文章每个自然段带 ①②③ 标识，方便做题时定位原文
// - 段落导航：长文章可从段落菜单快速跳转到指定段落
// - 句译模式：开启后点击句子即在句下显示译文（划词翻译依旧可用）
// - 译文显隐：一键显示/隐藏全部句译文，不影响原文阅读体验

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Highlighter, Languages, ListOrdered, Eye, EyeOff } from 'lucide-react'
import WordPopup from '../article/WordPopup'
import SelectionToolbar from '../article/SelectionToolbar'
import AnnotationEditor from '../article/AnnotationEditor'
import AnnotationList from '../article/AnnotationList'
import { useTextSelection } from '../../hooks/useTextSelection'
import { useAnnotations } from '../../context/AnnotationContext'
import { useProgress } from '../../context/ProgressContext'
import { applyHighlights, computeRangeOffsets, jumpToAnnotation } from '../../lib/annotationDom'
import { splitSentences, circledNumber } from '../../lib/sentenceSplit'
import { translate } from '../../lib/translate'
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

/** 句子翻译状态（按句子原文索引） */
interface SentenceTrans {
  loading: boolean
  translation?: string
  error?: string
}

/** 显示段落序号的最少段落数 */
const PARANUM_THRESHOLD = 2

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

  // 句译模式 + 译文显隐
  const [sentMode, setSentMode] = useState(false)
  const [showTrans, setShowTrans] = useState(true)
  // 段落导航菜单
  const [paraMenuOpen, setParaMenuOpen] = useState(false)

  // 非空段落列表（用于段落序号 / 导航）
  const paragraphs = useMemo(
    () =>
      article.blocks.filter(
        (b): b is Extract<Block, { type: 'paragraph' }> =>
          b.type === 'paragraph' && b.content.trim().length > 0,
      ),
    [article.blocks],
  )
  const showParaNums = !hasBlanks && paragraphs.length >= PARANUM_THRESHOLD

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
  }, [annotations, article.id, hasBlanks, sentMode])

  // 切换文章时清理
  useLayoutEffect(() => {
    setEditor(null)
    setLookup(null)
    setSentMode(false)
    setParaMenuOpen(false)
  }, [article.id])

  // 点击外部关闭段落菜单
  useEffect(() => {
    if (!paraMenuOpen) return
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setParaMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [paraMenuOpen])

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

  /** 段落导航：滚动到指定段落 */
  function handleJumpToParagraph(paraIndex: number) {
    setParaMenuOpen(false)
    const el = textRef.current?.querySelector(`[data-paragraph-index="${paraIndex}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
      {/* 文章标题 + 工具按钮 */}
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

        {/* 工具条：句译模式 / 译文显隐 / 段落导航 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 句译模式（仅无空格文章） */}
          {!hasBlanks && (
            <button
              onClick={() => setSentMode((v) => !v)}
              className={`inline-flex items-center gap-1 px-1.5 py-1 text-[11px] rounded-sm border transition-colors ${
                sentMode
                  ? 'bg-ochre-pale/70 text-ochre-dark border-ochre/40 font-medium'
                  : 'text-ink-muted border-line hover:text-ochre-dark hover:border-ochre/40'
              }`}
              title={sentMode ? '关闭句译模式' : '句译模式：点击句子显示译文'}
            >
              <Languages className="w-3 h-3" />
              <span className="hidden sm:inline">句译</span>
            </button>
          )}

          {/* 译文显隐（句译模式下有译文时显示） */}
          {sentMode && (
            <button
              onClick={() => setShowTrans((v) => !v)}
              className={`inline-flex items-center gap-1 px-1.5 py-1 text-[11px] rounded-sm border transition-colors ${
                showTrans
                  ? 'bg-ochre-pale/70 text-ochre-dark border-ochre/40'
                  : 'text-ink-muted border-line hover:text-ochre-dark hover:border-ochre/40'
              }`}
              title={showTrans ? '隐藏全部译文' : '显示全部译文'}
            >
              {showTrans ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span className="hidden sm:inline">译文</span>
            </button>
          )}

          {/* 段落导航（≥2 段时显示） */}
          {paragraphs.length >= PARANUM_THRESHOLD && (
            <div className="relative">
              <button
                onClick={() => setParaMenuOpen((v) => !v)}
                className={`inline-flex items-center gap-1 px-1.5 py-1 text-[11px] rounded-sm border transition-colors ${
                  paraMenuOpen
                    ? 'bg-ochre-pale/70 text-ochre-dark border-ochre/40'
                    : 'text-ink-muted border-line hover:text-ochre-dark hover:border-ochre/40'
                }`}
                title="段落导航：快速跳转到指定段落"
              >
                <ListOrdered className="w-3 h-3" />
                <span className="hidden sm:inline">段落</span>
              </button>

              {paraMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-40 w-56 max-h-64 overflow-y-auto paper-card shadow-paper-hover animate-pop-in">
                  {paragraphs.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleJumpToParagraph(i)}
                      className="w-full text-left px-2.5 py-2 text-xs text-ink-soft hover:bg-ochre-pale/50 border-b border-line-soft last:border-b-0 transition-colors"
                    >
                      <span className="text-ochre-dark font-mono mr-1.5">
                        {circledNumber(i + 1)}
                      </span>
                      {p.content.slice(0, 46)}
                      {p.content.length > 46 ? '…' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 正文 */}
      <div
        ref={textRef}
        onClick={handleArticleClick}
        className="article-body text-article-base"
      >
        {hasBlanks ? (
          renderBlankBlocks(article.blocks, {
            activeQuestionId,
            getBlankStatus,
            onBlankClick,
            articleId: article.id,
          })
        ) : (
          <ReadingBody
            key={article.id}
            blocks={article.blocks}
            sentMode={sentMode}
            showTrans={showTrans}
            showParaNums={showParaNums}
          />
        )}
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
// 阅读文章正文：段落序号 + 句译模式
// =================================================================

interface ReadingBodyProps {
  blocks: Block[]
  /** 句译模式：点击句子显示译文 */
  sentMode: boolean
  /** 是否显示句译文（全局开关） */
  showTrans: boolean
  /** 是否显示段落序号 */
  showParaNums: boolean
}

/**
 * 无空格文章正文渲染：
 * - 每个 paragraph block 独立成段，可带 ①②③ 段落序号（CSS ::before，不进入文本流）
 * - 句译模式：段落切分为句子 span，点击翻译，译文显示在句下
 *   （句子间以空格连接，textContent 与整段渲染一致，批注偏移不受影响）
 */
function ReadingBody({ blocks, sentMode, showTrans, showParaNums }: ReadingBodyProps) {
  const [trans, setTrans] = useState<Record<string, SentenceTrans>>({})

  // 句子切分缓存（按段落内容 memo）
  const sentenceCache = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const b of blocks) {
      if (b.type === 'paragraph' && b.content.trim()) {
        map.set(b.content, splitSentences(b.content))
      }
    }
    return map
  }, [blocks])

  /** 句子已被译过 → 再点击切换该句译文显隐 */
  function handleSentenceClick(text: string) {
    const existing = trans[text]
    if (existing && existing.translation) {
      // 单句显隐切换：通过清除记录隐藏（再次点击重新走缓存，秒出）
      setTrans((prev) => {
        const next = { ...prev }
        delete next[text]
        return next
      })
      return
    }
    if (existing?.loading) return

    setTrans((prev) => ({ ...prev, [text]: { loading: true } }))
    translate(text)
      .then((r) => {
        const translation =
          r.kind === 'word'
            ? r.data.found
              ? r.data.meanings.join('；')
              : ''
            : r.found
              ? r.translation
              : ''
        setTrans((prev) => ({ ...prev, [text]: { loading: false, translation } }))
      })
      .catch((err) => {
        setTrans((prev) => ({
          ...prev,
          [text]: { loading: false, error: err instanceof Error ? err.message : '翻译失败' },
        }))
      })
  }

  let paraIndex = -1
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type !== 'paragraph' || !block.content.trim()) return null
        paraIndex++
        const sentences = sentMode ? (sentenceCache.get(block.content) ?? []) : null

        return (
          <p
            key={i}
            data-paragraph-index={paraIndex}
            data-para-num={
              showParaNums ? circledNumber(paraIndex + 1) : undefined
            }
          >
            {sentences && sentences.length > 0
              ? sentences.map((s, j) => (
                  <Fragment key={j}>
                    <span
                      className={sentMode ? 'sent-clickable' : undefined}
                      onClick={sentMode ? () => handleSentenceClick(s) : undefined}
                    >
                      {s}
                    </span>{' '}
                    {trans[s] && showTrans && (
                      <span className="sent-trans">
                        {trans[s].loading
                          ? '翻译中…'
                          : trans[s].error
                            ? `⚠ ${trans[s].error}`
                            : trans[s].translation}
                      </span>
                    )}
                  </Fragment>
                ))
              : block.content}
          </p>
        )
      })}
    </>
  )
}

// =================================================================
// 完形 / 新题型：paragraph + blank 混合渲染
// =================================================================

interface BlankStatus {
  selected: OptionKey | null
  status: string
  submitted: boolean
}

interface RenderBlocksOptions {
  activeQuestionId: number | null
  getBlankStatus: (n: number) => BlankStatus
  onBlankClick: (n: number) => void
  articleId: string
}

/**
 * 渲染含空格文章：把连续的 paragraph + blank 合并到同一段
 * 遇到空 content 的 paragraph 视为段落分隔
 */
function renderBlankBlocks(blocks: Block[], opts: RenderBlocksOptions) {
  if (!blocks || blocks.length === 0) return null

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
