// 英文句子切分与段落聚合工具
// 用途：
//   1. dataLoader：把整篇压平的阅读/新题型文章按语义重新分段
//   2. ArticleView 句译模式：把段落切分为可点击的句子
//
// 句子切分策略：在 [.?!]+[引号/括号] + 空白 处断句，跳过常见缩写（Mr. / e.g. / U.S. 等）

/** 已知缩写词（最后一个词匹配则句点视为缩写点，不断句） */
const ABBREV_WORD_RE =
  /^(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|Fig|No|Vol|Co|Corp|Inc|Ltd|Dept|Univ|Approx|a\.m|p\.m|Ph\.D)$/i

/** 点分首字母缩略词：U.S / D.C / U.K / J.C 等 */
const INITIALISM_RE = /^(?:[A-Z]\.)+[A-Z]$/

/**
 * 判断候选句末的句点是否属于缩写（如 Mr. / U.S. / J.）
 * 剥离句末标点与引号后取最后一个词判定
 */
function endsWithAbbrev(candidate: string): boolean {
  const bare = candidate.replace(/[.?!]+["')\]]*$/, '').trim()
  if (!bare) return false
  // 剥离词首非字母字符（如 "(e.g." → "e.g"）
  const lastToken = (bare.split(/\s+/).pop() ?? '').replace(/^[^A-Za-z]+/, '')
  if (ABBREV_WORD_RE.test(lastToken)) return true
  if (INITIALISM_RE.test(lastToken)) return true
  // 人名首字母缩写：Kennedy J.
  if (/^[A-Z]$/.test(lastToken)) return true
  return false
}

/** 句末标点 + 可选引号/括号 + 空白 */
const SENTENCE_BOUNDARY_RE = /([.?!]+["')\]]?)\s+/g

/**
 * 把英文文本切分为句子数组。
 * 转折处理：缩写句点（如 Mr. / U.S.）不断句；小数（3.14）与省略号中间不断句。
 */
export function splitSentences(text: string): string[] {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return []

  const sentences: string[] = []
  let start = 0
  SENTENCE_BOUNDARY_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = SENTENCE_BOUNDARY_RE.exec(t)) !== null) {
    const end = m.index + m[1].length
    const candidate = t.slice(start, end)
    // 句点是缩写点 → 不断句，继续累积
    if (!endsWithAbbrev(candidate)) {
      sentences.push(candidate.trim())
      start = SENTENCE_BOUNDARY_RE.lastIndex
    }
  }
  if (start < t.length) {
    const tail = t.slice(start).trim()
    if (tail) sentences.push(tail)
  }
  return sentences.filter(Boolean)
}

/**
 * 把句子序列聚合成段落：
 * - 目标每段约 400 字符（≈ 65-70 词，贴近考研阅读真题段落长度）
 * - 段数限制在 2-8 之间，句子过少时退化为单段
 * - 按累计字符量均匀分布，保证段落长度大体一致
 */
export function groupSentencesToParagraphs(sentences: string[]): string[] {
  if (sentences.length === 0) return []
  if (sentences.length === 1) return sentences

  const total = sentences.reduce((s, x) => s + x.length, 0)
  const target = 400
  const nParas = Math.max(2, Math.min(8, Math.round(total / target)))
  if (sentences.length <= nParas) return sentences

  const avg = total / nParas
  const paras: string[] = []
  let cur: string[] = []
  let curLen = 0
  for (const s of sentences) {
    cur.push(s)
    curLen += s.length
    // 达到平均长度且还需容纳后续段落时收段
    if (curLen >= avg && paras.length < nParas - 1) {
      paras.push(cur.join(' '))
      cur = []
      curLen = 0
    }
  }
  if (cur.length > 0) paras.push(cur.join(' '))
  return paras
}

/** 判断一段文本是否过长、值得重新分段（字符阈值） */
export function isLongFlattenedText(text: string, threshold = 500): boolean {
  return text.trim().length > threshold
}

/**
 * 整段长文本 → 语义段落列表（切句 + 聚合）
 */
export function splitLongTextToParagraphs(text: string): string[] {
  return groupSentencesToParagraphs(splitSentences(text))
}

/** 圆圈数字 ①-⑳（超出退化为普通数字） */
export function circledNumber(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + n - 1)
  return String(n)
}
