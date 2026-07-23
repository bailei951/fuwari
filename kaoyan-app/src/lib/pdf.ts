// 生词本 PDF 导出
// 使用 jsPDF + 嵌入中文字体（SourceHanSans / NotoSansSC 子集）
// 字体通过 fetch 异步加载，避免打包体积过大

import jsPDF from 'jspdf'
import type { VocabItem } from '../types'

// 已加载字体的 base64（首次调用时 fetch，缓存避免重复加载）
let cachedFontBase64: string | null = null

/** Google Fonts 提供的 Noto Sans SC regular woff2，转为 base64 后嵌入 jsPDF */
const FONT_URL =
  'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaa9xwSdKLIW0w.woff2'

/**
 * 把 woff2 字体转为 base64 字符串
 * 注：jsPDF 1.x 仅支持 TTF。woff2 需先解码为 TTF。
 * 为简化实现，使用 jsPDF 的 addFont 接受 base64 + 字体名。
 * 若 woff2 解码失败，会回退到使用浏览器 canvas 渲染方案。
 */
async function loadFontBase64(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64
  try {
    const res = await fetch(FONT_URL)
    const blob = await res.blob()
    const arr = new Uint8Array(await blob.arrayBuffer())
    // 转 base64
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    cachedFontBase64 = btoa(binary)
    return cachedFontBase64
  } catch (err) {
    console.warn('[pdf] 字体加载失败，将使用回退方案：', err)
    return ''
  }
}

export interface PdfExportOptions {
  /** 文档标题 */
  title?: string
  /** 副标题 */
  subtitle?: string
}

/**
 * 导出生词本为 PDF
 * 采用 canvas 渲染方案：用浏览器 canvas 绘制带中文的内容，再截图为 PDF
 * 这种方案对中文支持最稳定，不依赖字体子集
 */
export async function exportVocabToPdf(
  words: VocabItem[],
  options: PdfExportOptions = {},
): Promise<void> {
  const { title = '生词本', subtitle } = options

  if (words.length === 0) {
    throw new Error('生词本为空，无法导出')
  }

  // 使用 canvas 渲染方案：对中文最稳定
  await exportViaCanvas(words, title, subtitle)
}

/**
 * Canvas 渲染方案：
 * 1. 用 canvas 绘制每一页内容（含中文）
 * 2. 转 PNG
 * 3. 插入 jsPDF（每页一张图）
 */
async function exportViaCanvas(
  words: VocabItem[],
  title: string,
  subtitle?: string,
): Promise<void> {
  // 等待中文字体加载（用于 canvas 绘制）
  if ('fonts' in document) {
    try {
      await document.fonts.load('16px "Noto Sans SC"')
      await document.fonts.ready
    } catch {
      /* 忽略，使用系统字体回退 */
    }
  }

  // 页面尺寸（A4 比例，渲染分辨率提高 2 倍）
  const pageWidth = 595 // A4 px @72dpi
  const pageHeight = 842
  const scale = 2 // 高清
  const margin = 40
  const headerHeight = 80

  // 计算每页可容纳的词条数
  const entryHeight = 60 // 每条占 60px（单词行 + 释义行 + 间距）
  const entriesPerPage = Math.floor((pageHeight - headerHeight - margin) / entryHeight)

  // 分页
  const pages: VocabItem[][] = []
  for (let i = 0; i < words.length; i += entriesPerPage) {
    pages.push(words.slice(i, i + entriesPerPage))
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [pageWidth, pageHeight],
    compress: true,
  })

  for (let p = 0; p < pages.length; p++) {
    const canvas = document.createElement('canvas')
    canvas.width = pageWidth * scale
    canvas.height = pageHeight * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 不可用')
    ctx.scale(scale, scale)

    // 背景：纸张色
    ctx.fillStyle = '#faf6ef'
    ctx.fillRect(0, 0, pageWidth, pageHeight)

    // 装饰边框
    ctx.strokeStyle = '#b87333'
    ctx.lineWidth = 1
    ctx.strokeRect(margin - 10, margin - 10, pageWidth - (margin - 10) * 2, pageHeight - (margin - 10) * 2)

    // 标题
    ctx.fillStyle = '#1a1611'
    ctx.font = 'bold 22px "Noto Sans SC", "Microsoft YaHei", serif'
    ctx.textBaseline = 'top'
    ctx.fillText(title, margin, margin)

    // 副标题
    let y = margin + 32
    if (subtitle) {
      ctx.fillStyle = '#6b5d50'
      ctx.font = '12px "Noto Sans SC", "Microsoft YaHei", sans-serif'
      ctx.fillText(subtitle, margin, y)
      y += 20
    } else {
      y = margin + 50
    }

    // 元信息行
    ctx.fillStyle = '#6b5d50'
    ctx.font = '10px "JetBrains Mono", monospace'
    const dateStr = new Date().toLocaleDateString('zh-CN')
    const metaStr = `共 ${words.length} 词 · 第 ${p + 1} / ${pages.length} 页 · ${dateStr} · 真题书房`
    ctx.fillText(metaStr, margin, y)
    y += 24

    // 分隔线
    ctx.strokeStyle = '#e8dfc8'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(margin, y)
    ctx.lineTo(pageWidth - margin, y)
    ctx.stroke()
    y += 12

    // 词条
    ctx.font = '14px "Noto Sans SC", "Microsoft YaHei", sans-serif'
    pages[p].forEach((item, i) => {
      const globalIdx = p * entriesPerPage + i + 1

      // 序号
      ctx.fillStyle = '#b87333'
      ctx.font = 'bold 10px "JetBrains Mono", monospace'
      const idxStr = String(globalIdx).padStart(2, '0')
      ctx.fillText(idxStr, margin, y + 3)

      // 单词
      ctx.fillStyle = '#1a1611'
      ctx.font = 'bold 15px "Noto Sans SC", "Microsoft YaHei", serif'
      ctx.fillText(item.word, margin + 24, y)

      // 音标
      if (item.phonetic) {
        const wordWidth = ctx.measureText(item.word).width
        ctx.fillStyle = '#b87333'
        ctx.font = '10px "JetBrains Mono", monospace'
        ctx.fillText(item.phonetic, margin + 24 + wordWidth + 8, y + 4)
      }

      // 释义
      y += 22
      ctx.fillStyle = '#3d3530'
      ctx.font = '12px "Noto Sans SC", "Microsoft YaHei", sans-serif'
      // 释义换行处理
      const meaningMaxWidth = pageWidth - margin * 2 - 24
      wrapText(ctx, item.meaning, margin + 24, y, meaningMaxWidth, 16)
      const lines = Math.ceil(ctx.measureText(item.meaning).width / meaningMaxWidth)
      y += 16 * Math.max(1, lines) + 12

      // 来源（如果存在）
      if (item.source.paperId) {
        ctx.fillStyle = '#b87333'
        ctx.font = '9px "JetBrains Mono", monospace'
        const [year, subject] = item.source.paperId.split('-')
        const yearStr = parseInt(year)
        const subjectStr =
          subject === 'english1' ? '英语一' : subject === 'english2' ? '英语二' : '统一卷'
        ctx.fillText(`来源: ${yearStr} ${subjectStr}`, margin + 24, y)
      }

      y += 8

      // 分隔线
      if (i < pages[p].length - 1) {
        ctx.strokeStyle = '#f0e8d5'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(margin, y)
        ctx.lineTo(pageWidth - margin, y)
        ctx.stroke()
        y += 6
      }
    })

    // 页脚
    ctx.fillStyle = '#6b5d50'
    ctx.font = '9px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`— ${p + 1} —`, pageWidth / 2, pageHeight - 30)
    ctx.textAlign = 'left'

    // 转为图片并加入 PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    if (p > 0) pdf.addPage([pageWidth, pageHeight], 'portrait')
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight)
  }

  // 下载
  const dateStr = new Date().toISOString().slice(0, 10)
  pdf.save(`vocab-${dateStr}.pdf`)
}

/** canvas 文本换行 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const chars = text.split('')
  let line = ''
  let curY = y
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY)
      line = ch
      curY += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, curY)
}

/**
 * 旧版方案（保留以备未来扩展）：
 * 用 jsPDF 原生 addFont 嵌入 TTF，需要先获取字体 base64
 */
export async function exportVocabToPdfWithFont(
  words: VocabItem[],
  options: PdfExportOptions = {},
): Promise<void> {
  void options
  void words
  const fontBase64 = await loadFontBase64()
  if (!fontBase64) throw new Error('字体加载失败')
  // 实现略，使用 jsPDF.addFileToVFS + addFont
  // 当前默认调用 exportVocabToPdf（canvas 方案）
}
