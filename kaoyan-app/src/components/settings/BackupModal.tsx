// 存档管理弹窗：导出 JSON / 导入 JSON / 重置全部数据

import { useRef, useState } from 'react'
import { Download, Upload, AlertTriangle, Archive, Check } from 'lucide-react'
import Modal from '../common/Modal'
import {
  downloadArchive,
  importArchiveFromString,
  readFileAsText,
  resetAllData,
  buildArchive,
} from '../../lib/backup'
import { useProgress } from '../../context/ProgressContext'
import { useVocab } from '../../context/VocabContext'
import { useRecent } from '../../context/RecentContext'
import { useAnnotations } from '../../context/AnnotationContext'

interface BackupModalProps {
  open: boolean
  onClose: () => void
}

export default function BackupModal({ open, onClose }: BackupModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null,
  )
  const [confirmReset, setConfirmReset] = useState(false)
  const progressReload = useProgress().reload
  const vocabReload = useVocab().reload
  const recentReload = useRecent().reload
  const annotationReload = useAnnotations().reload

  function showMsg(type: 'success' | 'error' | 'info', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  function handleExport() {
    const archive = buildArchive()
    downloadArchive()
    const annotCount = Object.values(archive.annotations ?? {}).reduce(
      (s, l) => s + l.length,
      0,
    )
    showMsg(
      'success',
      `已导出存档：${archive.vocab.words.length} 个生词、${
        Object.keys(archive.progress).length
      } 份试卷进度、${annotCount} 条批注。`,
    )
  }

  async function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const ok = importArchiveFromString(text)
      if (ok) {
        // 重新加载所有状态层
        progressReload()
        vocabReload()
        recentReload()
        annotationReload()
        showMsg('success', '存档导入成功，所有数据已刷新。')
      } else {
        showMsg('error', '导入失败：文件不是本应用的有效存档。')
      }
    } catch {
      showMsg('error', '导入失败：文件读取错误。')
    }
    // 清空 input 以便重复选择同一文件
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleReset() {
    resetAllData()
    progressReload()
    vocabReload()
    recentReload()
    annotationReload()
    setConfirmReset(false)
    showMsg('info', '所有学习数据已清空。')
  }

  return (
    <Modal open={open} onClose={onClose} title="存档管理" maxWidth="max-w-xl">
      <div className="space-y-5">
        <p className="text-sm text-ink-muted leading-relaxed">
          学习数据保存在浏览器本地。为防止更换设备或清理缓存导致记录丢失，可定期导出存档备份；在新设备上导入即可恢复。
        </p>

        {/* 导出 */}
        <div className="p-4 border border-line rounded-sm bg-paper-deep/30">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-sm bg-ochre-pale/60 flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-ochre-dark" />
            </div>
            <div className="flex-1">
              <h4 className="font-serif font-bold text-ink text-sm mb-1">导出存档</h4>
              <p className="text-xs text-ink-muted mb-3">
                下载一个 JSON 文件，包含全部做题进度、生词本、批注、最近记录。
              </p>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-ink text-paper rounded-sm text-xs hover:bg-ochre-dark transition-colors"
              >
                <Download className="w-3 h-3" /> 下载存档 JSON
              </button>
            </div>
          </div>
        </div>

        {/* 导入 */}
        <div className="p-4 border border-line rounded-sm bg-paper-deep/30">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-sm bg-ochre-pale/60 flex items-center justify-center flex-shrink-0">
              <Upload className="w-4 h-4 text-ochre-dark" />
            </div>
            <div className="flex-1">
              <h4 className="font-serif font-bold text-ink text-sm mb-1">导入存档</h4>
              <p className="text-xs text-ink-muted mb-3">
                选择之前导出的 JSON 文件，<strong className="text-seal">将覆盖当前所有数据</strong>。
              </p>
              <button
                onClick={handleImportClick}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-ink/30 text-ink rounded-sm text-xs hover:border-ochre hover:text-ochre-dark transition-colors"
              >
                <Upload className="w-3 h-3" /> 选择文件导入
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* 重置 */}
        <div className="p-4 border border-seal/40 rounded-sm bg-seal/5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-sm bg-seal/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-seal" />
            </div>
            <div className="flex-1">
              <h4 className="font-serif font-bold text-seal-dark text-sm mb-1">清空所有数据</h4>
              <p className="text-xs text-ink-muted mb-3">
                不可恢复。建议先导出存档再执行此操作。
              </p>
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-seal/40 text-seal rounded-sm text-xs hover:bg-seal/10 transition-colors"
                >
                  <AlertTriangle className="w-3 h-3" /> 我要清空
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-seal text-paper rounded-sm text-xs hover:bg-seal-dark transition-colors"
                  >
                    确认清空
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="px-3 py-1.5 text-ink-muted text-xs hover:text-ink transition-colors"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-sm text-sm animate-slide-up ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : message.type === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-ochre-pale/40 text-ochre-dark border border-ochre/30'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Archive className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
