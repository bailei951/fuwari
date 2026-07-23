// 首页：Hero + 卷宗入口 + 最近学习记录

import { Link } from 'react-router-dom'
import { ArrowRight, Library, NotebookPen, Dice5, Clock, BookOpen } from 'lucide-react'
import { getAllYears, getIndexBySubject } from '../lib/dataLoader'
import { useRecent } from '../context/RecentContext'
import { useProgress } from '../context/ProgressContext'
import { useVocab } from '../context/VocabContext'

export default function HomePage() {
  const english1 = getIndexBySubject('英语一')
  const english2 = getIndexBySubject('英语二')
  const allYears = getAllYears()
  const { items: recentItems } = useRecent()
  const { store: progressStore } = useProgress()
  const { words: vocabWords } = useVocab()

  const totalAnswered = Object.values(progressStore).reduce(
    (sum, examProgress) =>
      sum + Object.values(examProgress).filter((p) => p.submittedAt !== null).length,
    0,
  )

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <header className="max-w-6xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="flex justify-center mb-6">
          <span className="stamp-badge animate-stamp-in">EST · 1980 — 2026</span>
        </div>
        <h1 className="font-serif font-bold text-ink leading-[0.95] tracking-tight">
          <span className="block text-6xl md:text-8xl mb-2">考研英语</span>
          <span className="block text-4xl md:text-6xl italic text-ochre-dark">
            真题<span className="text-seal">书房</span>
          </span>
        </h1>
        <p className="font-serif italic text-ink-muted text-base md:text-xl mt-6 max-w-xl mx-auto">
          印纸成卷，临卷成章。
          <br className="md:hidden" />
          四十余年真题，一卷在手。
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link
            to="/exams"
            className="group inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper rounded-sm font-medium hover:bg-ochre-dark transition-all shadow-paper hover:shadow-paper-hover"
          >
            翻开卷宗
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            to="/vocab"
            className="inline-flex items-center gap-2 px-6 py-3 border border-ink/20 text-ink rounded-sm font-medium hover:border-ochre hover:text-ochre-dark transition-all"
          >
            <NotebookPen className="w-4 h-4" /> 生词本
            {vocabWords.length > 0 && (
              <span className="scholar-tag ml-1">{vocabWords.length}</span>
            )}
          </Link>
        </div>
      </header>

      {/* 全局统计条 */}
      <section className="max-w-6xl mx-auto px-6 py-6">
        <div className="paper-card grid grid-cols-2 md:grid-cols-4 divide-x divide-line">
          <StatBlock value={allYears.length} label="年份覆盖" sub={`${allYears[0] ?? '—'} → ${allYears[allYears.length - 1] ?? '—'}`} />
          <StatBlock value={english1.length} label="英语一卷宗" sub="学术硕士方向" />
          <StatBlock value={english2.length} label="英语二卷宗" sub="专业硕士方向" />
          <StatBlock value={totalAnswered} label="已答题数" sub="本机累计" />
        </div>
      </section>

      {/* 卷宗入口三卡 */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px flex-1 bg-line" />
          <span className="scholar-tag">VOLUMES · 卷宗目录</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <SubjectCard
            to="/exams?subject=英语一"
            badge="ENGLISH I"
            title="英语一"
            desc="学术论文、长难句密集，对应学术硕士培养方向。"
            count={english1.length}
            yearRange="2026 → 1980"
            delay="0.05s"
          />
          <SubjectCard
            to="/exams?subject=英语二"
            badge="ENGLISH II"
            title="英语二"
            desc="商务应用文体为主，对应专业硕士培养方向。"
            count={english2.length}
            yearRange="2026 → 2010"
            delay="0.12s"
          />
          <SubjectCard
            to="/training"
            badge="RANDOM"
            title="题型训练"
            desc="阅读、完形、新题型、翻译，随机抽题强化薄弱点。"
            count={4}
            yearRange="4 大题型"
            delay="0.19s"
            variant="highlight"
          />
        </div>
      </section>

      {/* 最近学习 */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Clock className="w-4 h-4 text-ochre-dark" />
          <h2 className="font-serif text-xl font-bold text-ink">最近在读</h2>
          <div className="h-px flex-1 bg-line" />
        </div>

        {recentItems.length === 0 ? (
          <div className="paper-card p-12 text-center">
            <div className="inline-flex w-12 h-12 rounded-full bg-ochre-pale/50 items-center justify-center mb-4">
              <BookOpen className="w-5 h-5 text-ochre-dark" />
            </div>
            <p className="font-serif italic text-ink-muted text-lg mb-1">书房尚空，待君翻卷。</p>
            <p className="text-sm text-ink-muted">选择一份卷宗，开始你的研读。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentItems.slice(0, 6).map((item) => {
              const [year, subject] = item.examKey.split('-')
              const yearNum = parseInt(year)
              const subjectLabel = subject === 'english1' ? '英语一' : '英语二'
              const stats = progressStore[item.examKey] ?? {}
              const answered = Object.values(stats).filter((p) => p.submittedAt !== null).length
              return (
                <Link
                  key={item.examKey}
                  to={`/exam/${item.examKey}`}
                  className="paper-card paper-card-hover p-5 group block animate-slide-up"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="font-serif text-3xl font-bold text-ochre-dark">
                      {yearNum}
                    </span>
                    <span className="scholar-tag">{subjectLabel}</span>
                  </div>
                  <p className="text-xs text-ink-muted font-mono mb-2">
                    访问于 {new Date(item.visitedAt).toLocaleDateString('zh-CN')}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-line-soft">
                    <span className="text-xs text-ink-muted">
                      已答 {answered} 题
                    </span>
                    <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-ochre-dark group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 快速入口 */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickLink to="/exams" icon={Library} label="卷宗目录" />
          <QuickLink to="/vocab" icon={NotebookPen} label="生词本" badge={vocabWords.length} />
          <QuickLink to="/progress" icon={BookOpen} label="学习记录" />
          <QuickLink to="/training" icon={Dice5} label="随机训练" />
        </div>
      </section>
    </div>
  )
}

function StatBlock({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div className="p-5 text-center">
      <div className="text-3xl md:text-4xl font-serif font-bold text-ochre-dark">{value}</div>
      <div className="text-sm text-ink-soft mt-1">{label}</div>
      <div className="text-xs text-ink-muted font-mono mt-0.5">{sub}</div>
    </div>
  )
}

function SubjectCard({
  to,
  badge,
  title,
  desc,
  count,
  yearRange,
  delay,
  variant,
}: {
  to: string
  badge: string
  title: string
  desc: string
  count: number
  yearRange: string
  delay: string
  variant?: 'highlight'
}) {
  return (
    <Link
      to={to}
      className={`paper-card paper-card-hover p-7 group block animate-slide-up ${
        variant === 'highlight' ? 'bg-paper-deep/40' : ''
      }`}
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className={variant === 'highlight' ? 'scholar-tag' : 'stamp-badge'}>{badge}</span>
        <span className="font-mono text-xs text-ink-muted">{yearRange}</span>
      </div>
      <h3 className="font-serif text-2xl font-bold text-ink mb-2">{title}</h3>
      <p className="text-sm text-ink-muted leading-relaxed mb-5">{desc}</p>
      <div className="flex items-center justify-between pt-4 border-t border-line-soft">
        <span className="text-xs font-mono text-ochre-dark">{count} 份卷宗</span>
        <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-ochre-dark group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  )
}

function QuickLink({
  to,
  icon: Icon,
  label,
  badge,
}: {
  to: string
  icon: typeof Library
  label: string
  badge?: number
}) {
  return (
    <Link
      to={to}
      className="paper-card paper-card-hover p-4 flex items-center gap-3 group"
    >
      <div className="w-9 h-9 rounded-sm bg-ochre-pale/50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-ochre-dark" />
      </div>
      <span className="font-medium text-ink text-sm group-hover:text-ochre-dark transition-colors">
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto scholar-tag">{badge}</span>
      )}
    </Link>
  )
}
