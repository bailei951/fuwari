// 试卷数据迁移脚本：拆分阅读末题题干，生成 newType / translation / writing 分区
//
// 背景：每套试卷阅读理解最后一题（如 Q40）的题干里被塞入了整张试卷剩余内容：
//   "Part B Directions: ...(新题型 Q41-45)... Part C Directions: ...(翻译 Q46-50)..."
// 写作题则完全缺失。本脚本：
//   1. 清洗阅读末题题干（仅保留真实题干）
//   2. 从 Part B 文本构建 newType 分区（段落排序/匹配/小标题）
//   3. 从 Part C 文本构建 translation 分区（英语一画线句翻译；缺则占位）
//   4. 为所有试卷追加 writing 分区（标准说明 + 评分标准，题目待录入）
//   5. 重写 exam-index.json
//
// 幂等：已存在对应 type 分区则跳过该分区。
//
// 用法：node scripts/migrate-exams.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXAMS_DIR = path.resolve(__dirname, '../src/data/exams')
const INDEX_PATH = path.resolve(__dirname, '../src/data/exam-index.json')

// ------------------------------------------------------------
// 工具
// ------------------------------------------------------------

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}
function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

const EMPTY_ANALYSIS = { coreAnalysis: '', optionAnalysis: {}, location: '', vocab: [] }

/** 从 Part 文本中提取 directions（到 "N points)" 为止）与剩余 body */
function splitDirectionsAndBody(text, marker) {
  // 去掉开头 marker
  const rest = text.replace(marker, '').trim()
  // directions 通常以 "(10 points)" / "( 10 points )" / "（10 points）" 结尾
  // 非贪婪匹配到首个 "points"，不锚定到字符串末尾（body 紧随其后）
  const m = rest.match(/^([\s\S]*?\(?\s*\d+\s*points\s*\)?)/i)
  let directions, body
  if (m && m[1].length >= 10 && m[1].length < 800) {
    directions = (marker + m[1]).trim()
    body = rest.slice(m[1].length).trim()
  } else {
    directions = marker.trim()
    body = rest
  }
  return { directions, body }
}

/**
 * 从 body 中解析 "[ A ]text [ B ]text ..." 形式的选项
 * 返回 { options: {A:text,...}, bodyWithoutOptions }
 */
const OPTION_RE = /\[\s*([A-H])\s*\]\s*([^\[]*)/g

function extractOptions(body) {
  const options = {}
  let lastEnd = -1
  let firstStart = Infinity
  const matches = []
  let m
  OPTION_RE.lastIndex = 0
  while ((m = OPTION_RE.exec(body)) !== null) {
    const letter = m[1]
    const text = m[2].trim()
    // 过滤过短或明显非选项的（如 [图]）；要求 text 至少 4 字符
    if (text.length >= 3) {
      matches.push({ letter, text, index: m.index, end: m.index + m[0].length })
      if (m.index < firstStart) firstStart = m.index
      lastEnd = Math.max(lastEnd, m.index + m[0].length)
    }
  }
  if (matches.length === 0) return { options: {}, bodyWithoutOptions: body }
  for (const mt of matches) options[mt.letter] = mt.text
  // 选项区通常集中在末尾；保留 firstStart 之前的正文，丢弃选项区
  const bodyWithoutOptions = body.slice(0, firstStart).trim()
  return { options, bodyWithoutOptions }
}

/** 将 "(41)占位符...位置" 占位符转为 blank 块，正文分段为 paragraph 块 */
const PLACEHOLDER_RE = /\(4[1-5]\)\s*占位符[\s\S]*?位置/g

function buildNewTypeBlocks(body) {
  const blocks = []
  let last = 0
  let m
  PLACEHOLDER_RE.lastIndex = 0
  let foundPlaceholder = false
  while ((m = PLACEHOLDER_RE.exec(body)) !== null) {
    foundPlaceholder = true
    const before = body.slice(last, m.index)
    pushParaBlocks(blocks, before)
    // 从占位符中提取题号
    const idMatch = m[0].match(/\((4[1-5])\)/)
    const blankId = idMatch ? parseInt(idMatch[1], 10) : 0
    if (blankId) blocks.push({ type: 'blank', blankId })
    last = m.index + m[0].length
  }
  pushParaBlocks(blocks, body.slice(last))
  return { blocks, hasBlanks: foundPlaceholder }
}

function pushParaBlocks(blocks, text) {
  const t = text.trim()
  if (!t) return
  // 按空行/换行分段
  const paras = t.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
  for (const p of paras) blocks.push({ type: 'paragraph', content: p.replace(/\n/g, ' ') })
}

/** 从 Part C 翻译文本中提取画线句 (46)-(50) */
function extractTranslationSentences(body) {
  const sentences = []
  // 找到所有 (46)..(50) 标记位置
  const markerRe = /\((4[6-9]|50)\)/g
  const marks = []
  let m
  while ((m = markerRe.exec(body)) !== null) {
    marks.push({ id: parseInt(m[1], 10), index: m.index, end: m.index + m[0].length })
  }
  if (marks.length === 0) return { sentences: [], passage: body }
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].end
    const end = i + 1 < marks.length ? marks[i + 1].index : body.length
    let chunk = body.slice(start, end).trim()
    // 画线句通常是该 chunk 的第一句；按句号切分取首句，但允许一定长度
    const firstSentence = extractFirstSentence(chunk)
    sentences.push({ id: marks[i].id, sentence: firstSentence })
  }
  // passage：保留全文（含标记），便于上下文阅读
  const passage = body.trim()
  return { sentences, passage }
}

function extractFirstSentence(chunk) {
  if (!chunk) return ''
  // 按句末标点 + 空格/换行 切分
  const parts = chunk.split(/(?<=[.?!])\s+|\n+/).filter(Boolean)
  if (parts.length === 0) return chunk.trim()
  // 取首句；若首句过短（<15 字符），合并到第二句
  let s = parts[0].trim()
  if (s.length < 15 && parts[1]) s = (s + ' ' + parts[1]).trim()
  // 限制最长 600 字符，避免误吞非画线内容
  if (s.length > 600) s = s.slice(0, 600).trim() + '…'
  return s
}

// ------------------------------------------------------------
// 分区构建
// ------------------------------------------------------------

function buildNewTypeSection(text, paperId) {
  const { directions, body } = splitDirectionsAndBody(text, 'Part B Directions:')
  const { options, bodyWithoutOptions } = extractOptions(body)
  const { blocks, hasBlanks } = buildNewTypeBlocks(bodyWithoutOptions)

  // 若既无占位符也无选项，仍把整段正文作为只读文章
  const articleBlocks = blocks.length > 0 ? blocks : [{ type: 'paragraph', content: bodyWithoutOptions || body }]

  const questions = [41, 42, 43, 44, 45].map((id) => ({
    id,
    articleId: 'newtype-1',
    type: 'newType',
    question: '',
    options,
    answer: '',
    analysis: { ...EMPTY_ANALYSIS },
    analysisText: '',
    position: 0,
  }))

  return {
    id: 'sec-newtype',
    type: 'newType',
    title: '新题型',
    directions: directions || 'Part B',
    articles: [
      {
        id: 'newtype-1',
        title: '新题型',
        type: 'newType',
        blocks: articleBlocks,
      },
    ],
    questions,
    _meta: { hasBlanks, optionCount: Object.keys(options).length },
  }
}

function buildTranslationSection(text, paperId, subject) {
  const { directions, body } = splitDirectionsAndBody(text, 'Part C Directions:')
  const { sentences, passage } = extractTranslationSentences(body)

  let questions
  let articleBlocks
  if (sentences.length > 0) {
    // 英语一画线句翻译
    questions = sentences.map((s) => ({
      id: s.id,
      articleId: 'trans-1',
      type: 'translation',
      question: s.sentence,
      options: {},
      answer: '',
      analysis: { ...EMPTY_ANALYSIS },
      analysisText: '',
      position: 0,
      subjective: {
        reference: '',
        scoringCriteria: [
          '准确传达原文内容，无漏译、错译',
          '译文通顺连贯，符合中文表达习惯',
          '专有名词、长难句结构处理得当',
        ],
        maxScore: 2,
        wordLimit: '译成中文',
      },
    }))
    articleBlocks = [{ type: 'paragraph', content: passage }]
  } else {
    // 英语二段落翻译 / 数据缺失
    questions = [
      {
        id: 46,
        articleId: 'trans-1',
        type: 'translation',
        question: '请将下列英文段落译成中文。',
        options: {},
        answer: '',
        analysis: { ...EMPTY_ANALYSIS },
        analysisText: '',
        position: 0,
        subjective: {
          reference: '',
          scoringCriteria: [
            '准确传达原文内容',
            '译文通顺连贯，符合中文表达习惯',
            '关键词汇与长难句结构处理得当',
          ],
          maxScore: 15,
          wordLimit: '将一段约 150 词的英文译成中文',
        },
      },
    ]
    articleBlocks = [
      {
        type: 'paragraph',
        content: passage || '（翻译原文待录入：请参考当年真题对应段落。）',
      },
    ]
  }

  return {
    id: 'sec-translation',
    type: 'translation',
    title: '翻译',
    directions: directions || '将画线部分译成中文。',
    articles: [
      {
        id: 'trans-1',
        title: '翻译',
        type: 'translation',
        blocks: articleBlocks,
      },
    ],
    questions,
  }
}

function buildTranslationPlaceholderSection(subject) {
  // 无 Part C 数据（多数英语二 / 部分英语一）的占位翻译分区
  return buildTranslationSection('Part C Directions: Translate the following into Chinese. (15 points)', null, subject)
}

function buildWritingSection(paper) {
  const isEng2 = paper.subject === '英语二'
  const partA = isEng2
    ? {
        question: 'Part A 小作文：请根据情境撰写一篇约 100 词的短文（书信 / 通知 / 便条等）。',
        wordLimit: '约 100 词',
        maxScore: 10,
      }
    : {
        question: 'Part A 小作文：请根据情境撰写一篇约 100 词的应用文（书信 / 通知 / 邀请函等）。',
        wordLimit: '约 100 词',
        maxScore: 10,
      }
  const partB = isEng2
    ? {
        question: 'Part B 大作文：请根据图表撰写一篇约 150 词的议论文，描述图表并进行分析论证。',
        wordLimit: '约 150 词',
        maxScore: 15,
      }
    : {
        question: 'Part B 大作文：请根据图画撰写一篇 160-200 词的议论文，描述图画并论述其寓意。',
        wordLimit: '160-200 词',
        maxScore: 20,
      }

  const mkQ = (id, cfg, title) => ({
    id,
    articleId: 'writing-1',
    type: 'writing',
    question: cfg.question + '\n\n（具体题目以当年真题为准，此处为作答与评分模块。）',
    options: {},
    answer: '',
    analysis: { ...EMPTY_ANALYSIS },
    analysisText: '',
    position: 0,
    subjective: {
      reference: '',
      scoringCriteria: [
        '内容切题，涵盖题目要求的信息点',
        '结构清晰，段落分明，逻辑连贯',
        '语言准确，语法与用词得当',
        '词汇与句式多样，表达地道',
        '格式与语域符合文体要求',
      ],
      maxScore: cfg.maxScore,
      wordLimit: cfg.wordLimit,
    },
  })

  return {
    id: 'sec-writing',
    type: 'writing',
    title: '写作',
    directions: isEng2
      ? 'Part A 与 Part B 两部分。Part A 约 100 词；Part B 根据图表写作约 150 词。'
      : 'Part A 与 Part B 两部分。Part A 应用文约 100 词；Part B 图画作文 160-200 词。',
    articles: [
      {
        id: 'writing-1',
        title: '写作',
        type: 'writing',
        blocks: [
          {
            type: 'paragraph',
            content:
              '请在下方答题区作答。提交后可查看评分标准进行自评。具体写作题目以当年真题为准。',
          },
        ],
      },
    ],
    questions: [mkQ(51, partA, '小作文'), mkQ(52, partB, '大作文')],
  }
}

// ------------------------------------------------------------
// 主流程
// ------------------------------------------------------------

function migrateExam(data, key) {
  const reading = (data.sections || []).find((s) => s.type === 'reading')
  if (!reading || reading.questions.length === 0) return { data, changed: false, info: 'no reading' }

  const last = reading.questions[reading.questions.length - 1]
  const stem = last.question || ''
  const bIdx = stem.indexOf('Part B Directions')
  if (bIdx < 0) return { data, changed: false, info: 'no Part B' }

  // 拆分
  const realStem = stem.slice(0, bIdx).trim()
  const cIdx = stem.indexOf('Part C Directions', bIdx)
  const partBText = stem.slice(bIdx, cIdx >= 0 ? cIdx : stem.length)
  const partCText = cIdx >= 0 ? stem.slice(cIdx) : ''

  // 清洗阅读末题题干
  last.question = realStem

  const sections = data.sections.filter(
    (s) => s.type !== 'newType' && s.type !== 'translation' && s.type !== 'writing',
  )

  // newType
  if (!sections.some((s) => s.type === 'newType')) {
    const nt = buildNewTypeSection(partBText, key)
    sections.push(nt)
  }
  // translation
  if (!sections.some((s) => s.type === 'translation')) {
    const tr = partCText
      ? buildTranslationSection(partCText, key, data.subject)
      : buildTranslationPlaceholderSection(data.subject)
    sections.push(tr)
  }
  // writing
  if (!sections.some((s) => s.type === 'writing')) {
    sections.push(buildWritingSection(data))
  }

  data.sections = sections
  return {
    data,
    changed: true,
    info: `stem=${realStem.length}|partB=${partBText.length}|partC=${partCText.length}`,
  }
}

function main() {
  const files = fs.readdirSync(EXAMS_DIR).filter((f) => f.endsWith('.json')).sort()
  const index = readJSON(INDEX_PATH)
  const indexMap = new Map(index.exams.map((e) => [e.key, e]))

  let migrated = 0
  const newIndexEntries = []

  for (const f of files) {
    const key = f.replace(/\.json$/, '')
    const fullPath = path.join(EXAMS_DIR, f)
    const data = readJSON(fullPath)
    const { data: next, changed, info } = migrateExam(data, key)
    if (changed) {
      writeJSON(fullPath, next)
      migrated++
    }

    // 重建索引条目
    const entry = indexMap.get(key) || { key, year: next.year, subject: next.subject, sections: [], questionCount: 0 }
    const sectionTypes = (next.sections || []).map((s) => s.type)
    const questionCount = (next.sections || []).reduce((sum, s) => sum + (s.questions?.length || 0), 0)
    newIndexEntries.push({
      key,
      year: next.year ?? entry.year,
      subject: next.subject ?? entry.subject,
      sections: sectionTypes,
      questionCount,
    })
    console.log(`${f.padEnd(22)} ${changed ? '✓ migrated' : '· skip'}    ${info}`)
  }

  // 重写索引（按原顺序）
  const orderMap = new Map(index.exams.map((e, i) => [e.key, i]))
  newIndexEntries.sort((a, b) => {
    const oa = orderMap.has(a.key) ? orderMap.get(a.key) : 9999
    const ob = orderMap.has(b.key) ? orderMap.get(b.key) : 9999
    return oa - ob
  })
  index.exams = newIndexEntries
  writeJSON(INDEX_PATH, index)

  console.log(`\n迁移完成：${migrated}/${files.length} 套试卷。索引已更新。`)
}

main()
