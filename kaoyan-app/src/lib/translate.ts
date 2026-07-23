// 翻译客户端：处理短语（2-4 词）和长句（5+ 词）
//
// 数据流：
//   选中文本 → classify(text) 判定 kind →
//     word:    lookup.ts（本地词典 + lemmatize + API 词典）
//     phrase:  /api/translate（短句，含网络释义）
//     sentence:/api/translate（带简单长难句结构分析）
//
// 翻译源（多源容错，任一成功即返回）：
//   前端直连（CORS）：
//     1. MyMemory  —— 免费免 Key，CORS *，日限 5000 词
//   后端代理 /api/translate（无 CORS 限制，服务端多源）：
//     2. apihz.cn  —— 自有 API Key，质量稳定（需配置 env）
//     3. uapis.cn  —— 免费免 Key，中英互译
//     4. Google gtx —— 免费免 Key，translate.googleapis.com
//
// 缓存：localStorage key `ky:trans:cache`，TTL 7 天，上限 500 条（LRU 淘汰）
// 并发去重：同 key 进行中的请求复用同一 Promise

import type {
  LookupResult,
  TranslateResponse,
  TranslateCacheStore,
  LookupKind,
} from '../types'
import { lookup, lookupCompound } from './lookup'
import { isCompoundWord } from './lemmatizer'

// ============================================================
// 缓存
// ============================================================

const CACHE_KEY = 'ky:trans:cache'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 天
const CACHE_MAX_ENTRIES = 500

let cacheStore: TranslateCacheStore | null = null

function loadCache(): TranslateCacheStore {
  if (cacheStore) return cacheStore
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    cacheStore = raw ? (JSON.parse(raw) as TranslateCacheStore) : {}
  } catch {
    cacheStore = {}
  }
  return cacheStore!
}

function persistCache() {
  if (!cacheStore) return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheStore))
  } catch {
    // 容量超限：清理最旧一半再试
    const entries = Object.entries(cacheStore).sort((a, b) => a[1].ts - b[1].ts)
    const half = Math.floor(entries.length / 2)
    cacheStore = Object.fromEntries(entries.slice(half))
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheStore))
    } catch {
      /* 放弃持久化 */
    }
  }
}

function cacheKey(text: string, kind: LookupKind): string {
  return `${kind}:${text.trim().toLowerCase()}`
}

function getCache(text: string, kind: LookupKind): TranslateResponse | null {
  const store = loadCache()
  const key = cacheKey(text, kind)
  const item = store[key]
  if (!item) return null
  if (Date.now() - item.ts > CACHE_TTL_MS) {
    delete store[key]
    return null
  }
  return item.data
}

function setCache(text: string, kind: LookupKind, data: TranslateResponse) {
  const store = loadCache()
  const key = cacheKey(text, kind)
  store[key] = { data, ts: Date.now() }

  // LRU 淘汰
  const entries = Object.entries(store)
  if (entries.length > CACHE_MAX_ENTRIES) {
    entries.sort((a, b) => a[1].ts - b[1].ts)
    const toRemove = entries.slice(0, entries.length - CACHE_MAX_ENTRIES)
    for (const [k] of toRemove) delete store[k]
  }
  persistCache()
}

// ============================================================
// 并发去重：进行中的请求复用
// ============================================================

const inflight = new Map<string, Promise<TranslateResponse>>()

// ============================================================
// 文本分类
// ============================================================

/** 单词：仅含字母、连字符、撇号 */
const WORD_RE = /^[a-zA-Z][a-zA-Z'-]*$/

/** 中文字符 */
const HAS_CHINESE_RE = /[\u4e00-\u9fa5]/

/**
 * 判定选中文本的查询类型
 * - word:    纯英文单词（可能含连字符的复合词也算）
 * - phrase:  2-4 个英文单词
 * - sentence: 5+ 词或包含中文
 */
export function classify(text: string): LookupKind {
  const t = text.trim()
  if (!t) return 'word'

  // 单词（含复合词）
  if (WORD_RE.test(t)) return 'word'

  // 中文 → 翻译成英文
  if (HAS_CHINESE_RE.test(t)) {
    return t.length <= 20 ? 'phrase' : 'sentence'
  }

  // 词数判定
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return 'word'
  if (words.length <= 4) return 'phrase'
  return 'sentence'
}

// ============================================================
// 翻译 API 调用
// ============================================================

interface TranslateApiResponse {
  code: number
  msg: string
  from: number
  to: number
  text: string
  translation: string
  source?: string
}

/** 检测文本是否主要为中文（中文 → 译成英文；否则 → 译成中文） */
function isChineseText(text: string): boolean {
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const en = (text.match(/[a-zA-Z]/g) || []).length
  return cn > en
}

/** 超时 fetch 封装 */
function fetchWithTimeout(url: string, init: RequestInit, ms = 10000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

/**
 * 主翻译源：自托管 /api/translate（Cloudflare Worker / Pages Functions）
 * 后端内部多源容错：apihz.cn → uapis.cn → Google gtx
 * 仅当后端可用时使用；失败则降级到前端直连源
 */
async function callSelfHostedApi(text: string): Promise<TranslateResult> {
  const resp = await fetchWithTimeout('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!resp.ok) throw new Error(`翻译服务异常 (${resp.status})`)
  const data = (await resp.json()) as TranslateApiResponse
  if (data.code !== 200) throw new Error(data.msg || '翻译失败')
  if (!data.translation) throw new Error('后端返回空译文')
  return { translation: data.translation, source: data.source || 'backend' }
}

/**
 * 前端直连源：MyMemory 免费 API（无需密钥，支持 CORS，日限约 5000 词）
 * 自动判定中→英 / 英→中
 */
async function callMyMemory(text: string): Promise<TranslateResult> {
  const toChinese = !isChineseText(text)
  const langpair = toChinese ? 'en|zh' : 'zh|en'
  // 截断超长文本（MyMemory 单次建议 < 500 字符）
  const q = text.length > 480 ? text.slice(0, 480) : text
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${langpair}`
  const resp = await fetchWithTimeout(url, { method: 'GET' })
  if (!resp.ok) throw new Error(`MyMemory 异常 (${resp.status})`)
  const data = (await resp.json()) as {
    responseStatus: number
    responseData?: { translatedText?: string }
    responseDetails?: string
  }
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error(data.responseDetails || 'MyMemory 翻译失败')
  }
  let translated = data.responseData.translatedText
  // MyMemory 偶尔返回 HTML 实体
  translated = translated
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  return { translation: translated, source: 'mymemory' }
}

/** 翻译结果（含来源标记） */
interface TranslateResult {
  translation: string
  source: string
}

/**
 * 统一翻译入口：多源容错
 * 顺序：后端 /api/translate（apihz→uapis→google） → MyMemory（前端直连）
 * 任一成功即返回；全部失败抛错
 */
async function callTranslateApi(text: string): Promise<TranslateResult> {
  const errors: string[] = []
  // 源 1：后端代理（服务端多源：apihz → uapis → Google gtx）
  try {
    return await callSelfHostedApi(text)
  } catch (e) {
    errors.push(`后端: ${e instanceof Error ? e.message : String(e)}`)
  }
  // 源 2：MyMemory 公共免费 API（前端直连，CORS OK）
  try {
    return await callMyMemory(text)
  } catch (e) {
    errors.push(`MyMemory: ${e instanceof Error ? e.message : String(e)}`)
  }
  throw new Error(`翻译失败（已尝试多源）：${errors.join('；')}`)
}

// ============================================================
// 长难句简单结构分析
// ============================================================

interface SentenceStructure {
  /** 主句 */
  main: string
  /** 从句列表 */
  clauses: string[]
}

/**
 * 简单长难句结构分析：识别主句和从句
 * 策略：以逗号、that/which/who/where/when/while/because 等引导词拆分
 * 仅作辅助提示，不保证语法准确
 */
function analyzeSentenceStructure(text: string): SentenceStructure {
  const cleaned = text.trim().replace(/\s+/g, ' ')
  // 按从句引导词拆分
  const CLAUSE_MARKERS = /\b(that|which|who|whom|whose|where|when|while|because|although|though|if|unless|since|as|until|before|after)\b/gi

  // 先按逗号粗分
  const commaParts = cleaned.split(/,\s*/).filter(Boolean)
  // 标记每个分句是否为从句（含引导词）
  const clauses: string[] = []
  const main: string[] = []
  for (const part of commaParts) {
    if (CLAUSE_MARKERS.test(part)) {
      clauses.push(part.trim())
    } else {
      main.push(part.trim())
    }
    // 重置正则 lastIndex
    CLAUSE_MARKERS.lastIndex = 0
  }

  return {
    main: main.join(', ') || cleaned,
    clauses,
  }
}

// ============================================================
// 主入口
// ============================================================

/**
 * 统一查询：根据文本自动判定类型
 * - word:    本地牛津 + lemmatize + API 词典
 * - phrase:  翻译 API（带缓存）
 * - sentence:翻译 API + 结构分析（带缓存）
 */
export async function translate(text: string): Promise<TranslateResponse> {
  const kind = classify(text)
  const key = cacheKey(text, kind)

  // 1. 缓存命中
  const cached = getCache(text, kind)
  if (cached) return cached

  // 2. 并发去重
  const existing = inflight.get(key)
  if (existing) return existing

  // 3. 发起新请求
  const promise = (async (): Promise<TranslateResponse> => {
    try {
      let result: TranslateResponse
      if (kind === 'word') {
        // 单词：优先复合词查询
        const r: LookupResult = isCompoundWord(text.trim().toLowerCase())
          ? await lookupCompound(text)
          : await lookup(text)
        result = { kind: 'word', data: r }
      } else if (kind === 'phrase') {
        const { translation, source } = await callTranslateApi(text)
        result = {
          kind: 'phrase',
          text,
          translation,
          found: !!translation,
          source,
        }
      } else {
        // sentence
        const { translation, source } = await callTranslateApi(text)
        const structure = analyzeSentenceStructure(text)
        result = {
          kind: 'sentence',
          text,
          translation,
          structure,
          found: !!translation,
          source,
        }
      }
      setCache(text, kind, result)
      return result
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}

// ============================================================
// 工具
// ============================================================

/** 清空翻译缓存 */
export function clearTranslateCache() {
  cacheStore = {}
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* 忽略 */
  }
}

/** 缓存统计 */
export function getCacheStats(): { count: number; sizeBytes: number } {
  const store = loadCache()
  const count = Object.keys(store).length
  let sizeBytes = 0
  try {
    sizeBytes = new Blob([JSON.stringify(store)]).size
  } catch {
    sizeBytes = JSON.stringify(store).length
  }
  return { count, sizeBytes }
}
