// 文章视图：Markdown 渲染 + 字号控制 + 划词查词 + 批注高亮
// 划词后浮起工具条：查词（单词）/ 批注（任意选区）
// 批注以字符偏移持久化，重新打开可还原高亮

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BookOpen, ListTree, Highlighter } from 'lucide-react'
import FontSizeControl from './FontSizeControl'
import WordPopup from './WordPopup'
import SelectionToolbar from './SelectionToolbar'
import AnnotationEditor from './AnnotationEditor'
import AnnotationList from './AnnotationList'
import { useFontScale } from '../../hooks/useFontScale'
import { useTextSelection } from '../../hooks/useTextSelection'
import { useAnnotations } from '../../context/AnnotationContext'
import { applyHighlights, computeRangeOffsets, jumpToAnnotation } from '../../lib/annotationDom'
import type { Annotation, HighlightColor, Passage } from '../../types'

interface ArticleViewProps {
  passage: Passage
  examKey: string
  /** 顶部右侧附加控件 */
  headerExtra?: React.ReactNode
}

type EditorState =
  | { mode: 'create'; text: string; start: number; end: number }
  | { mode: 'edit'; annotation: Annotation }
  | null

export default function ArticleView({ passage, examKey, headerExtra }: ArticleViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const articleTextRef = useRef<HTMLDivElement>(null)
  const fontScale = useFontScale()
  const { selection, clear } = useTextSelection(articleTextRef, { minLength: 1 })
  const { getAnnotations, addAnnotation, updateAnnotation, removeAnnotation, clearArticle } =
    useAnnotations()

  const articleId = `${examKey}:${passage.id}`
  const annotations = getAnnotations(articleId)

  // 查词弹窗状态
  const [lookup, setLookup] = useState<{ text: string; rect: DOMRect } | null>(null)
  // 批注编辑器状态（创建/编辑共用）
  const [editor, setEditor] = useState<EditorState>(null)

  // ReactMarkdown 的 components 配置必须稳定，否则每次渲染会生成新对象
  // 导致 ReactMarkdown 重新挂载整棵子树，划词时捕获的 Range 引用会失效
  const markdownComponents = useMemo<Components>(
    () => ({
      h1: ({ node, ...props }) => (
        <h1
          className="font-serif text-2xl font-bold text-ink mb-4 mt-2 pb-2 border-b border-line"
          {...props}
        />
      ),
      h2: ({ node, ...props }) => (
        <h2
          className="font-serif text-xl font-bold text-ink mb-3 mt-5 text-ochre-dark"
          {...props}
        />
      ),
      h3: ({ node, ...props }) => (
        <h3 className="font-serif text-lg font-bold text-ink mb-2 mt-4" {...props} />
      ),
      p: ({ node, ...props }) => <p {...props} />,
      strong: ({ node, ...props }) => <strong className="font-bold text-ink" {...props} />,
      em: ({ node, ...props }) => <em className="italic text-ochre-dark" {...props} />,
      blockquote: ({ node, ...props }) => (
        <blockquote
          className="my-4 pl-4 border-l-2 border-ochre/40 italic text-ink-muted"
          {...props}
        />
      ),
      code: ({ node, ...props }) => (
        <code className="font-mono text-sm bg-paper-deep/60 px-1.5 py-0.5 rounded-sm" {...props} />
      ),
    }),
    [],
  )

  // 新选区出现时，关闭旧的查词弹窗
  useLayoutEffect(() => {
    if (selection) setLookup(null)
  }, [selection])

  // 高亮渲染：内容 / 批注变化后重排
  useLayoutEffect(() => {
    const el = articleTextRef.current
    if (!el) return
    applyHighlights(el, annotations)
  }, [annotations, passage.content])

  // 切换文章时清理编辑器
  const passageId = passage.id
  useLayoutEffect(() => {
    setEditor(null)
    setLookup(null)
  }, [passageId])

  function handleLookup() {
    if (!selection) return
    setLookup({ text: selection.text, rect: selection.rect })
    clear()
  }

  function handleAnnotate() {
    if (!selection || !articleTextRef.current) return
    const offsets = computeRangeOffsets(articleTextRef.current, selection.range)
    if (!offsets) return
    setEditor({
      mode: 'create',
      text: selection.text,
      start: offsets.start,
      end: offsets.end,
    })
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
    const el = articleTextRef.current
    if (el) jumpToAnnotation(el, id)
  }

  // 编辑器 props
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
  }, [editor])

  return (
    <div className="paper-card overflow-hidden flex flex-col h-full">
      {/* 文章头部 */}
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line bg-paper-deep/30 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-ochre-dark flex-shrink-0" />
          <h2 className="font-serif font-bold text-ink text-sm truncate">
            {passage.title ?? '正文'}
          </h2>
          <span className="text-xs text-ink-muted font-mono">
            {passage.content.length} 字符
          </span>
          {annotations.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-seal bg-seal/5 border border-seal/30 rounded-sm font-mono">
              <Highlighter className="w-2.5 h-2.5" />
              {annotations.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <FontSizeControl
            scale={fontScale.scale}
            onIncrease={fontScale.increase}
            onDecrease={fontScale.decrease}
            onReset={fontScale.reset}
          />
          {headerExtra}
        </div>
      </header>

      {/* 文章正文 */}
      <div
        ref={containerRef}
        className={`article-body ${fontScale.className} px-7 py-6 overflow-y-auto flex-1`}
      >
        {/* 仅 Markdown 正文：划词 + 高亮的锚点 */}
        <div ref={articleTextRef} onClick={handleArticleClick}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {passage.content}
          </ReactMarkdown>
        </div>

        {/* 长难句 */}
        {passage.longSentences && passage.longSentences.length > 0 && (
          <div className="mt-8 pt-5 border-t border-line-soft">
            <div className="flex items-center gap-2 mb-3">
              <ListTree className="w-4 h-4 text-seal" />
              <h3 className="font-serif font-bold text-ink text-sm">长难句解析</h3>
              <span className="scholar-tag">{passage.longSentences.length}</span>
            </div>
            <div className="space-y-3">
              {passage.longSentences.map((ls) => (
                <details
                  key={ls.id}
                  className="group border border-line-soft rounded-sm bg-paper-deep/20"
                >
                  <summary className="px-3 py-2 cursor-pointer text-sm text-ink-soft font-serif italic hover:bg-paper-deep/40 transition-colors">
                    {ls.sentence}
                  </summary>
                  <div className="px-3 py-2 border-t border-line-soft space-y-2">
                    <div>
                      <span className="scholar-tag mr-2">结构</span>
                      <span className="text-xs text-ink-soft">{ls.structure}</span>
                    </div>
                    <div>
                      <span className="scholar-tag mr-2">译文</span>
                      <span className="text-xs text-ink-soft">{ls.translation}</span>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* 词汇表 */}
        {passage.vocabulary && passage.vocabulary.length > 0 && (
          <div className="mt-8 pt-5 border-t border-line-soft">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-ochre-dark" />
              <h3 className="font-serif font-bold text-ink text-sm">文章词汇</h3>
              <span className="scholar-tag">{passage.vocabulary.length}</span>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {passage.vocabulary.map((v, i) => (
                <li
                  key={i}
                  className="text-xs px-2 py-1 bg-paper-deep/30 rounded-sm flex items-baseline gap-2"
                >
                  <span className="font-serif font-bold text-ink">{v.word}</span>
                  {v.phonetic && (
                    <span className="font-mono text-ochre-dark text-[10px]">{v.phonetic}</span>
                  )}
                  <span className="scholar-tag text-[10px] py-0">{v.pos}</span>
                  <span className="text-ink-soft">{v.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 批注列表 */}
        <AnnotationList
          annotations={annotations}
          onEdit={(ann) => setEditor({ mode: 'edit', annotation: ann })}
          onRemove={removeAnnotation}
          onClearAll={() => clearArticle(articleId)}
          onJumpTo={handleJumpTo}
        />
      </div>

      {/* 选区工具条 */}
      {selection && (
        <SelectionToolbar
          text={selection.text}
          rect={selection.rect}
          onLookup={handleLookup}
          onAnnotate={handleAnnotate}
        />
      )}

      {/* 查词弹窗 */}
      {lookup && (
        <WordPopup
          text={lookup.text}
          rect={lookup.rect}
          onClose={() => setLookup(null)}
          source={{ examKey, passageId: passage.id }}
        />
      )}

      {/* 批注编辑器 */}
      {editorProps && <AnnotationEditor {...editorProps} />}
    </div>
  )
}
