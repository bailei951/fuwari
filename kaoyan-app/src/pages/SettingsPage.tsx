// 设置页：字号 / 主题 / 存档 / 翻译缓存 / 数据重置
import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Type, Database, Download, Trash2, AlertTriangle, Languages, Sun, Moon, Monitor } from 'lucide-react'
import { useFontScale, FONT_SCALE_LABEL } from '../hooks/useFontScale'
import { useTheme, THEME_LABEL, type Theme } from '../hooks/useTheme'
import BackupModal from '../components/settings/BackupModal'
import { clearTranslateCache, getCacheStats } from '../lib/translate'

export default function SettingsPage() {
  const fontScale = useFontScale()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [backupOpen, setBackupOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [cacheStats, setCacheStats] = useState({ count: 0, sizeBytes: 0 })

  function refreshCacheStats() {
    setCacheStats(getCacheStats())
  }

  useEffect(() => {
    refreshCacheStats()
  }, [])

  function handleClearCache() {
    clearTranslateCache()
    refreshCacheStats()
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  function handleResetAll() {
    // 仅清空本应用 localStorage，不影响其他网站
    localStorage.clear()
    setConfirmReset(false)
    window.location.reload()
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 animate-fade-in">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <SettingsIcon className="w-5 h-5 text-ochre-dark" />
          <h1 className="font-serif text-3xl font-bold text-ink">设置</h1>
        </div>
        <p className="text-sm text-ink-muted">
          字号、主题、存档管理与数据重置。
        </p>
      </header>

      {/* 字号设置 */}
      <section className="paper-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Type className="w-4 h-4 text-ink-muted" />
          <h2 className="font-serif text-sm font-bold text-ink">字号设置</h2>
        </div>
        <p className="text-xs text-ink-muted mb-3">
          当前字号：<span className="font-mono">{FONT_SCALE_LABEL[fontScale.scale]}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={fontScale.decrease}
            className="px-3 py-1.5 text-xs bg-paper-deep border border-line rounded-sm hover:bg-ochre-pale transition-colors"
          >
            缩小 A-
          </button>
          <button
            onClick={fontScale.reset}
            className="px-3 py-1.5 text-xs bg-paper-deep border border-line rounded-sm hover:bg-ochre-pale transition-colors"
          >
            重置
          </button>
          <button
            onClick={fontScale.increase}
            className="px-3 py-1.5 text-xs bg-paper-deep border border-line rounded-sm hover:bg-ochre-pale transition-colors"
          >
            放大 A+
          </button>
        </div>
      </section>

      {/* 主题切换 */}
      <section className="paper-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          {resolvedTheme === 'dark' ? (
            <Moon className="w-4 h-4 text-ochre-dark" />
          ) : (
            <Sun className="w-4 h-4 text-ochre-dark" />
          )}
          <h2 className="font-serif text-sm font-bold text-ink">主题切换</h2>
        </div>
        <p className="text-xs text-ink-muted mb-3">
          当前主题：<span className="font-mono">{THEME_LABEL[theme]}</span>
          {theme === 'system' && (
            <span className="text-ink-muted/70">（当前跟随系统：{THEME_LABEL[resolvedTheme]}）</span>
          )}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(['light', 'dark', 'system'] as Theme[]).map((t) => {
            const Icon = t === 'light' ? Sun : t === 'dark' ? Moon : Monitor
            const active = theme === t
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`inline-flex flex-col items-center gap-1 px-3 py-2.5 text-xs rounded-sm border transition-colors ${
                  active
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-paper-deep border-line text-ink-muted hover:bg-ochre-pale hover:text-ochre-dark'
                }`}
              >
                <Icon className="w-4 h-4" />
                {THEME_LABEL[t]}
              </button>
            )
          })}
        </div>
      </section>

      {/* 存档管理 */}
      <section className="paper-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-ink-muted" />
          <h2 className="font-serif text-sm font-bold text-ink">存档管理</h2>
        </div>
        <p className="text-xs text-ink-muted mb-3">
          导出全部学习数据（进度、生词本、批注）为 JSON 文件，或从备份恢复。
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBackupOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-ink text-paper rounded-sm hover:bg-ochre-dark transition-colors"
          >
            <Download className="w-3 h-3" /> 打开存档管理
          </button>
        </div>
      </section>

      {/* 翻译缓存 */}
      <section className="paper-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Languages className="w-4 h-4 text-ink-muted" />
          <h2 className="font-serif text-sm font-bold text-ink">翻译缓存</h2>
        </div>
        <p className="text-xs text-ink-muted mb-3">
          划词翻译结果会缓存 7 天，重复查询直接命中缓存以减少 API 调用。
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-ink-muted">
            缓存条目：<span className="font-mono text-ink">{cacheStats.count}</span> 条
            <span className="mx-2 text-ink-muted/40">·</span>
            占用：<span className="font-mono text-ink">{formatBytes(cacheStats.sizeBytes)}</span>
          </div>
          <button
            onClick={handleClearCache}
            disabled={cacheStats.count === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-seal-dark border border-seal/40 rounded-sm hover:bg-seal/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3 h-3" /> 清空缓存
          </button>
        </div>
      </section>

      {/* 危险区：重置数据 */}
      <section className="paper-card p-4 mb-4 border-seal/30">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-seal-dark" />
          <h2 className="font-serif text-sm font-bold text-seal-dark">危险操作</h2>
        </div>
        <p className="text-xs text-ink-muted mb-3">
          清空所有学习数据（含进度、生词、批注、最近学习），此操作不可恢复，建议先备份。
        </p>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-seal-dark border border-seal/40 rounded-sm hover:bg-seal/5 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> 重置全部数据
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-seal/5 p-3 rounded-sm">
            <p className="text-xs text-seal-dark flex-1">
              确定清空所有数据吗？此操作不可恢复！
            </p>
            <button
              onClick={handleResetAll}
              className="px-3 py-1.5 bg-seal text-paper rounded-sm text-xs hover:bg-seal-dark"
            >
              确认清空
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-3 py-1.5 text-ink-muted text-xs hover:text-ink"
            >
              取消
            </button>
          </div>
        )}
      </section>

      {/* 关于 */}
      <section className="text-center text-xs text-ink-muted font-mono mt-8">
        <p>考研英语真题 · Reader's Edition · 纯前端应用</p>
        <p className="mt-1">数据存储于浏览器 localStorage，可静态部署</p>
      </section>

      <BackupModal open={backupOpen} onClose={() => setBackupOpen(false)} />
    </div>
  )
}
