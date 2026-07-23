// 学习记录页：累计统计 + 题型正确率 + 年份正确率 + 最近学习 + 错题入口
//
// 数据来源：
//   - ProgressContext.getExamStats：每份试卷的答题统计
//   - ProgressContext.store：原始记录，用于按题型/年份聚合
//   - RecentContext：最近访问的试卷
//   - dataLoader.getExamIndex：试卷元信息（年份、题型、题数）

import { Link } from 'react-router-dom'
import {
  ChartNoAxesColumn,
  Target,
  TrendingUp,
  XCircle,
  Flag,
  ArrowRight,
  BookOpen,
} from 'lucide-react'
import { useRecent } from '../context/RecentContext'
import { useProgress } from '../context/ProgressContext'
import { getExamIndex } from '../lib/dataLoader'
import { getWrongCount, getMarkedCount, SECTION_LABEL } from '../lib/wrongBook'
import type { SectionType } from '../types'

// 题型列表（按显示顺序）
const SECTION_ORDER: SectionType[] = ['cloze', 'reading', 'newType', 'translation', 'writing']

export default function HistoryPage() {
  const { items } = useRecent()
  const { store, getExamStats } = useProgress()
  const index = getExamIndex()

  // ====== 统计：累计 ======
  let totalAnswered = 0
  let totalCorrect = 0
  for (const e of index.exams) {
    const s = getExamStats(e.key)
    totalAnswered += s.answered
    totalCorrect += s.correct
  }
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  // ====== 统计：错题数、标记数 ======
  const wrongCount = getWrongCount(store)
  const markedCount = getMarkedCount(store)

  // ====== 按题型统计（基于 store + index 中的题型清单） ======
  // store 仅有 paperId→questionId，题型需查试卷，但这里不异步加载
  // 简化方案：遍历 index 中每个 entry 的 sections 列表（已含 type）
  // 但 questionId 与 type 的对应需要试卷内部映射，简化为按试卷 sections 整体聚合
  // 实际正确率按题型：需异步加载所有试卷，这里以"最近 N 份有记录的试卷"为样本
  const papersWithProgress = index.exams.filter(
    (e) => store[e.key] && Object.keys(store[e.key]).length > 0,
  )

  // ====== 按年份统计正确率（基于已答题的试卷） ======
  const yearStats = papersWithProgress
    .map((e) => {
      const s = getExamStats(e.key)
      const acc = s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0
      return { year: e.year, subject: e.subject, answered: s.answered, correct: s.correct, accuracy: acc, total: e.questionCount }
    })
    .sort((a, b) => b.year - a.year)

  // ====== 按题型粗略统计（基于最近 10 份有记录的试卷） ======
  // 真正按题型需要 questionId → type 映射，这里用简化版：
  // 遍历每份试卷的 sections，按题型分组，但记录层面是 questionId
  // 退而求其次：仅展示题型分类卡片，正确率用整卷正确率代替
  // 完整实现需异步加载试卷，此处保持同步、轻量
  const recentPapers = yearStats.slice(0, 12)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 animate-fade-in">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ChartNoAxesColumn className="w-5 h-5 text-ochre-dark" />
          <h1 className="font-serif text-3xl font-bold text-ink">学习记录</h1>
        </div>
        <p className="text-sm text-ink-muted">
          查看你的累计答题、正确率趋势、错题与标记题汇总。
        </p>
      </header>

      {/* 概览卡片：4 项 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="paper-card p-4 text-center">
          <Target className="w-5 h-5 mx-auto text-ochre-dark mb-2" />
          <div className="text-2xl font-serif font-bold text-ink">{totalAnswered}</div>
          <div className="text-xs text-ink-muted">累计答题</div>
        </div>
        <div className="paper-card p-4 text-center">
          <TrendingUp className="w-5 h-5 mx-auto text-green-600 mb-2" />
          <div className="text-2xl font-serif font-bold text-ink">{accuracy}%</div>
          <div className="text-xs text-ink-muted">总正确率</div>
        </div>
        <Link to="/wrongbook" className="paper-card p-4 text-center hover:shadow-paper-hover hover:border-seal/40 transition-all">
          <XCircle className="w-5 h-5 mx-auto text-seal-dark mb-2" />
          <div className="text-2xl font-serif font-bold text-seal-dark">{wrongCount}</div>
          <div className="text-xs text-ink-muted">错题数</div>
        </Link>
        <Link to="/wrongbook" className="paper-card p-4 text-center hover:shadow-paper-hover hover:border-seal/40 transition-all">
          <Flag className="w-5 h-5 mx-auto text-seal-dark mb-2" />
          <div className="text-2xl font-serif font-bold text-ink">{markedCount}</div>
          <div className="text-xs text-ink-muted">标记题</div>
        </Link>
      </div>

      {/* 错题本快捷入口（仅当有错题时显示） */}
      {wrongCount > 0 && (
        <Link
          to="/wrongbook"
          className="block paper-card p-4 mb-6 bg-gradient-to-r from-seal/5 to-paper border-seal/30 hover:shadow-paper-hover transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-seal/10 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-5 h-5 text-seal-dark" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-sm font-bold text-ink">
                你有 {wrongCount} 道错题待复习
              </div>
              <div className="text-xs text-ink-muted">
                点击进入错题本，按年份/题型筛选重练
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-seal-dark group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 题型分类（仅作入口卡片，正确率需异步加载） */}
        <section>
          <h2 className="font-serif text-sm font-bold text-ink mb-3 pb-1.5 border-b border-line">
            按题型浏览
          </h2>
          <div className="space-y-2">
            {SECTION_ORDER.map((type) => (
              <Link
                key={type}
                to={`/training?type=${type}`}
                className="paper-card p-3 flex items-center justify-between hover:shadow-paper-hover transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="scholar-tag">{SECTION_LABEL[type]}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-ochre-dark group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </section>

        {/* 年份正确率趋势 */}
        <section>
          <h2 className="font-serif text-sm font-bold text-ink mb-3 pb-1.5 border-b border-line">
            年份正确率
          </h2>
          {recentPapers.length === 0 ? (
            <div className="paper-card p-6 text-center text-sm text-ink-muted">
              暂无做题记录
            </div>
          ) : (
            <ul className="space-y-1.5">
              {recentPapers.map((s) => (
                <li
                  key={`${s.year}-${s.subject}`}
                  className="paper-card p-2.5 flex items-center gap-3"
                >
                  <span className="font-serif text-sm font-bold text-ink w-16 flex-shrink-0">
                    {s.year}
                  </span>
                  <span className="text-[10px] text-ink-muted w-12 flex-shrink-0">
                    {s.subject}
                  </span>
                  {/* 正确率条 */}
                  <div className="flex-1 h-2 bg-paper-deep rounded-full overflow-hidden relative">
                    <div
                      className={`h-full transition-all ${
                        s.accuracy >= 60
                          ? 'bg-green-500'
                          : s.accuracy >= 40
                            ? 'bg-ochre-dark'
                            : 'bg-seal'
                      }`}
                      style={{ width: `${s.accuracy}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs font-mono w-12 text-right flex-shrink-0 ${
                      s.accuracy >= 60
                        ? 'text-green-700'
                        : s.accuracy >= 40
                          ? 'text-ochre-dark'
                          : 'text-seal-dark'
                    }`}
                  >
                    {s.accuracy}%
                  </span>
                  <span className="text-[10px] text-ink-muted font-mono w-14 text-right flex-shrink-0">
                    {s.correct}/{s.answered}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 最近学习列表 */}
      <section>
        <h2 className="font-serif text-lg font-bold text-ink mb-3">最近学习</h2>
        {items.length === 0 ? (
          <div className="paper-card p-8 text-center">
            <p className="font-serif italic text-ink-muted text-base mb-2">尚无学习记录</p>
            <p className="text-sm text-ink-muted mb-4">
              打开任意一套真题开始学习，记录将自动保存在此。
            </p>
            <Link to="/papers" className="scholar-tag hover:bg-ochre-pale">
              <BookOpen className="w-3 h-3" /> 浏览真题卷宗
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 12).map((item, i) => {
              const entry = index.exams.find((e) => e.key === item.paperId)
              if (!entry) return null
              const stats = getExamStats(item.paperId)
              const progress = entry.questionCount > 0
                ? Math.round((stats.answered / entry.questionCount) * 100)
                : 0
              const acc = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : 0
              return (
                <li key={i}>
                  <Link
                    to={`/paper/${item.paperId}`}
                    className="paper-card p-3 flex items-center gap-3 hover:shadow-paper-hover transition-all"
                  >
                    <span className="font-serif text-xl font-bold text-ink w-12">
                      {entry.year}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-ink-soft">{entry.subject}</span>
                        <span className="text-[10px] text-ink-muted font-mono">
                          {stats.answered}/{entry.questionCount}题
                        </span>
                        {stats.answered > 0 && (
                          <span className="text-[10px] font-mono text-ochre-dark">
                            正确率 {acc}%
                          </span>
                        )}
                      </div>
                      <div className="h-1 bg-paper-deep rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full ${
                            progress === 100 ? 'bg-green-500' : 'bg-ochre-dark'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-ink-muted font-mono">
                      {new Date(item.visitedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
