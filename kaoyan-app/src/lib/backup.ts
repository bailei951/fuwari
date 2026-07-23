// 存档导出/导入：把所有 localStorage 数据打包为 JSON 文件下载，支持反向导入

import { readJSON, writeJSON, clearAll, StorageKeys } from './storage'
import type { ProgressStore, VocabStore, AnnotationStore, RecentStore } from '../types'

/** 存档结构 */
export interface ArchiveData {
  __app: 'kaoyan-english-practice'
  __version: string
  __exportedAt: string
  progress: ProgressStore
  vocab: VocabStore
  annotations: AnnotationStore
  recent: RecentStore
}

const ARCHIVE_VERSION = '1.0'

/** 收集当前所有 localStorage 数据为存档对象 */
export function buildArchive(): ArchiveData {
  return {
    __app: 'kaoyan-english-practice',
    __version: ARCHIVE_VERSION,
    __exportedAt: new Date().toISOString(),
    progress: readJSON<ProgressStore>(StorageKeys.PROGRESS, {}),
    vocab: readJSON<VocabStore>(StorageKeys.VOCAB, { words: [] }),
    annotations: readJSON<AnnotationStore>(StorageKeys.ANNOTATIONS, {}),
    recent: readJSON<RecentStore>(StorageKeys.RECENT, { items: [] }),
  }
}

/** 触发浏览器下载 JSON 存档文件 */
export function downloadArchive(): void {
  const archive = buildArchive()
  const json = JSON.stringify(archive, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().slice(0, 10)
  a.download = `kaoyan-archive-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 解析存档 JSON 字符串并校验 */
export function parseArchive(jsonString: string): ArchiveData | null {
  try {
    const data = JSON.parse(jsonString)
    if (data.__app !== 'kaoyan-english-practice') {
      console.warn('[backup] 不是本应用的存档文件')
      return null
    }
    return data as ArchiveData
  } catch (err) {
    console.warn('[backup] 存档解析失败：', err)
    return null
  }
}

/** 把存档写回 localStorage（覆盖） */
export function restoreArchive(archive: ArchiveData): void {
  writeJSON(StorageKeys.PROGRESS, archive.progress ?? {})
  writeJSON(StorageKeys.VOCAB, archive.vocab ?? { words: [] })
  writeJSON(StorageKeys.ANNOTATIONS, archive.annotations ?? {})
  writeJSON(StorageKeys.RECENT, archive.recent ?? { items: [] })
}

/** 从 JSON 字符串一键导入 */
export function importArchiveFromString(jsonString: string): boolean {
  const archive = parseArchive(jsonString)
  if (!archive) return false
  restoreArchive(archive)
  return true
}

/** 清空所有学习数据（不可恢复） */
export function resetAllData(): void {
  clearAll()
}

/** 读取本地文件为字符串 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
