// 数据加载模块：动态 import JSON、缓存、索引查询
// 支持新 Schema（Paper + blocks）和旧 Schema（Exam + passages）自动转换

import type {
  Paper,
  Section,
  Article,
  Question,
  Block,
  ParagraphBlock,
  BlankBlock,
  ExamIndex,
  ExamIndexEntry,
  Passage,
  SectionType,
  Subject,
  OptionKey,
  StructuredAnalysis,
} from '../types'

// 静态导入索引（体积小，启动即加载）
import indexJson from '../data/exam-index.json'

const index = indexJson as ExamIndex

// =================================================================
// 旧 Schema 类型定义（仅供 migrateExamToPaper 内部使用）
// =================================================================

/** 旧版 Question：analysis 可能是 string 或已结构化对象 */
interface OldQuestion {
  id: number
  passageId?: string
  question: string
  options: Record<OptionKey, string>
  answer: OptionKey
  /** 旧：string；新：StructuredAnalysis 对象 */
  analysis: string | StructuredAnalysis
  /** 新 Schema 兼容字段 */
  analysisText?: string
}

interface OldSection {
  id: string
  type: SectionType
  title: string
  directions?: string
  passages?: Passage[]
  questions: OldQuestion[]
}

interface OldExam {
  year: number
  subject: Subject
  totalTime?: number
  sections: OldSection[]
}

/** 索引缓存 */
let indexCache: ExamIndex | null = null

/** 试卷缓存：避免重复加载同一份 JSON */
const paperCache = new Map<string, Paper>()

/** 获取全部索引 */
export function getExamIndex(): ExamIndex {
  if (!indexCache) indexCache = index
  return indexCache
}

/** 按科目筛选 */
export function getIndexBySubject(
  subject: '英语一' | '英语二' | '统一卷',
): ExamIndexEntry[] {
  return getExamIndex().exams.filter((e) => e.subject === subject)
}

/** 全部年份（去重降序） */
export function getAllYears(): number[] {
  const years = new Set(getExamIndex().exams.map((e) => e.year))
  return Array.from(years).sort((a, b) => b - a)
}

/** 按 key 查询单条索引 */
export function getIndexByKey(key: string): ExamIndexEntry | undefined {
  return getExamIndex().exams.find((e) => e.key === key)
}

/**
 * 判断 JSON 是否为新 Schema（有顶层 id 字段 + sections + articles 用 blocks）
 */
function isNewSchema(data: unknown): data is Paper {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'sections' in data
  )
}

/**
 * 判断 article 是否已使用新 blocks 结构
 */
function hasBlocks(article: unknown): article is { blocks: Block[] } {
  return (
    typeof article === 'object' &&
    article !== null &&
    'blocks' in article &&
    !('paragraphs' in article)
  )
}

/**
 * 将旧 paragraphs 结构转换为新 blocks 结构
 * - 普通段落：每个 paragraph → 一个 ParagraphBlock
 * - 完形段落：含 __N__ 标记的 paragraph → 多个 ParagraphBlock + BlankBlock
 */
function paragraphsToBlocks(paragraphs: string[], isCloze: boolean): Block[] {
  if (!paragraphs || paragraphs.length === 0) return []
  const blocks: Block[] = []
  for (const para of paragraphs) {
    if (isCloze) {
      // 完形：拆 __N__ 标记
      const parts = splitClozeParagraph(para)
      for (const p of parts) {
        if (p.type === 'blank') {
          blocks.push({ type: 'blank', blankId: p.blankId! } as BlankBlock)
        } else if (p.content) {
          blocks.push({ type: 'paragraph', content: p.content } as ParagraphBlock)
        }
      }
    } else {
      // 阅读：整段一个 block
      blocks.push({ type: 'paragraph', content: para } as ParagraphBlock)
    }
  }
  return blocks
}

interface ClozePart {
  type: 'text' | 'blank'
  content: string
  blankId?: number
}

const CLOZE_BLANK_RE = /__(\d+)__/g

function splitClozeParagraph(text: string): ClozePart[] {
  const parts: ClozePart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  CLOZE_BLANK_RE.lastIndex = 0
  while ((match = CLOZE_BLANK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'blank', content: '', blankId: parseInt(match[1], 10) })
    lastIndex = CLOZE_BLANK_RE.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }
  return parts.length > 0 ? parts : [{ type: 'text', content: text }]
}

/**
 * 规范化 article：若为旧 paragraphs 结构，转成 blocks
 */
function normalizeArticle(article: Article, isCloze: boolean): Article {
  if (hasBlocks(article)) return article
  // 旧结构：paragraphs → blocks
  const oldArticle = article as unknown as {
    id: string
    title?: string
    type: SectionType
    paragraphs: string[]
  }
  return {
    id: oldArticle.id,
    title: oldArticle.title,
    type: oldArticle.type,
    blocks: paragraphsToBlocks(oldArticle.paragraphs ?? [], isCloze),
  }
}

/**
 * 规范化 analysis：兼容 string 与 StructuredAnalysis 两种形态
 * - 旧数据 analysis 是 string → 包装为 { coreAnalysis: string }，analysisText 保留原串
 * - 新数据 analysis 已是对象 → 直接使用，analysisText 置空
 */
function normalizeAnalysis(raw: string | StructuredAnalysis | undefined): {
  analysis: StructuredAnalysis
  analysisText: string
} {
  const empty: StructuredAnalysis = {
    coreAnalysis: '',
    optionAnalysis: {},
    location: '',
    vocab: [],
  }
  if (!raw) return { analysis: empty, analysisText: '' }
  if (typeof raw === 'string') {
    return {
      analysis: { ...empty, coreAnalysis: raw },
      analysisText: raw,
    }
  }
  // 已是对象
  return {
    analysis: {
      coreAnalysis: raw.coreAnalysis ?? '',
      optionAnalysis: raw.optionAnalysis ?? {},
      location: raw.location ?? '',
      vocab: raw.vocab ?? [],
    },
    analysisText: '',
  }
}

/**
 * 旧 Schema（Exam）转新 Schema（Paper + blocks）
 */
function migrateExamToPaper(exam: OldExam, key: string): Paper {
  const sections: Section[] = exam.sections.map((sec) => {
    const articles: Article[] = (sec.passages ?? []).map((p: Passage) =>
      normalizeArticle(
        {
          id: p.id,
          title: p.title,
          type: sec.type,
          blocks: [], // 临时占位，normalizeArticle 会用 paragraphs 填充
          paragraphs: splitToParagraphs(p.content),
        } as unknown as Article,
        sec.type === 'cloze',
      ),
    )
    const questions: Question[] = sec.questions.map((q: OldQuestion) => {
      const { analysis, analysisText } = normalizeAnalysis(q.analysis)
      return {
        id: q.id,
        articleId: q.passageId ?? '',
        type: sec.type,
        question: q.question,
        options: q.options,
        answer: q.answer,
        analysis,
        analysisText,
        position: 0,
      }
    })
    return {
      id: sec.id,
      type: sec.type,
      title: sec.title,
      directions: sec.directions,
      articles,
      questions,
    }
  })

  return {
    id: key,
    year: exam.year,
    subject: exam.subject,
    title: `${exam.year}年${exam.subject}`,
    sections,
  }
}

/**
 * 规范化 Paper：把所有 article 统一成 blocks 结构
 * 同时规范化每题 analysis（兼容 string / StructuredAnalysis）
 */
function normalizePaper(data: unknown, key: string): Paper {
  if (!isNewSchema(data)) {
    return migrateExamToPaper(data as OldExam, key)
  }
  // 新 Schema：检查每个 article 是否已用 blocks
  const paper = data as Paper
  paper.sections = paper.sections.map((sec) => ({
    ...sec,
    articles: sec.articles.map((art) =>
      normalizeArticle(art, sec.type === 'cloze'),
    ),
    // 新 Schema 的 questions 可能有旧的 string analysis，也需规范化
    questions: sec.questions.map((q) => {
      // 若 analysis 已是对象，保留；若是 string，走 normalizeAnalysis
      const rawAnalysis = q.analysis as unknown as string | StructuredAnalysis
      if (typeof rawAnalysis === 'string') {
        const { analysis, analysisText } = normalizeAnalysis(rawAnalysis)
        return { ...q, analysis, analysisText: q.analysisText ?? analysisText }
      }
      // 已是对象，补齐 analysisText 字段（旧 JSON 可能缺这个字段）
      return {
        ...q,
        analysis: rawAnalysis ?? {
          coreAnalysis: '',
          optionAnalysis: {},
          location: '',
          vocab: [],
        },
        analysisText: q.analysisText ?? '',
      }
    }),
  }))
  return paper
}

/** 将纯文本按空行拆成段落；若无空行则按句号拆 */
function splitToParagraphs(content: string): string[] {
  const trimmed = content.trim()
  if (!trimmed) return []
  // 优先按双换行拆段
  const byBlank = trimmed.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
  if (byBlank.length > 1) return byBlank
  // 退化：按单换行拆
  const byNewline = trimmed.split(/\n/).map((s) => s.trim()).filter(Boolean)
  return byNewline.length > 0 ? byNewline : [trimmed]
}

/**
 * 动态加载某份试卷的完整 JSON（自动适配新旧 Schema）
 * 利用 Vite 的 glob import 把所有 exams/*.json 注册为懒加载模块
 */
const examModules = import.meta.glob<{ default: Paper | OldExam }>(
  '../data/exams/*.json',
)

export async function loadPaper(key: string): Promise<Paper | null> {
  if (paperCache.has(key)) return paperCache.get(key)!

  const path = `../data/exams/${key}.json`
  const loader = examModules[path]
  if (!loader) {
    console.warn(`[dataLoader] 未找到试卷：${key}`)
    return null
  }
  try {
    const mod = await loader()
    const data = mod.default ?? (mod as unknown as Paper | OldExam)
    // 规范化：新旧 Schema 统一转成 blocks 结构
    const paper = normalizePaper(data, key)
    paperCache.set(key, paper)
    return paper
  } catch (err) {
    console.warn(`[dataLoader] 加载 ${key} 失败：`, err)
    return null
  }
}

/** 兼容旧 API：loadExam = loadPaper */
export const loadExam = loadPaper

/** 加载索引中所有试卷（用于全局训练/统计） */
export async function loadAllPapers(): Promise<Paper[]> {
  const entries = getExamIndex().exams
  const results = await Promise.all(entries.map((e) => loadPaper(e.key)))
  return results.filter((x): x is Paper => x !== null)
}

/** 兼容旧 API */
export const loadAllExams = loadAllPapers

/**
 * 获取某份试卷下的某个 section
 */
export async function loadSection(
  paperId: string,
  sectionType: string,
): Promise<{ paper: Paper; section: Section } | null> {
  const paper = await loadPaper(paperId)
  if (!paper) return null
  const section = paper.sections.find((s) => s.type === sectionType)
  if (!section) return null
  return { paper, section }
}

/**
 * 获取某份试卷的所有文章（平铺）
 */
export function getAllArticles(paper: Paper): Article[] {
  return paper.sections.flatMap((s) => s.articles)
}

/**
 * 获取某篇文章的所有题目
 */
export function getQuestionsByArticle(
  paper: Paper,
  articleId: string,
): Question[] {
  return paper.sections
    .flatMap((s) => s.questions)
    .filter((q) => q.articleId === articleId)
}
