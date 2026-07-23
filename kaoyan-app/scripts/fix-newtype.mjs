// 新题型段落排序数据修复脚本
//
// 修复内容：
// 1. 从 directions 解析已放置段落（"Paragraphs F, H, and C have been correctly placed"）
// 2. 从原始 pre-migration 数据提取段落顺序结构（"F → 41. → 42. → H → 43. → C → 44. → 45."）
// 3. 将 placedParagraphs / paragraphOrder 写入 article
// 4. 过滤每个 question 的 options，移除已放置段落（避免出现"选了F但F已在文中"的矛盾）
//
// 用法：node scripts/fix-newtype.mjs
// 幂等：可重复执行

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EXAMS_DIR = join(__dirname, '..', 'src', 'data', 'exams')
const GIT_REF = '6b63dac' // pre-migration commit

// ============================================================
// 从 directions 解析已放置段落
// ============================================================
function parsePlacedParagraphs(directions) {
  if (!directions) return []
  const m = directions.match(/Paragraphs\s+(.+?)\s+have been correctly placed/)
  if (!m) return []
  return (m[1].match(/[A-H]/g) || []).sort()
}

// ============================================================
// 从原始数据提取段落顺序结构
// ============================================================
function extractParagraphOrder(originalText) {
  if (!originalText) return null
  // 匹配 "F → 41. → 42. → H → 43. → C → 44. → 45." 这类模式
  const m = originalText.match(
    /([A-H])\s*[→\-]\s*(\d{2})[.\s]*[→\-]\s*([A-H\d.\s→\-]+)/,
  )
  if (!m) return null
  // 清理并标准化：去掉多余空格和句号，统一用 → 连接
  const raw = `${m[1]} → ${m[2]} → ${m[3]}`
  // 提取所有 token（字母或两位数字）
  const tokens = raw.match(/[A-H]|\d{2}/g) || []
  return tokens.join(' → ')
}

// ============================================================
// 获取原始 pre-migration 数据
// ============================================================
function getOriginalContent(examFile) {
  try {
    const gitPath = `kaoyan-app/src/data/exams/${examFile}`
    const output = execSync(`git cat-file -p ${GIT_REF}:${gitPath}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const d = JSON.parse(output)
    const rd = (d.sections || []).find((s) => s.type === 'reading')
    if (!rd || rd.questions.length === 0) return null
    const last = rd.questions[rd.questions.length - 1]
    return last.question || ''
  } catch {
    return null
  }
}

// ============================================================
// 主流程
// ============================================================
const files = readdirSync(EXAMS_DIR).filter((f) => f.endsWith('.json'))
let fixed = 0
let skipped = 0

for (const fn of files) {
  const path = join(EXAMS_DIR, fn)
  const raw = readFileSync(path, 'utf-8')
  const data = JSON.parse(raw)

  const nt = (data.sections || []).find((s) => s.type === 'newType')
  if (!nt || !nt.questions || nt.questions.length === 0) {
    skipped++
    continue
  }

  // 1. 解析已放置段落
  const placed = parsePlacedParagraphs(nt.directions)

  // 2. 从原始数据提取段落顺序
  const originalText = getOriginalContent(fn)
  const order = extractParagraphOrder(originalText)

  let changed = false

  // 3. 写入 article（placedParagraphs + paragraphOrder）
  // 注意：不移除已放置段落的 options 文本——UI 通过 placedParagraphs 区分"已放置/待选"
  for (const article of nt.articles || []) {
    if (placed.length > 0) {
      article.placedParagraphs = placed
      changed = true
    }
    if (order) {
      article.paragraphOrder = order
      changed = true
    }
  }

  if (changed) {
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    fixed++
    console.log(
      `✓ ${fn}: placed=[${placed.join(',')}] order=${order ? `"${order}"` : 'N/A'} options=${Object.keys(nt.questions[0]?.options || {}).join(',')}`,
    )
  } else {
    skipped++
  }
}

console.log(`\n完成：修复 ${fixed} 套，跳过 ${skipped} 套`)
