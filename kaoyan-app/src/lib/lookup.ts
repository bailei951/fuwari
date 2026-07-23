// 词典查询：本地牛津词典（带词形还原）→ API 词典兜底
//
// 数据结构：
// - dictionary_index.json：单词 → 首字母的映射（静态导入，用于快速判断）
// - dict/words-{letter}.json：该字母下所有词条（动态 import 按需加载）
//
// 查询流程：
// 1. normalize(word) 得到小写无标点形式
// 2. lemmatize(word) 生成原形候选列表（studies → study）
// 3. 按候选顺序查本地牛津词典（命中即返回）
// 4. 本地未命中 → 调用 /api/dictionary 代理（ruseo.cn，支持复合词）
// 5. API 失败 → 返回 found: false

import type { DictIndex, DictShard, OaldEntry, LookupResult } from '../types'
import { lemmatize, isCompoundWord, splitCompound } from './lemmatizer'

// 静态导入索引（约 639KB，gzip 后更小，可接受）
import indexJson from '../data/dictionary_index.json'

const dictIndex = indexJson as DictIndex

/** 已加载的字母分片缓存：letter → OaldEntry[] */
const shardCache: Map<string, OaldEntry[]> = new Map()
/** 正在加载的字母分片 Promise（防止并发重复加载） */
const loadingPromises: Map<string, Promise<OaldEntry[]>> = new Map()

/** 标准化单词：小写、去标点（保留连字符） */
function normalize(word: string): string {
  return word.trim().toLowerCase().replace(/[^a-z'-]/g, '')
}

/** 根据首字母动态加载分片，带缓存 */
async function loadShard(letter: string): Promise<OaldEntry[]> {
  // 已缓存
  const cached = shardCache.get(letter)
  if (cached) return cached

  // 正在加载
  const loading = loadingPromises.get(letter)
  if (loading) return loading

  // 发起新加载
  const promise = (async () => {
    try {
      // Vite 支持动态 import JSON
      const mod = await import(`../data/dict/words-${letter}.json`)
      const shard = mod.default as DictShard
      const words = shard.words || []
      shardCache.set(letter, words)
      return words
    } catch (e) {
      // 某些字母（j/k/q/x/y/z）可能没有数据文件或为空
      shardCache.set(letter, [])
      return []
    } finally {
      loadingPromises.delete(letter)
    }
  })()

  loadingPromises.set(letter, promise)
  return promise
}

/** 在已加载的词条数组中查找单词（大小写不敏感） */
function findInShard(words: OaldEntry[], target: string): OaldEntry | null {
  const lower = target.toLowerCase()
  // 优先精确匹配（小写比较）
  for (const entry of words) {
    if (entry.word.toLowerCase() === lower) {
      return entry
    }
  }
  // 次优：以目标词开头的词条（处理复数/时态变形）
  for (const entry of words) {
    if (entry.word.toLowerCase().startsWith(lower)) {
      return entry
    }
  }
  return null
}

/**
 * 本地词典查询单个候选词
 * 返回 LookupResult，found=false 表示未命中
 */
async function lookupLocalCandidate(
  candidate: string,
  original: string,
  lemma: string,
): Promise<LookupResult> {
  const letter = dictIndex.words[candidate]
  let shard: OaldEntry[] = []

  if (letter) {
    shard = await loadShard(letter)
  } else if (candidate[0]) {
    // 索引未命中，尝试直接用首字母（可能 index 未收录但 data 有）
    shard = await loadShard(candidate[0])
  }

  const entry = findInShard(shard, candidate)
  if (entry) {
    return {
      word: entry.word,
      original,
      lemma,
      phonetic: entry.phonetic || '',
      pos: entry.pos || '',
      meanings: entry.meanings || [],
      examples: entry.examples || [],
      found: true,
      source: 'local',
    }
  }

  return {
    word: candidate,
    original,
    lemma,
    phonetic: '',
    pos: '',
    meanings: [],
    examples: [],
    found: false,
    source: 'local',
  }
}

// ============================================================
// API 词典代理（ruseo.cn）
// ============================================================

interface ApiDictResponse {
  code: number
  msg: string
  data: unknown
}

interface ApiDictEntry {
  success?: boolean
  word?: string
  phonetic?: unknown
  definitions?: unknown
  network_meanings?: unknown
  examples?: unknown
}

/** 把上游 API 词典结构转为 LookupResult */
function parseApiDictEntry(raw: ApiDictEntry, original: string, lemma: string): LookupResult {
  const phonetic = extractPhonetic(raw.phonetic)
  const meanings = extractMeanings(raw.definitions)
  const examples = extractExamples(raw.examples)

  return {
    word: raw.word ?? original,
    original,
    lemma,
    phonetic,
    pos: '',
    meanings,
    examples,
    found: true,
    source: 'api',
  }
}

/** phonetic 字段可能是字符串或对象 { uk, us } */
function extractPhonetic(p: unknown): string {
  if (!p) return ''
  if (typeof p === 'string') return p
  if (typeof p === 'object' && p !== null) {
    const obj = p as Record<string, string>
    return obj.uk || obj.us || obj.value || ''
  }
  return ''
}

/** definitions 字段可能是字符串、数组、或对象 */
function extractMeanings(d: unknown): string[] {
  if (!d) return []
  if (typeof d === 'string') return [d]
  if (Array.isArray(d)) {
    return d
      .map((item) => {
        if (typeof item === 'string') return item
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>
          return String(obj.meaning || obj.text || obj.def || '')
        }
        return ''
      })
      .filter(Boolean)
  }
  if (typeof d === 'object') {
    const obj = d as Record<string, unknown>
    // 常见结构：{ n: [...], v: [...] }
    const out: string[] = []
    for (const [pos, vals] of Object.entries(obj)) {
      if (Array.isArray(vals)) {
        for (const v of vals) out.push(`${pos}. ${v}`)
      } else if (typeof vals === 'string') {
        out.push(`${pos}. ${vals}`)
      }
    }
    return out
  }
  return []
}

/** examples 字段可能是字符串或数组 */
function extractExamples(e: unknown): string[] {
  if (!e) return []
  if (typeof e === 'string') return [e]
  if (Array.isArray(e)) {
    return e.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
  }
  return []
}

/** 调用 /api/dictionary 代理（同源路径，由 Cloudflare Worker / vite proxy 转发） */
async function lookupApi(word: string, original: string, lemma: string): Promise<LookupResult | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    let resp: Response
    try {
      resp = await fetch(`/api/dictionary?word=${encodeURIComponent(word)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: ctrl.signal,
      })
    } finally {
      clearTimeout(t)
    }
    if (!resp.ok) return null
    const json = (await resp.json()) as ApiDictResponse
    if (json.code !== 200 || !json.data) return null
    const entry = json.data as ApiDictEntry
    if (!entry.success && entry.word === undefined) return null
    return parseApiDictEntry(entry, original, lemma)
  } catch {
    return null
  }
}

/**
 * 统一查词接口（仅单词场景）
 * 流程：lemmatize → 依次查本地词典 → 命中即返回
 * 本地全未命中 → 调用 API 词典兜底（用候选列表第一个）
 */
export async function lookup(word: string): Promise<LookupResult> {
  const normalized = normalize(word)
  if (!normalized) {
    return { word, phonetic: '', pos: '', meanings: [], examples: [], found: false, source: 'local' }
  }

  // 1. 生成候选列表（原词 + 词形还原候选）
  const candidates = lemmatize(normalized)
  const original = normalized

  // 2. 按候选顺序查本地词典
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    const result = await lookupLocalCandidate(candidate, original, candidate)
    if (result.found) {
      // 命中：保留原词作 original，词根作 lemma（与候选一致时省略）
      if (i === 0) {
        // 原词直接命中
        return { ...result, original: undefined, lemma: undefined }
      }
      return result
    }
  }

  // 3. 本地全未命中 → API 词典兜底（用第一个候选：通常是原词）
  const apiResult = await lookupApi(candidates[0], original, candidates[0])
  if (apiResult) return apiResult

  // 4. 全部失败
  return {
    word: normalized,
    original,
    phonetic: '',
    pos: '',
    meanings: [],
    examples: [],
    found: false,
    source: 'local',
  }
}

/**
 * 复合词查询：long-term → 同时查 long 和 term，合并结果
 */
export async function lookupCompound(word: string): Promise<LookupResult> {
  const normalized = normalize(word)
  if (!isCompoundWord(normalized)) {
    // 不是复合词，走普通查询
    return lookup(word)
  }

  const parts = splitCompound(normalized)
  const subResults = await Promise.all(parts.map((p) => lookup(p)))
  const foundAny = subResults.some((r) => r.found)
  const allMeanings = subResults.flatMap((r) => r.meanings)
  const allExamples = subResults.flatMap((r) => r.examples)

  // 先尝试 API 词典查整个复合词
  if (!foundAny) {
    const apiResult = await lookupApi(normalized, normalized, normalized)
    if (apiResult) return apiResult
  }

  return {
    word: normalized,
    original: normalized,
    phonetic: subResults.find((r) => r.phonetic)?.phonetic ?? '',
    pos: subResults.find((r) => r.pos)?.pos ?? '',
    meanings: allMeanings,
    examples: allExamples,
    found: foundAny,
    source: foundAny ? 'local' : 'local',
  }
}

/** 是否本地词典有该词（同步接口，仅查索引） */
export function hasLocal(word: string): boolean {
  const normalized = normalize(word)
  if (!normalized) return false
  // 检查原词及所有候选
  const candidates = lemmatize(normalized)
  return candidates.some((c) => !!dictIndex.words[c])
}
