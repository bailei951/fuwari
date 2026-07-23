// 批注高亮的 DOM 操作：基于字符偏移的高亮渲染
// 偏移相对「文章正文容器」的 textContent 计算（create / restore 共用同一容器）

import type { Annotation } from '../types'

const MARK_SELECTOR = 'mark.annot-mark'

/**
 * 计算选区 Range 相对容器的字符偏移
 * 返回 null 表示选区不在容器内或无效（含边界节点已被卸载的情况）
 *
 * 实现要点：
 * - 用两个独立的 Range 测量 start / end，避免共享 preRange 状态导致 setEnd 行为异常
 * - 测量前先用 compareDocumentPosition 校验边界仍在容器内
 *   （ReactMarkdown 重渲染可能替换 DOM 节点，使捕获的 Range 引用失效）
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
 * 测量从 container 起点到 (node, offset) 之间的字符数（仅文本节点累计）
 * 同时支持 Text / Element 类型的边界节点
 */
function measureTextLength(container: HTMLElement, node: Node, offset: number): number {
  const r = document.createRange()
  r.setStart(container, 0)
  r.setEnd(node, offset)
  return r.toString().length
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

  // 收集容器内全部文本节点 + 累计字符偏移
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT
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
