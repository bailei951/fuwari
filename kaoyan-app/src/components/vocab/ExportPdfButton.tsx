// PDF 导出按钮：处理加载与错误状态

import { useState } from 'react'
import { Download, Loader2, Check, AlertCircle } from 'lucide-react'
import { exportVocabToPdf } from '../../lib/pdf'
import type { VocabItem } from '../../types'

interface ExportPdfButtonProps {
  words: VocabItem[]
  disabled?: boolean
  className?: string
}

export default function ExportPdfButton({
  words,
  disabled,
  className = '',
}: ExportPdfButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleExport() {
    if (words.length === 0) return
    setState('loading')
    setErrorMsg('')
    try {
      await exportVocabToPdf(words, {
        title: '考研英语 · 生词本',
        subtitle: `共收录 ${words.length} 个生词 · 真题书房 Reader's Edition`,
      })
      setState('success')
      setTimeout(() => setState('idle'), 3000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '导出失败')
      setState('error')
      setTimeout(() => setState('idle'), 5000)
    }
  }

  const buttonClass =
    className ||
    'inline-flex items-center gap-2 px-4 py-2 bg-ink text-paper rounded-sm text-sm hover:bg-ochre-dark transition-all shadow-paper hover:shadow-paper-hover'

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={disabled || words.length === 0 || state === 'loading'}
        className={`${buttonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {state === 'loading' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> 生成中…
          </>
        ) : state === 'success' ? (
          <>
            <Check className="w-4 h-4" /> 已下载
          </>
        ) : (
          <>
            <Download className="w-4 h-4" /> 导出 PDF
          </>
        )}
      </button>

      {state === 'error' && (
        <span className="inline-flex items-center gap-1 text-xs text-seal-dark">
          <AlertCircle className="w-3 h-3" /> {errorMsg}
        </span>
      )}
    </div>
  )
}
