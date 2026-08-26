// 批注高亮的 DOM 操作：基于字符偏移的高亮渲染
// 偏移相对「文章正文容器」的 textContent 计算（create / restore 共用同一容器）
//
// 句译模式兼容：句译文以 span.sent-trans 渲染在正文容器内，
// 偏移测量与高亮渲染均过滤 .sent-trans 内的文本节点，
// 保证「显示/隐藏译文」前后字符偏移一致，批注不错位。

import type { Annotation } from '../types'

const MARK_SELECTOR = 'mark.annot-mark'
const TRANS_SELECTOR = '.sent-trans'

/** 该文本节点是否属于句译文（不参与偏移计算） */
function isTransNode(node: Node): boolean {
  const el = node.parentElement
  return !!el && !!el.closest(TRANS_SELECTOR)
}

/**
 * 计算选区 Range 相对容器的字符偏移
 * 返回 null 表示选区不在容器内或无效（含边界节点已被卸载的情况）
 *
 * 实现要点：
 * - 用过滤后的 TreeWalker 累计文本节点长度（跳过句译文），保证译文显隐不影响偏移
 * - 测量前先校验边界仍在容器内
 *   （React 重渲染可能替换 DOM 节点，使捕获的 Range 引用失效）
 */
export function computeRangeOffsets(
  container: HTMLElement,
  range: Range,
): { start: number; end: number } | null {
  try {
    if (!container.contains(range.commonAncestorContainer)) return null
    // 兜底：边界节点必须仍在 container 内
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      return null
    }

    const start = measureTextLength(container, range.startContainer, range.startOffset)
    const end = measureTextLength(container, range.endContainer, range.endOffset)
    if (start < 0 || end < 0 || end <= start) return null
    return { start, end }
  } catch {
    return null
  }
}

/**
 * 测量从 container 起点到 (node, offset) 之间的字符数
 * （跳过句译文 .sent-trans 内的文本，保证译文显隐不影响偏移）
 * 实现：Range 原始长度 − 边界之前译文文本长度
 */
function measureTextLength(container: HTMLElement, node: Node, offset: number): number {
  const r = document.createRange()
  r.setStart(container, 0)
  try {
    r.setEnd(node, offset)
  } catch {
    return -1
  }
  const raw = r.toString().length
  if (raw === 0) return 0

  // 累计边界之前的译文文本长度并扣除
  let transLen = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (isTransNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  })
  let n: Node | null
  while ((n = walker.nextNode())) {
    // comparePoint: -1 在边界前，0 恰在边界，1 在边界后
    let cmp: number
    try {
      cmp = r.comparePoint(n, 0)
    } catch {
      break
    }
    if (cmp > 0) break
    transLen += n.nodeValue?.length ?? 0
  }
  return raw - transLen
}

/** 移除容器内所有批注高亮 mark，恢复纯文本 */
function unwrapMarks(container: HTMLElement) {
  const marks = Array.from(container.querySelectorAll(MARK_SELECTOR))
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
  }
  container.normalize()
}

/**
 * 应用批注高亮：先清理旧 mark，再按 startOffset 升序、跳过重叠地重新包裹
 * 幂等，可重复调用
 */
export function applyHighlights(container: HTMLElement, annotations: Annotation[]) {
  unwrapMarks(container)
  if (annotations.length === 0) return

  // 排序 + 去重叠
  const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset)
  const valid: Annotation[] = []
  let lastEnd = -1
  for (const ann of sorted) {
    if (
      ann.startOffset >= 0 &&
      ann.endOffset > ann.startOffset &&
      ann.startOffset >= lastEnd
    ) {
      valid.push(ann)
      lastEnd = ann.endOffset
    }
  }

  // 收集容器内全部文本节点 + 累计字符偏移（跳过句译文，与偏移测量口径一致）
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT
      if (isTransNode(node)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const textNodes: { node: Text; start: number; end: number }[] = []
  let offset = 0
  let n: Node | null
  while ((n = walker.nextNode())) {
    const text = n as Text
    const len = text.nodeValue?.length ?? 0
    textNodes.push({ node: text, start: offset, end: offset + len })
    offset += len
  }
  const totalLength = offset

  // 从后往前应用，避免影响前面文本节点引用
  for (let i = valid.length - 1; i >= 0; i--) {
    const ann = valid[i]
    if (ann.endOffset > totalLength) continue
    const startNodeInfo = textNodes.find(
      (tn) => tn.start <= ann.startOffset && tn.end > ann.startOffset,
    )
    const endNodeInfo = textNodes.find(
      (tn) => tn.start <= ann.endOffset && tn.end >= ann.endOffset,
    )
    if (!startNodeInfo || !endNodeInfo) continue

    try {
      const range = document.createRange()
      range.setStart(startNodeInfo.node, ann.startOffset - startNodeInfo.start)
      range.setEnd(endNodeInfo.node, ann.endOffset - endNodeInfo.start)
      const mark = document.createElement('mark')
      mark.className = `annot-mark annot-${ann.color}`
      mark.dataset.annotId = ann.id
      if (ann.note) mark.title = ann.note
      mark.appendChild(range.extractContents())
      range.insertNode(mark)
    } catch {
      // 单条失败不影响其他
    }
  }
}

/** 滚动到指定批注高亮元素并闪烁高亮 */
export function jumpToAnnotation(container: HTMLElement, id: string) {
  const mark = container.querySelector(`mark.annot-mark[data-annot-id="${id}"]`)
  if (!mark) return
  mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
  mark.classList.add('annot-flash')
  setTimeout(() => mark.classList.remove('annot-flash'), 1200)
}
