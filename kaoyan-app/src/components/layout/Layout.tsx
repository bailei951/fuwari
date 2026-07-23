// 全局布局：顶部导航 + 内容容器 + 页脚
// 导航含：书房首页 / 卷宗 / 生词本 / 学习记录 / 专项训练 / 设置

import { Link, useLocation } from 'react-router-dom'
import { BookMarked, Library, NotebookPen, ChartNoAxesColumn, Dice5, Settings as SettingsIcon } from 'lucide-react'
import { useVocab } from '../../context/VocabContext'

interface LayoutProps {
  children: React.ReactNode
}

const NAV_ITEMS = [
  { to: '/', label: '书房', icon: BookMarked },
  { to: '/papers', label: '卷宗', icon: Library },
  { to: '/vocab', label: '生词本', icon: NotebookPen },
  { to: '/history', label: '记录', icon: ChartNoAxesColumn },
  { to: '/training', label: '训练', icon: Dice5 },
  { to: '/settings', label: '设置', icon: SettingsIcon },
] as const

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { words } = useVocab()

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-line/60 bg-paper/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-1">
          <Link to="/" className="flex items-center gap-2.5 mr-6">
            <div className="w-7 h-7 rounded-sm bg-ink flex items-center justify-center">
              <BookMarked className="w-4 h-4 text-paper" strokeWidth={2} />
            </div>
            <span className="font-serif font-bold text-ink tracking-tight">真题书房</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
              const isVocab = to === '/vocab'
              return (
                <Link
                  key={to}
                  to={to}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm transition-colors ${
                    active
                      ? 'bg-ochre-pale/60 text-ochre-dark font-medium'
                      : 'text-ink-soft hover:text-ochre-dark hover:bg-paper-deep/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {isVocab && words.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 bg-seal/10 text-seal text-[10px] font-mono rounded-sm">
                      {words.length}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {/* 移动端导航：水平滚动 */}
        <div className="md:hidden border-t border-line-soft px-3 py-1.5 flex gap-1 overflow-x-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
            const isVocab = to === '/vocab'
            return (
              <Link
                key={to}
                to={to}
                className={`relative inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs whitespace-nowrap ${
                  active
                    ? 'bg-ochre-pale/60 text-ochre-dark'
                    : 'text-ink-muted hover:text-ochre-dark'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
                {isVocab && words.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-seal/10 text-seal text-[10px] font-mono rounded-sm">
                    {words.length}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line/60 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-ink-muted font-mono">
          <span>考研英语真题 · Reader's Edition · 印于 2026</span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ochre-dark" />
            纯前端 · localStorage · 可静态部署
          </span>
        </div>
      </footer>
    </div>
  )
}
