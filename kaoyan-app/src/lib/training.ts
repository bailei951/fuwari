// 专项训练抽题工具：按题型/年份/数量/模式抽取【完整题型单元】
//
// 单元（TrainingUnit）= 一篇文章 + 该文章下所有题目
//   - 完形：一整篇完形文章 + 全部 20 空
//   - 阅读：一整篇阅读文章 + 该篇 5 题
//   - 新题型：一整篇新题型文章 + 全部 5 题
//   - 翻译：翻译 section（一篇文章 + 1 题，主观）
//   - 写作：写作 section（一篇文章 + 2 题，主观）
//
// 数据流：
//   1. 从 exam-index 获取所有试卷 key
//   2. 按年份范围筛选
//   3. 异步加载试卷，按 section 分组为单元
//   4. 按题型筛选
//   5. 按模式筛选（全部 / 仅含错题 / 仅含标记题 的单元）
//   6. 随机打乱 + 截取指定数量（单元数）

import type { Paper, Question, Article, SectionType, ProgressStore } from '../types'
import { loadPaper, getExamIndex } from './dataLoader'

/** 训练单元：一篇文章 + 该文章下所有题目（完整题型单元） */
export interface TrainingUnit {
  paperId: string
  year: number
  subject: Paper['subject']
  /** 题型 */
  sectionType: SectionType
  /** section 标题 */
  sectionTitle: string
  /** section 答题说明 */
  directions?: string
  /** 关联文章（完形/阅读/新题型/翻译/写作均有；缺省时为空） */
  article?: Article
  /** 本单元所有题目（同一文章下） */
  questions: Question[]
}

/** 抽题配置 */
export interface TrainingConfig {
  /** 题型；'all' 表示全部客观题（完形/阅读/新题型） */
  type: SectionType | 'all'
  /** 年份范围（含两端） */
  yearFrom: number
  yearTo: number
  /** 抽取单元数量 */
  count: number
  /** 模式 */
  mode: 'all' | 'wrong' | 'marked'
}

/** 默认配置 */
export const DEFAULT_CONFIG: TrainingConfig = {
  type: 'all',
  yearFrom: 1998,
  yearTo: 2026,
  count: 5,
  mode: 'all',
}

/**
 * 判断单元是否符合模式筛选
 * - all：全部通过
 * - wrong：单元内至少一题 status='wrong'
 * - marked：单元内至少一题 marked=true
 */
function unitMatchesMode(
  unit: TrainingUnit,
  mode: TrainingConfig['mode'],
  store: ProgressStore,
): boolean {
  if (mode === 'all') return true
  return unit.questions.some((q) => {
    const p = store[unit.paperId]?.[q.id]
    if (!p) return false
    return mode === 'wrong' ? p.status === 'wrong' : p.marked
  })
}

/** 构建单元 */
function buildUnit(
  paper: Paper,
  section: Paper['sections'][number],
  questions: Question[],
  article?: Article,
): TrainingUnit {
  return {
    paperId: paper.id,
    year: paper.year,
    subject: paper.subject,
    sectionType: section.type,
    sectionTitle: section.title,
    directions: section.directions,
    article,
    questions,
  }
}

/**
 * 从所有试卷中抽取符合条件的【完整单元】
 */
export async function drawUnits(
  config: TrainingConfig,
  store: ProgressStore,
): Promise<TrainingUnit[]> {
  const index = getExamIndex()
  // 1. 按年份筛选试卷
  const targetEntries = index.exams.filter(
    (e) => e.year >= config.yearFrom && e.year <= config.yearTo,
  )

  // 2. 异步加载所有目标试卷
  const papers = await Promise.all(targetEntries.map((e) => loadPaper(e.key)))

  // 3. 按 section + article 分组为单元
  const all: TrainingUnit[] = []
  for (const paper of papers) {
    if (!paper) continue
    for (const section of paper.sections) {
      // 按题型筛选
      if (config.type !== 'all' && section.type !== config.type) continue
      // 'all' 模式仅取客观题（完形/阅读/新题型）；主观题需显式选择
      if (config.type === 'all' && (section.type === 'translation' || section.type === 'writing')) {
        continue
      }

      const articleMap = new Map(section.articles.map((a) => [a.id, a]))
      // 按 articleId 分组
      const byArticle = new Map<string, Question[]>()
      const noArticle: Question[] = []
      for (const q of section.questions) {
        if (q.articleId) {
          if (!byArticle.has(q.articleId)) byArticle.set(q.articleId, [])
          byArticle.get(q.articleId)!.push(q)
        } else {
          noArticle.push(q)
        }
      }

      // 每篇文章 → 一个单元
      for (const [artId, qs] of byArticle) {
        const unit = buildUnit(paper, section, qs, articleMap.get(artId))
        if (unitMatchesMode(unit, config.mode, store)) all.push(unit)
      }
      // 无文章的题目合并为一个单元
      if (noArticle.length > 0) {
        const unit = buildUnit(paper, section, noArticle, undefined)
        if (unitMatchesMode(unit, config.mode, store)) all.push(unit)
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
