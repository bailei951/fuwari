// 错题本聚合工具：从 ProgressStore + 试卷数据中提取错题、收藏题
//
// 数据来源：
//   - ProgressContext.store：每个 paperId → questionId → {status, marked, submittedAt}
//   - dataLoader.getExamIndex() + loadPaper()：试卷元信息 + 题目详情
//
// 用途：
//   - 错题本页面：按年份/题型/错误次数筛选展示
//   - 学习记录页：统计错题总数、收藏总数
//   - 专项训练：从错题中随机抽题重练

import type {
  ProgressStore,
  QuestionProgress,
  Question,
  SectionType,
  Paper,
  ExamIndex,
  ExamIndexEntry,
} from '../types'
import { getExamIndex, loadPaper } from './dataLoader'

// ============================================================
// 类型定义
// ============================================================

/** 错题项：含试卷元信息 + 题目详情 + 进度 */
export interface WrongItem {
  paperId: string
  year: number
  subject: ExamIndexEntry['subject']
  questionId: number
  /** 题型 */
  type: SectionType
  /** 关联文章 id */
  articleId: string
  /** 题干（完形为空） */
  question: string
  /** 选项 */
  options: Record<string, string>
  /** 正确答案 */
  answer: 'A' | 'B' | 'C' | 'D'
  /** 用户选的答案 */
  userAnswer: 'A' | 'B' | 'C' | 'D' | null
  /** 提交时间 */
  submittedAt: string
  /** 是否标记 */
  marked: boolean
}

/** 按年份分组的错题 */
export interface WrongGroupByYear {
  year: number
  items: WrongItem[]
}

/** 按题型分组的错题 */
export interface WrongGroupByType {
  type: SectionType
  items: WrongItem[]
}

/** 错题统计 */
export interface WrongStats {
  total: number
  marked: number
  byYear: { year: number; count: number }[]
  byType: { type: SectionType; count: number }[]
}

// ============================================================
// 题型标签
// ============================================================

export const SECTION_LABEL: Record<SectionType, string> = {
  cloze: '完形填空',
  reading: '阅读理解',
  newType: '新题型',
  translation: '翻译',
  writing: '写作',
}

// ============================================================
// 错题提取
// ============================================================

/** 试卷缓存：避免重复加载 */
const paperCache = new Map<string, Paper>()

async function getPaper(paperId: string): Promise<Paper | null> {
  if (paperCache.has(paperId)) return paperCache.get(paperId)!
  const paper = await loadPaper(paperId)
  if (paper) paperCache.set(paperId, paper)
  return paper
}

/** 查找题目在试卷中的位置 */
function findQuestion(paper: Paper, questionId: number): Question | null {
  for (const sec of paper.sections) {
    const q = sec.questions.find((q) => q.id === questionId)
    if (q) return q
  }
  return null
}

/**
 * 收集所有错题
 * 遍历 ProgressStore，对 status='wrong' 的题目加载试卷详情
 */
export async function collectWrongItems(store: ProgressStore): Promise<WrongItem[]> {
  const index = getExamIndex()
  const entryMap = new Map(index.exams.map((e) => [e.key, e]))
  const items: WrongItem[] = []

  for (const [paperId, qMap] of Object.entries(store)) {
    const entry = entryMap.get(paperId)
    if (!entry) continue
    const paper = await getPaper(paperId)
    if (!paper) continue

    for (const [qIdStr, progress] of Object.entries(qMap)) {
      if (progress.status !== 'wrong') continue
      const questionId = parseInt(qIdStr, 10)
      const q = findQuestion(paper, questionId)
      if (!q) continue

      items.push({
        paperId,
        year: entry.year,
        subject: entry.subject,
        questionId,
        type: q.type,
        articleId: q.articleId,
        question: q.question,
        options: q.options,
        answer: q.answer,
        userAnswer: progress.selected,
        submittedAt: progress.submittedAt ?? '',
        marked: progress.marked,
      })
    }
  }

  return items
}

/**
 * 收集所有标记题（含答对/答错，仅看 marked=true）
 */
export async function collectMarkedItems(store: ProgressStore): Promise<WrongItem[]> {
  const index = getExamIndex()
  const entryMap = new Map(index.exams.map((e) => [e.key, e]))
  const items: WrongItem[] = []

  for (const [paperId, qMap] of Object.entries(store)) {
    const entry = entryMap.get(paperId)
    if (!entry) continue
    const paper = await getPaper(paperId)
    if (!paper) continue

    for (const [qIdStr, progress] of Object.entries(qMap)) {
      if (!progress.marked) continue
      const questionId = parseInt(qIdStr, 10)
      const q = findQuestion(paper, questionId)
      if (!q) continue

      items.push({
        paperId,
        year: entry.year,
        subject: entry.subject,
        questionId,
        type: q.type,
        articleId: q.articleId,
        question: q.question,
        options: q.options,
        answer: q.answer,
        userAnswer: progress.selected,
        submittedAt: progress.submittedAt ?? '',
        marked: true,
      })
    }
  }

  return items
}

// ============================================================
// 统计（轻量同步版：仅遍历 store，不加载试卷）
// ============================================================

/** 错题数（同步，仅基于 store 计数） */
export function getWrongCount(store: ProgressStore): number {
  let count = 0
  for (const qMap of Object.values(store)) {
    for (const p of Object.values(qMap)) {
      if (p.status === 'wrong') count++
    }
  }
  return count
}

/** 标记题数（同步） */
export function getMarkedCount(store: ProgressStore): number {
  let count = 0
  for (const qMap of Object.values(store)) {
    for (const p of Object.values(qMap)) {
      if (p.marked) count++
    }
  }
  return count
}

// ============================================================
// 筛选
// ============================================================

export type WrongFilter = 'all' | 'wrong' | 'marked'

/** 按筛选条件过滤 */
export function filterItems(items: WrongItem[], filter: WrongFilter): WrongItem[] {
  if (filter === 'wrong') return items.filter((i) => i.userAnswer !== null && i.answer !== i.userAnswer)
  if (filter === 'marked') return items.filter((i) => i.marked)
  return items
}

/** 按年份分组 */
export function groupByYear(items: WrongItem[]): WrongGroupByYear[] {
  const map = new Map<number, WrongItem[]>()
  for (const item of items) {
    if (!map.has(item.year)) map.set(item.year, [])
    map.get(item.year)!.push(item)
  }
  return Array.from(map.entries())
    .map(([year, items]) => ({ year, items }))
    .sort((a, b) => b.year - a.year)
}

/** 按题型分组 */
export function groupByType(items: WrongItem[]): WrongGroupByType[] {
  const map = new Map<SectionType, WrongItem[]>()
  for (const item of items) {
    if (!map.has(item.type)) map.set(item.type, [])
    map.get(item.type)!.push(item)
  }
  return Array.from(map.entries())
    .map(([type, items]) => ({ type, items }))
    .sort((a, b) => a.type.localeCompare(b.type))
}

/** 按错误次数排序：同题被答错多次（不同试卷可重题）暂不支持，按提交时间倒序 */
export function sortByRecent(items: WrongItem[]): WrongItem[] {
  return [...items].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

// ============================================================
// 随机抽题（用于专项训练）
// ============================================================

/** 从错题中随机抽取 n 题 */
export function sampleRandom(items: WrongItem[], n: number): WrongItem[] {
  if (items.length <= n) return [...items]
  const copy = [...items]
  // Fisher-Yates 洗牌前 n 题
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

/** 按题型+年份范围筛选 */
export function filterByTypeAndYear(
  items: WrongItem[],
  type: SectionType | 'all',
  yearRange?: [number, number],
): WrongItem[] {
  return items.filter((i) => {
    if (type !== 'all' && i.type !== type) return false
    if (yearRange && (i.year < yearRange[0] || i.year > yearRange[1])) return false
    return true
  })
}

// ============================================================
// 类型保护：QuestionProgress 兼容旧数据
// ============================================================

export function isWrong(p: QuestionProgress): boolean {
  return p.status === 'wrong' && p.submittedAt !== null
}

/** 清空错题缓存（切换数据后调用） */
export function clearWrongCache() {
  paperCache.clear()
}

// 重新导出 ExamIndex 类型方便外部使用
export type { ExamIndex }
