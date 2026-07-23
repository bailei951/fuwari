// =================================================================
// 考研英语真题库 · 类型定义
// 新 Schema：Paper → sections[] → articles[] + questions[]
// 兼容旧 Schema（Exam / Passage）作为 fallback
// =================================================================

/** 英语一 / 英语二 / 统一卷（旧版） */
export type Subject = '英语一' | '英语二' | '统一卷'

/** 题型 */
export type SectionType = 'cloze' | 'reading' | 'newType' | 'translation' | 'writing'

/** 选项字母：完形/阅读为 A-D，新题型（段落排序/匹配）可扩展至 A-H */
export type OptionKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'

/**
 * 题目状态：
 * - unanswered: 未提交
 * - correct / wrong: 客观题判定
 * - submitted: 已提交但无标准答案（新题型缺答案 key）/ 主观题已提交查看参考
 */
export type QuestionStatus = 'unanswered' | 'correct' | 'wrong' | 'submitted'

/** 高亮颜色 */
export type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue'

// =================================================================
// 试卷数据结构（新 Schema：data/exams/*.json）
// Paper → sections[] → articles[] + questions[]
// =================================================================

/**
 * 文章：统一 block 结构，阅读和完形共用同一渲染逻辑
 * - reading：blocks 全为 paragraph 类型，每段一个
 * - cloze：paragraph 与 blank 混合，blankId 对应题号
 */
export interface ParagraphBlock {
  type: 'paragraph'
  content: string
}

export interface BlankBlock {
  type: 'blank'
  blankId: number
}

export type Block = ParagraphBlock | BlankBlock

export interface Article {
  id: string
  title?: string
  type: SectionType
  /** 统一 block 数组：paragraph / blank 混合渲染 */
  blocks: Block[]
}

/** 结构化解析：错误选项分析（A-D 常用；新题型 A-H 按需） */
export interface OptionAnalysis {
  A?: string
  B?: string
  C?: string
  D?: string
  E?: string
  F?: string
  G?: string
  H?: string
}

/** 结构化解析：分章节展示 */
export interface StructuredAnalysis {
  /** 核心解析：正确答案原因 */
  coreAnalysis: string
  /** 各选项分析 */
  optionAnalysis: Partial<OptionAnalysis>
  /** 原文定位（段落/行号描述，点击可跳转左栏） */
  location: string
  /** 相关词汇解释 */
  vocab: string[]
}

/**
 * 主观题（翻译 / 写作）参考答案与评分标准
 * 存在该字段即为主观题：作答区为文本框，无客观对错，提供参考译文/范文与评分维度
 */
export interface SubjectiveAnswer {
  /** 参考译文 / 范文（可为空，标注"待补充"） */
  reference: string
  /** 评分标准 / 维度（按条目展示） */
  scoringCriteria?: string[]
  /** 满分分值 */
  maxScore?: number
  /** 字数要求提示 */
  wordLimit?: string
}

/**
 * 题目：关联到具体文章 + 段落位置
 * analysis 支持两种形态：
 * - 旧数据：string（dataLoader 自动包装为 { coreAnalysis: string }）
 * - 新数据：StructuredAnalysis 对象
 * 用 analysisText 字段保留旧字符串以兼容
 *
 * 题型分支：
 * - 客观题（cloze/reading/newType）：options + answer；newType 选项可至 A-G，answer 可为 ''（无标准答案）
 * - 主观题（translation/writing）：subjective 字段存在，作答为文本
 */
export interface Question {
  id: number
  /** 关联的文章 id */
  articleId: string
  type: SectionType
  /** 题干；完形题干为空（空格在文章中）；翻译题为待译原文句子 */
  question: string
  /** 选项（客观题）；Partial 以兼容 A-D 与 A-G */
  options: Partial<Record<OptionKey, string>>
  /** 正确选项；'' 表示无标准答案（新题型数据缺失时） */
  answer: OptionKey | ''
  /** 结构化解析（新） */
  analysis: StructuredAnalysis
  /** 旧字符串解析（兼容字段；新数据为空字符串） */
  analysisText: string
  /** 段落索引：点击题号 → 左栏滚动到 article.paragraphs[position] */
  position: number
  /** 主观题参考答案与评分标准（翻译/写作） */
  subjective?: SubjectiveAnswer
}

/**
 * 试卷分区：一个题型一个 section
 * 每个 section 包含若干文章 + 若干题目
 */
export interface Section {
  id: string
  type: SectionType
  title: string
  directions?: string
  articles: Article[]
  questions: Question[]
}

/**
 * 试卷：顶层结构
 */
export interface Paper {
  /** 与 JSON 文件名对应，如 "2025-english1" */
  id: string
  year: number
  subject: Subject
  title: string
  sections: Section[]
}

// =================================================================
// 旧 Schema 兼容（dataLoader 自动转换）
// =================================================================

/** @deprecated 旧 Schema，仅为兼容保留 */
export interface Passage {
  id: string
  title?: string
  content: string
}

/** @deprecated 旧 Schema，仅为兼容保留 */
export interface Exam {
  year: number
  subject: Subject
  totalTime?: number
  sections: Section[]
}

// =================================================================
// 索引文件（data/exam-index.json）
// =================================================================

export interface ExamIndexEntry {
  /** 与 JSON 文件名对应，如 "2025-english1" */
  key: string
  year: number
  subject: Subject
  sections: SectionType[]
  questionCount: number
}

export interface ExamIndex {
  exams: ExamIndexEntry[]
}

// =================================================================
// 牛津词典（按字母分片，按需加载）
// data/dictionary_index.json: {words: {word: letter}} 快速定位
// data/dict/words-{letter}.json: {letter, count, words: OaldEntry[]}
// =================================================================

/** 旧词典条目（兼容 dictionary.json） */
export interface DictionaryDefinition {
  pos: string
  meaning: string
}

export interface DictionaryEntry {
  phonetic: string
  definitions: DictionaryDefinition[]
}

export interface Dictionary {
  version: string
  words: Record<string, DictionaryEntry>
}

/** 牛津高阶词典条目 */
export interface OaldEntry {
  word: string
  phonetic: string
  /** 词性：n / v / adj / adv / prep 等 */
  pos: string
  /** 中文释义数组 */
  meanings: string[]
  /** 英文例句数组 */
  examples: string[]
}

/** 字母分片文件结构 */
export interface DictShard {
  letter: string
  count: number
  words: OaldEntry[]
}

/** 词典索引（快速判断单词是否存在 + 定位字母分片） */
export interface DictIndex {
  version: string
  source: string
  total: number
  /** word → 首字母（用于动态加载对应分片） */
  words: Record<string, string>
}

// =================================================================
// localStorage 数据结构（保持不变，仅 articleId 格式调整）
// =================================================================

export interface QuestionProgress {
  selected: OptionKey | null
  status: QuestionStatus
  /** 是否被标记（用于错题回顾/收藏，与对错独立） */
  marked: boolean
  submittedAt: string | null
  /** 主观题（翻译/写作）作答文本 */
  textAnswer?: string
  /** 主观题自评分数 */
  selfScore?: number
}

/** key: paperId, value: { questionId -> progress } */
export type ProgressStore = Record<string, Record<number, QuestionProgress>>

export interface VocabItem {
  id: string
  word: string
  phonetic: string
  meaning: string
  source: {
    paperId: string
    articleId?: string
    questionId?: number
  }
  addedAt: string // ISO
}

export interface VocabStore {
  words: VocabItem[]
}

export interface Annotation {
  id: string
  /** 格式：${paperId}:${articleId} */
  articleId: string
  /** 选中的原文 */
  text: string
  /** 选中起始字符偏移（用于还原高亮） */
  startOffset: number
  endOffset: number
  /** 用户批注 */
  note: string
  color: HighlightColor
  createdAt: string // ISO
}

export type AnnotationStore = Record<string, Annotation[]>

export interface RecentItem {
  paperId: string
  visitedAt: string
}

export interface RecentStore {
  items: RecentItem[]
}

// =================================================================
// 查词返回结构
// =================================================================

export interface LookupResult {
  word: string
  /** 原词（如用户选了 studies，original 为 studies，word 为 study） */
  original?: string
  /** 还原后的词根 */
  lemma?: string
  phonetic: string
  /** 词性 */
  pos: string
  /** 中文释义数组 */
  meanings: string[]
  /** 英文例句数组 */
  examples: string[]
  found: boolean
  source: 'local' | 'api'
}

// =================================================================
// 翻译系统：单词 / 短语 / 长句 三态
// =================================================================

/** 查询类型：根据选中文本词数自动判定 */
export type LookupKind = 'word' | 'phrase' | 'sentence'

/** 短语翻译结果（API 词典 + 翻译兜底） */
export interface PhraseResult {
  kind: 'phrase'
  text: string
  translation: string
  found: boolean
  /** 翻译来源：apihz / uapis / google / mymemory / backend / cache */
  source: string
}

/** 长句翻译结果 */
export interface SentenceResult {
  kind: 'sentence'
  text: string
  translation: string
  /** 简单长难句结构分析（主谓宾拆分） */
  structure?: {
    main: string
    clauses: string[]
  }
  found: boolean
  /** 翻译来源：apihz / uapis / google / mymemory / backend / cache */
  source: string
}

/** 统一查询响应：三种形态联合类型 */
export type TranslateResponse =
  | { kind: 'word'; data: LookupResult }
  | PhraseResult
  | SentenceResult

/** localStorage 翻译缓存项 */
export interface TranslateCacheItem {
  /** 结果 JSON */
  data: TranslateResponse
  /** 创建时间戳 */
  ts: number
}

/** localStorage 翻译缓存结构 */
export interface TranslateCacheStore {
  [key: string]: TranslateCacheItem
}
