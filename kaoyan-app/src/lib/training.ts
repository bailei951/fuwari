// 专项训练抽题工具：按题型/年份/数量/模式抽取题目
//
// 数据流：
//   1. 从 exam-index 获取所有试卷 key
//   2. 按年份范围筛选
//   3. 异步加载试卷，扁平化所有题目
//   4. 按题型筛选
//   5. 按模式筛选（全部 / 仅错题 / 仅标记题）
//   6. 随机打乱 + 截取指定数量

import type { Paper, Question, SectionType } from '../types'
import { loadPaper, getExamIndex } from './dataLoader'
import type { ProgressStore } from '../types'

/** 训练题目：题目本身 + 所属试卷元信息 */
export interface TrainingItem {
  paperId: string
  year: number
  subject: Paper['subject']
  question: Question
  /** 关联文章标题（用于完形上下文） */
  articleTitle?: string
  /** 关联文章首段（用于完形上下文展示） */
  articleFirstPara?: string
}

/** 抽题配置 */
export interface TrainingConfig {
  /** 题型；'all' 表示全部 */
  type: SectionType | 'all'
  /** 年份范围（含两端） */
  yearFrom: number
  yearTo: number
  /** 抽题数量 */
  count: number
  /** 模式 */
  mode: 'all' | 'wrong' | 'marked'
}

/** 默认配置 */
export const DEFAULT_CONFIG: TrainingConfig = {
  type: 'all',
  yearFrom: 1998,
  yearTo: 2026,
  count: 10,
  mode: 'all',
}

/**
 * 从所有试卷中抽取符合条件的题目
 */
export async function drawQuestions(
  config: TrainingConfig,
  store: ProgressStore,
): Promise<TrainingItem[]> {
  const index = getExamIndex()
  // 1. 按年份筛选试卷
  const targetEntries = index.exams.filter(
    (e) => e.year >= config.yearFrom && e.year <= config.yearTo,
  )

  // 2. 异步加载所有目标试卷
  const papers = await Promise.all(
    targetEntries.map((e) => loadPaper(e.key)),
  )

  // 3. 扁平化所有题目 + 关联文章
  const all: TrainingItem[] = []
  for (const paper of papers) {
    if (!paper) continue
    for (const section of paper.sections) {
      // 按题型筛选
      if (config.type !== 'all' && section.type !== config.type) continue
      // translation/writing 无选择题，跳过
      if (section.type === 'translation' || section.type === 'writing') continue

      // 建立 articleId → article 映射
      const articleMap = new Map(section.articles.map((a) => [a.id, a]))

      for (const q of section.questions) {
        // 按模式筛选
        const prog = store[paper.id]?.[q.id]
        if (config.mode === 'wrong' && prog?.status !== 'wrong') continue
        if (config.mode === 'marked' && !prog?.marked) continue

        const article = q.articleId ? articleMap.get(q.articleId) : undefined
        const firstParaBlock = article?.blocks.find((b) => b.type === 'paragraph')

        all.push({
          paperId: paper.id,
          year: paper.year,
          subject: paper.subject,
          question: q,
          articleTitle: article?.title,
          articleFirstPara:
            firstParaBlock && firstParaBlock.type === 'paragraph'
              ? firstParaBlock.content.slice(0, 120)
              : undefined,
        })
      }
    }
  }

  // 4. 随机打乱 + 截取
  const shuffled = shuffle(all)
  return shuffled.slice(0, config.count)
}

/** Fisher-Yates 洗牌 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 全部年份范围 */
export function getYearRange(): { min: number; max: number } {
  const exams = getExamIndex().exams
  const years = exams.map((e) => e.year)
  return {
    min: Math.min(...years),
    max: Math.max(...years),
  }
}
