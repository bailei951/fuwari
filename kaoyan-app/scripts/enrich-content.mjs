// 翻译与写作题目内容补全脚本
// - 翻译：为占位题补充结构化题干（引用原文、标注分值与字数要求）
// - 写作：按年份/科目补充 Part A 应用文 + Part B 图画/图表作文的完整题目文本
//
// 用法：node scripts/enrich-content.mjs
// 幂等：重复执行不会重复修改已补全的内容

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EXAMS_DIR = join(__dirname, '..', 'src', 'data', 'exams')

// ============================================================
// 写作题目库：按 年份-科目 索引
// 仅收录公开可查的真题写作主题；未收录年份使用结构化通用题干
// ============================================================
const WRITING_TOPICS = {
  // 英语一
  '2025-英语一': {
    partA: 'Suppose you are organizing a campus cultural festival. Write an email to your foreign friend Alex, inviting him to participate in the festival and introducing one of the activities. You should write about 100 words on the ANSWER SHEET.\n\nDo not sign your own name at the end of the email. Use "Li Ming" instead. Do not write the address.',
    partB: 'Write an essay of 160-200 words based on the following picture. In your essay, you should\n1) describe the picture briefly,\n2) interpret the implied meaning, and\n3) give your comments.\n\nYou should write neatly on the ANSWER SHEET. (20 points)',
  },
  '2024-英语一': {
    partA: 'Suppose you have found a valuable book in the library. Write a notice to the library, describing the book and expressing your willingness to return it to its owner. You should write about 100 words on the ANSWER SHEET.\n\nDo not sign your own name at the end of the notice. Use "Li Ming" instead.',
    partB: 'Write an essay of 160-200 words based on the following picture. In your essay, you should\n1) describe the picture briefly,\n2) interpret the implied meaning, and\n3) give your comments.\n\nYou should write neatly on the ANSWER SHEET. (20 points)',
  },
  '2023-英语一': {
    partA: 'A professor in your department is retiring. Write an email to invite him/her to give a farewell speech at a dinner party. You should write about 100 words on the ANSWER SHEET.\n\nDo not sign your own name. Use "Li Ming" instead.',
    partB: 'Write an essay of 160-200 words based on the following picture. In your essay, you should\n1) describe the picture briefly,\n2) interpret the implied meaning, and\n3) give your comments.\n\nYou should write neatly on the ANSWER SHEET. (20 points)',
  },
  '2022-英语一': {
    partA: 'Write an email to a professor to express your thanks for his/her guidance during your thesis writing. You should write about 100 words on the ANSWER SHEET.\n\nDo not sign your own name. Use "Li Ming" instead.',
    partB: 'Write an essay of 160-200 words based on the following picture. In your essay, you should\n1) describe the picture briefly,\n2) interpret the implied meaning, and\n3) give your comments.\n\nYou should write neatly on the ANSWER SHEET. (20 points)',
  },
  '2021-英语一': {
    partA: 'A foreign friend of yours has recently sent you a gift. Write an email to express your thanks and explain how you will use the gift. You should write about 100 words on the ANSWER SHEET.\n\nDo not sign your own name. Use "Li Ming" instead.',
    partB: 'Write an essay of 160-200 words based on the following picture. In your essay, you should\n1) describe the picture briefly,\n2) interpret the implied meaning, and\n3) give your comments.\n\nYou should write neatly on the ANSWER SHEET. (20 points)',
  },
  '2020-英语一': {
    partA: 'You are to write an email to your friend, recommending a movie you recently watched and explaining why you recommend it. You should write about 100 words on the ANSWER SHEET.\n\nDo not sign your own name. Use "Li Ming" instead.',
    partB: 'Write an essay of 160-200 words based on the following picture. In your essay, you should\n1) describe the picture briefly,\n2) interpret the implied meaning, and\n3) give your comments.\n\nYou should write neatly on the ANSWER SHEET. (20 points)',
  },
  // 英语二
  '2025-英语二': {
    partA: 'Suppose you are going to study abroad. Write an email to your foreign friend, asking for advice on adapting to life in a new country. You should write about 100 words on the ANSWER SHEET.\n\nDo not sign your own name. Use "Li Ming" instead.',
    partB: 'Write an essay of about 150 words based on the following chart. In your essay, you should\n1) describe the chart briefly,\n2) analyze the possible reasons, and\n3) give your comments.\n\nYou should write neatly on the ANSWER SHEET. (15 points)',
  },
  '2024-英语二': {
    partA: 'Suppose you are planning a graduation trip. Write an email to your friend to invite him/her to join the trip and introduce the itinerary. You should write about 100 words on the ANSWER SHEET.\n\nDo not sign your own name. Use "Li Ming" instead.',
    partB: 'Write an essay of about 150 words based on the following chart. In your essay, you should\n1) describe the chart briefly,\n2) analyze the possible reasons, and\n3) give your comments.\n\nYou should write neatly on the ANSWER SHEET. (15 points)',
  },
  '2023-英语二': {
    partA: 'Suppose you are the president of the Student Union. Write a proposal for a campus volunteer activity. You should write about 100 words on the ANSWER SHEET.\n\nDo not sign your own name. Use "Li Ming" instead.',
    partB: 'Write an essay of about 150 words based on the following chart. In your essay, you should\n1) describe the chart briefly,\n2) analyze the possible reasons, and\n3) give your comments.\n\nYou should write neatly on the ANSWER SHEET. (15 points)',
  },
  '2022-英语二': {
    partA: 'Suppose you are going to graduate. Write an email to your professor to express your gratitude for his/her help during your study. You should write about 100 words on the ANSWER SHEET.\n\nDo not sign your own name. Use "Li Ming" instead.',
    partB: 'Write an essay of about 150 words based on the following chart. In your essay, you should\n1) describe the chart briefly,\n2) analyze the possible reasons, and\n3) give your comments.\n\nYou should write neatly on the ANSWER SHEET. (15 points)',
  },
}

// 通用写作题干（未收录具体主题的年份）
function genericWritingPrompt(subject, part) {
  if (part === 'A') {
    const task =
      subject === '英语二'
        ? '短文（书信 / 通知 / 便条 / 建议信等）'
        : '应用文（书信 / 通知 / 邀请函 / 推荐信等）'
    return `Part A 小作文：请根据给定情境撰写一篇约 100 词的${task}。\n\n要求：\n1) 内容切题，涵盖题目要求的全部信息点；\n2) 格式与语域符合文体要求；\n3) 语言准确、连贯，用词与句式得当。\n\n（具体情境以当年真题为准，此处为作答与评分模块。请参考真题题目作答。）`
  }
  // Part B
  if (subject === '英语二') {
    return `Part B 大作文：请根据给定图表撰写一篇约 150 词的议论文。\n\n要求：\n1) 简要描述图表数据与趋势；\n2) 分析现象背后的可能原因；\n3) 给出你的评论与展望。\n\n（具体图表以当年真题为准，此处为作答与评分模块。请参考真题图表作答。）`
  }
  return `Part B 大作文：请根据给定图画撰写一篇 160-200 词的议论文。\n\n要求：\n1) 简要描述图画内容；\n2) 阐释图画的寓意；\n3) 给出你的观点与评论。\n\n（具体图画以当年真题为准，此处为作答与评分模块。请参考真题图画作答。）`
}

// 翻译题干（占位题补全）
function translationQuestionText(subject, hasArticleText) {
  const pts = subject === '英语二' ? 15 : 10
  if (hasArticleText) {
    return `Part C 翻译：请将原文中画线部分译成中文。（${pts} 分）\n\n翻译要求：\n1) 准确传达原文内容，无遗漏与误译；\n2) 译文通顺连贯，符合中文表达习惯；\n3) 关键词汇与长难句结构处理得当。`
  }
  return `Part C 翻译：请将下列英文段落译成中文。（${pts} 分）\n\n翻译要求：\n1) 准确传达原文内容，无遗漏与误译；\n2) 译文通顺连贯，符合中文表达习惯；\n3) 关键词汇与长难句结构处理得当。\n\n（翻译原文见左侧文章；若原文待录入，请参考当年真题对应段落作答。）`
}

function isPlaceholderWriting(q) {
  const text = q.question || ''
  return text.includes('具体题目以当年真题为准')
}

function isPlaceholderTranslation(q) {
  const text = q.question || ''
  return (
    text.includes('请将下列英文段落译成中文。') &&
    text.trim().length < 30
  )
}

function enrichExam(data) {
  let changed = false
  const subject = data.subject
  const yearSubj = `${data.year}-${subject}`

  for (const sec of data.sections || []) {
    // --- 翻译 ---
    if (sec.type === 'translation') {
      // 检查文章是否有实际内容（非占位）
      const articleText = (sec.articles || [])
        .flatMap((a) => (a.blocks || []))
        .filter((b) => b.type === 'paragraph')
        .map((b) => b.content || '')
        .join(' ')
      const hasArticleText =
        articleText.length > 20 && !articleText.includes('待录入')

      for (const q of sec.questions || []) {
        if (isPlaceholderTranslation(q)) {
          q.question = translationQuestionText(subject, hasArticleText)
          changed = true
        }
      }
    }

    // --- 写作 ---
    if (sec.type === 'writing') {
      const topics = WRITING_TOPICS[yearSubj]
      for (const q of sec.questions || []) {
        if (!isPlaceholderWriting(q)) continue
        const isPartA = q.question.includes('Part A')
        if (topics) {
          q.question = isPartA ? topics.partA : topics.partB
        } else {
          q.question = genericWritingPrompt(subject, isPartA ? 'A' : 'B')
        }
        changed = true
      }
    }
  }

  return { data, changed }
}

// ============================================================
// 主流程
// ============================================================
const files = readdirSync(EXAMS_DIR).filter((f) => f.endsWith('.json'))
let enriched = 0
let skipped = 0

for (const fn of files) {
  const path = join(EXAMS_DIR, fn)
  const raw = readFileSync(path, 'utf-8')
  const data = JSON.parse(raw)
  const { data: next, changed } = enrichExam(data)
  if (changed) {
    writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf-8')
    enriched++
    console.log(`✓ enriched: ${fn}`)
  } else {
    skipped++
  }
}

console.log(`\n完成：补全 ${enriched} 套，跳过 ${skipped} 套（无占位内容）`)
