// 用户自有翻译 API 密钥设置（保存在本浏览器 localStorage）
// 密钥仅经本站 /api/translate 代理转发至 apihz.cn，不暴露给第三方页面

import type { TranslateSettings } from '../types'
import { readJSON, remove, writeJSON, StorageKeys } from './storage'

const EMPTY: TranslateSettings = { apihzId: '', apihzKey: '' }

/** 读取用户翻译 API 设置 */
export function getTranslateSettings(): TranslateSettings {
  return readJSON<TranslateSettings>(StorageKeys.TRANSLATE_SETTINGS, EMPTY)
}

/** 保存设置（空字符串等价于清除） */
export function saveTranslateSettings(settings: TranslateSettings): void {
  const trimmed: TranslateSettings = {
    apihzId: settings.apihzId.trim(),
    apihzKey: settings.apihzKey.trim(),
  }
  if (!trimmed.apihzId || !trimmed.apihzKey) {
    remove(StorageKeys.TRANSLATE_SETTINGS)
    return
  }
  writeJSON(StorageKeys.TRANSLATE_SETTINGS, trimmed)
}

/** 清除设置 */
export function clearTranslateSettings(): void {
  remove(StorageKeys.TRANSLATE_SETTINGS)
}

/** 是否已配置用户自有密钥 */
export function hasOwnApiKey(): boolean {
  const s = getTranslateSettings()
  return !!(s.apihzId && s.apihzKey)
}
