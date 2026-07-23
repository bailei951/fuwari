// 首页（书房）：继续学习模块 + 真题库卡片 + 快捷入口
// 打开网站第一眼看到"继续学习"，促进用户持续学习

import { Link } from 'react-router-dom'
import {
  BookMarked,
  Clock3,
  NotebookPen,
  Dice5,
  ChartNoAxesColumn,
  ArrowRight,
  Library,
  RotateCcw,
} from 'lucide-react'
import { getExamIndex } from '../lib/dataLoader'
import { useRecent } from '../context/RecentContext'
import { useProgress } from '../context/ProgressContext'

export default function HomePage() {
  const index = getExamIndex()
  const { items } = useRecent()
  const { getExamStats } = useProgress()

  // 最近学习（取最近一条作为"继续学习"）
  const lastItem = items[0]
  const lastEntry = lastItem
    ? index.exams.find((e) => e.key === lastItem.paperId)
    : null
  const lastStats = lastItem ? getExamStats(lastItem.paperId) : null

  // 按年份降序展示最近 6 套
  const recentPapers = [...index.exams]
    .sort((a, b) => b.year - a.year)
    .slice(0, 6)

  // 全局统计
  let totalAnswered = 0
  let totalCorrect = 0
  for (const e of index.exams) {
    const s = getExamStats(e.key)
    totalAnswered += s.answered
    totalCorrect += s.correct
  }
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in">
      {/* 标题 */}
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookMarked className="w-6 h-6 text-ochre-dark" />
          <h1 className="font-serif text-3xl font-bold text-ink">真题书房</h1>
        </div>
        <p className="text-sm text-ink-muted">
          打开真题，每日精进。累计答题 {totalAnswered} 题，正确率 {accuracy}%
        </p>
      </header>

      {/* 继续学习模块 */}
      {lastEntry && lastStats && (
        <section className="mb-8">
          <div className="paper-card p-5 bg-gradient-to-br from-ochre-pale/40 to-paper border-ochre/30">
            <div className="flex items-center gap-2 mb-2 text-ochre-dark">
              <Clock3 className="w-4 h-4" />
              <span className="text-xs font-mono uppercase tracking-wider">继续学习</span>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h2 className="font-serif text-2xl font-bold text-ink mb-1">
                  {lastEntry.year} {lastEntry.subject}
                </h2>
                <div className="flex items-center gap-3 text-xs text-ink-muted">
                  <span className="font-mono">
                    {lastStats.answered}/{lastEntry.questionCount} 题
                  </span>
                  {lastStats.answered > 0 && (
                    <span>
                      正确率{' '}
                      <span className="font-mono text-ochre-dark">
                        {Math.round((lastStats.correct / lastStats.answered) * 100)}%
                      </span>
                    </span>
                  )}
                  <span>
                    上次{' '}
                    {new Date(lastItem!.visitedAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
              <Link
                to={`/paper/${lastEntry.key}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-paper rounded-sm text-sm hover:bg-ochre-dark transition-colors"
              >
                继续学习
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 快捷入口 */}
      <section className="mb-8">
        <h2 className="font-serif text-sm font-bold text-ink-muted mb-3">快捷入口</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink
            to="/papers"
            icon={Library}
            label="真题卷宗"
            sub="46 套真题"
          />
          <QuickLink
            to="/history"
            icon={ChartNoAxesColumn}
            label="学习记录"
            sub={`${items.length} 条`}
          />
          <QuickLink
            to="/vocab"
            icon={NotebookPen}
            label="生词本"
            sub="划词收藏"
          />
          <QuickLink
            to="/training"
            icon={Dice5}
            label="专项训练"
            sub="弱项突破"
          />
        </div>
      </section>

      {/* 最近真题 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-sm font-bold text-ink-muted">最近真题</h2>
          <Link
            to="/papers"
            className="text-xs text-ochre-dark hover:underline inline-flex items-center gap-1"
          >
            查看全部 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recentPapers.map((entry) => {
            const stats = getExamStats(entry.key)
            const progress = entry.questionCount > 0
              ? Math.round((stats.answered / entry.questionCount) * 100)
              : 0
            return (
              <Link
                key={entry.key}
                to={`/paper/${entry.key}`}
                className="paper-card p-3 hover:shadow-paper-hover hover:border-ochre/40 transition-all group"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-serif text-xl font-bold text-ink group-hover:text-ochre-dark transition-colors">
                      {entry.year}
                    </span>
                    <span className="text-[11px] text-ink-muted">{entry.subject}</span>
                  </div>
                  {progress === 100 && (
                    <RotateCcw className="w-3 h-3 text-green-600" />
                  )}
                </div>
                <div className="h-1 bg-paper-deep rounded-full overflow-hidden mb-1.5">
                  <div
                    className={`h-full transition-all ${
                      progress === 100 ? 'bg-green-500' : progress > 0 ? 'bg-ochre-dark' : ''
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-ink-muted font-mono">
                  <span>{stats.answered}/{entry.questionCount}题</span>
                  {stats.answered > 0 && (
                    <span>
                      {Math.round((stats.correct / stats.answered) * 100)}% 正确
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function QuickLink({
  to,
  icon: Icon,
  label,
  sub,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  sub: string
}) {
  return (
    <Link
      to={to}
      className="paper-card p-3 flex items-center gap-3 hover:shadow-paper-hover hover:border-ochre/40 transition-all group"
    >
      <div className="w-9 h-9 rounded-sm bg-ochre-pale/40 flex items-center justify-center group-hover:bg-ochre-pale/70 transition-colors">
        <Icon className="w-4 h-4 text-ochre-dark" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-[10px] text-ink-muted truncate">{sub}</div>
      </div>
    </Link>
  )
}
