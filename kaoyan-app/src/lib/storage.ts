// localStorage 封装：统一读写、错误处理、JSON 序列化

const PREFIX = 'ky:' // kaoyan 前缀，避免与其他应用冲突

function fullKey(key: string): string {
  return PREFIX + key
}

/** 读取并 JSON 解析 */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(fullKey(key))
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch (err) {
    console.warn(`[storage] 读取 ${key} 失败：`, err)
    return fallback
  }
}

/** 序列化并写入 */
export function writeJSON<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(fullKey(key), JSON.stringify(value))
    return true
  } catch (err) {
    console.warn(`[storage] 写入 ${key} 失败：`, err)
    return false
  }
}

/** 删除单个 key */
export function remove(key: string): void {
  localStorage.removeItem(fullKey(key))
}

/** 清空本应用所有数据（用于设置页"重置"） */
export function clearAll(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) keys.push(k)
  }
  keys.forEach((k) => localStorage.removeItem(k))
}

/** 简易 uuid（无 crypto.randomUUID 时降级） */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** 存储键集中管理，避免拼写错误 */
export const StorageKeys = {
  PROGRESS: 'progress',
  VOCAB: 'vocab',
  ANNOTATIONS: 'annotations',
  RECENT: 'recent',
  TRANSLATE_SETTINGS: 'translate-settings',
  TRANSLATE_HISTORY: 'translate-history',
} as const
