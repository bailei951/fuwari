// 划词查词弹窗：浮于选区上方
// 根据选中文本词数自动切换三种形态：
//   - 单词：原词 + 词根 + 音标 + 词性 + 中文释义 + 英文例句 + 加入生词本
//   - 短语：原短语 + 中文翻译
//   - 长句：中文翻译 + 主从句结构分析

import { useEffect, useState } from 'react'
import { X, BookPlus, Check, Loader2, Search, Languages, FileText, Quote } from 'lucide-react'
import { translate } from '../../lib/translate'
import { useVocab } from '../../context/VocabContext'
import type { TranslateResponse, LookupResult } from '../../types'

interface WordPopupProps {
  /** 选中的文本 */
  text: string
  /** 定位锚点（相对视口） */
  rect: DOMRect
  /** 关闭回调 */
  onClose: () => void
  /** 来源信息（加入生词本时附带） */
  source?: { paperId: string; articleId?: string }
}

export default function WordPopup({ text, rect, onClose, source }: WordPopupProps) {
  const [result, setResult] = useState<TranslateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const { addWord, hasWord } = useVocab()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setResult(null)
    setError(null)
    setAdded(false)
    translate(text)
      .then((r) => {
        if (!cancelled) {
          setResult(r)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '查询失败')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [text])

  // 弹窗定位：默认显示在选区上方，若空间不足则下方
  const popupWidth = 320
  const popupMaxHeight = 440
  const margin = 8

  let top = rect.top - popupMaxHeight - margin
  if (top < margin) top = rect.bottom + margin

  let left = rect.left + rect.width / 2 - popupWidth / 2
  left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin))

  function handleAdd() {
    if (!result || result.kind !== 'word') return
    const r = result.data
    if (!r.found) return
    const meaning = r.meanings.join('；')
    const ok = addWord(
      r.word,
      r.phonetic,
      meaning,
      source ? { paperId: source.paperId, articleId: source.articleId } : { paperId: '' },
    )
    if (ok) setAdded(true)
  }

  // 单词态：检查是否已加入生词本
  const wordResult: LookupResult | null =
    result && result.kind === 'word' ? result.data : null
  const alreadyInVocab = wordResult ? hasWord(wordResult.word) : false
  const showAddedState = added || alreadyInVocab

  return (
    <div
      data-word-popup
      className="fixed z-50 paper-card shadow-paper-hover animate-pop-in"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        width: `${popupWidth}px`,
        maxHeight: `${popupMaxHeight}px`,
      }}
    >
      {/* 头部：根据类型显示不同图标和标题 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-paper-deep/40">
        <div className="flex items-center gap-1.5 min-w-0">
          {result?.kind === 'word' && <Search className="w-3 h-3 text-ochre-dark flex-shrink-0" />}
          {result?.kind === 'phrase' && <Quote className="w-3 h-3 text-ochre-dark flex-shrink-0" />}
          {result?.kind === 'sentence' && <Languages className="w-3 h-3 text-ochre-dark flex-shrink-0" />}
          {!result && <Search className="w-3 h-3 text-ochre-dark flex-shrink-0" />}
          <span className="font-serif font-bold text-ink text-sm truncate">
            {text.length > 28 ? text.slice(0, 28) + '…' : text}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-ink-muted hover:text-seal transition-colors p-0.5"
          aria-label="关闭"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 内容 */}
      <div className="overflow-y-auto p-3" style={{ maxHeight: `${popupMaxHeight - 50}px` }}>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-ink-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {result?.kind === 'sentence' ? '翻译中…' : '查询中…'}
          </div>
        ) : error ? (
          <div className="py-4 text-center">
            <p className="font-serif italic text-seal-dark text-sm mb-1">查询失败</p>
            <p className="text-xs text-ink-muted/70 break-all">{error}</p>
          </div>
        ) : !result ? (
          <div className="py-4 text-center">
            <p className="font-serif italic text-ink-muted text-sm">无结果</p>
          </div>
        ) : result.kind === 'word' ? (
          <WordContent
            result={result.data}
            showAddedState={showAddedState}
            onAdd={handleAdd}
          />
        ) : result.kind === 'phrase' ? (
          <PhraseContent result={result} />
        ) : (
          <SentenceContent result={result} />
        )}
      </div>
    </div>
  )
}

// ============================================================
// 单词态
// ============================================================

interface WordContentProps {
  result: LookupResult
  showAddedState: boolean
  onAdd: () => void
}

function WordContent({ result, showAddedState, onAdd }: WordContentProps) {
  if (!result.found) {
    return (
      <div className="py-4 text-center">
        <p className="font-serif italic text-ink-muted text-sm mb-2">未找到该词</p>
        <p className="text-xs text-ink-muted/70 font-mono break-all">{result.word}</p>
        <p className="text-[10px] text-ink-muted/50 mt-2">
          已尝试词形还原与在线词典
        </p>
      </div>
    )
  }

  return (
    <>
      {/* 单词 + 词根 */}
      <div className="mb-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-serif text-base font-bold text-ink">{result.word}</span>
          {result.original && result.original !== result.word && (
            <span className="text-xs text-ink-muted font-mono">
              ← {result.original}
            </span>
          )}
        </div>
        {/* 音标 + 词性 */}
        <div className="flex items-center gap-2 mt-0.5">
          {result.phonetic && (
            <span className="font-mono text-xs text-ochre-dark">{result.phonetic}</span>
          )}
          {result.pos && (
            <span className="scholar-tag text-[10px]">{result.pos}</span>
          )}
        </div>
      </div>

      {/* 中文释义 */}
      {result.meanings.length > 0 && (
        <ul className="space-y-1 mb-3">
          {result.meanings.map((m, i) => (
            <li key={i} className="text-sm text-ink-soft leading-relaxed">
              <span className="text-ochre-dark/60 mr-1.5 font-mono text-xs">{i + 1}.</span>
              {m}
            </li>
          ))}
        </ul>
      )}

      {/* 英文例句 */}
      {result.examples.length > 0 && (
        <div className="mb-3 pt-2 border-t border-line-soft">
          <div className="text-[10px] font-mono text-ink-muted/60 uppercase mb-1">Examples</div>
          <ul className="space-y-1.5">
            {result.examples.slice(0, 3).map((ex, i) => (
              <li key={i} className="text-xs text-ink-muted leading-relaxed italic pl-2 border-l-2 border-ochre/30">
                {ex}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 底部：来源 + 加入生词本 */}
      <div className="flex items-center justify-between pt-2 border-t border-line-soft">
        <span className="text-[10px] font-mono text-ink-muted/60">
          {result.source === 'api' ? '在线词典' : '牛津高阶词典'}
        </span>
        <button
          onClick={onAdd}
          disabled={showAddedState}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs transition-all ${
            showAddedState
              ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
              : 'bg-ink text-paper hover:bg-ochre-dark'
          }`}
        >
          {showAddedState ? (
            <>
              <Check className="w-3 h-3" /> 已收录
            </>
          ) : (
            <>
              <BookPlus className="w-3 h-3" /> 加入生词本
            </>
          )}
        </button>
      </div>
    </>
  )
}

// ============================================================
// 短语态
// ============================================================

interface PhraseContentProps {
  result: Extract<TranslateResponse, { kind: 'phrase' }>
}

function PhraseContent({ result }: PhraseContentProps) {
  if (!result.found) {
    return (
      <div className="py-4 text-center">
        <p className="font-serif italic text-ink-muted text-sm mb-2">翻译失败</p>
        <p className="text-xs text-ink-muted/70">{result.text}</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-2 pb-2 border-b border-line-soft">
        <div className="text-[10px] font-mono text-ink-muted/60 uppercase mb-1">原文</div>
        <p className="font-serif text-sm text-ink leading-relaxed">{result.text}</p>
      </div>
      <div className="mb-3">
        <div className="text-[10px] font-mono text-ochre-dark uppercase mb-1">译文</div>
        <p className="text-sm text-ink-soft leading-relaxed">{result.translation}</p>
      </div>
      <div className="flex items-center justify-end pt-2 border-t border-line-soft">
        <span className="text-[10px] font-mono text-ink-muted/60">
          {result.source === 'cache' ? '缓存' : '在线翻译'}
        </span>
      </div>
    </>
  )
}

// ============================================================
// 长句态
// ============================================================

interface SentenceContentProps {
  result: Extract<TranslateResponse, { kind: 'sentence' }>
}

function SentenceContent({ result }: SentenceContentProps) {
  if (!result.found) {
    return (
      <div className="py-4 text-center">
        <p className="font-serif italic text-ink-muted text-sm mb-2">翻译失败</p>
        <p className="text-xs text-ink-muted/70 break-all">{result.text}</p>
      </div>
    )
  }

  return (
    <>
      {/* 译文 */}
      <div className="mb-3 pb-3 border-b border-line-soft">
        <div className="text-[10px] font-mono text-ochre-dark uppercase mb-1">译文</div>
        <p className="text-sm text-ink-soft leading-relaxed">{result.translation}</p>
      </div>

      {/* 原文 */}
      <div className="mb-3 pb-3 border-b border-line-soft">
        <div className="text-[10px] font-mono text-ink-muted/60 uppercase mb-1">原文</div>
        <p className="font-serif text-xs text-ink-muted leading-relaxed italic">{result.text}</p>
      </div>

      {/* 结构分析 */}
      {result.structure && result.structure.clauses.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1.5">
            <FileText className="w-3 h-3 text-ochre-dark" />
            <span className="text-[10px] font-mono text-ink-muted uppercase">结构分析</span>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs">
              <span className="text-[10px] text-ochre-dark font-mono mr-1">主句</span>
              <span className="text-ink-soft leading-relaxed">{result.structure.main}</span>
            </div>
            {result.structure.clauses.map((c, i) => (
              <div key={i} className="text-xs pl-2 border-l-2 border-seal/30">
                <span className="text-[10px] text-seal-dark font-mono mr-1">从句{i + 1}</span>
                <span className="text-ink-muted leading-relaxed italic">{c}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-ink-muted/50 mt-2 italic">
            * 仅作辅助提示，不保证语法准确
          </p>
        </div>
      )}

      <div className="flex items-center justify-end pt-2 border-t border-line-soft">
        <span className="text-[10px] font-mono text-ink-muted/60">
          {result.source === 'cache' ? '缓存' : '在线翻译'}
        </span>
      </div>
    </>
  )
}
