// functions/api/translate.ts
//
// POST /api/translate  body: { text, from?, to? }
//   → 多源容错翻译代理（服务端无 CORS 限制，可调用任意 API）
//
// 翻译源优先级（任一成功即返回）：
//   1. apihz.cn    —— 自有 API Key（env.APIHZ_ID / env.APIHZ_KEY），质量稳定
//   2. uapis.cn    —— 免费免 Key，中英互译，无需配置
//   3. Google gtx  —— 免费免 Key，translate.googleapis.com 兜底
//
// 语种：1=英语 2=简体中文。自动识别：含汉字→中→英，否则英→中。
// 限制：text ≤ 5000 字符；每源 8s 超时。

import { errorJson, fetchWithTimeout, json, type PagesContext, type Env } from './_lib'

// ============================================================
// 类型定义
// ============================================================

interface TranslateRequest {
  text: string
  /** 1=英语 2=简体中文，默认自动识别 */
  from?: number
  /** 目标语种编号，默认 2（简体中文） */
  to?: number
}

/** 统一返回格式 */
interface TranslateResult {
  code: number
  msg: string
  from: number
  to: number
  text: string
  translation: string
  source: string
}

// ============================================================
// 语种工具
// ============================================================

function isChineseText(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text)
}

/** 语种编号 → Google 语种代码 */
function toGoogleLang(code: number): string {
  return code === 2 ? 'zh-CN' : 'en'
}

// ============================================================
// 翻译源 1：apihz.cn（需 API Key）
// ============================================================

const APIHZ_API = 'https://cn.apihz.cn/api/zici/fanyiapihz.php'

interface ApihzResponse {
  code: number
  msg?: string
  words?: string
}

async function callApihz(text: string, from: number, to: number, env: Env): Promise<string> {
  if (!env.APIHZ_ID || !env.APIHZ_KEY) {
    throw new Error('apihz 未配置 API Key')
  }
  const params = new URLSearchParams({
    id: env.APIHZ_ID,
    key: env.APIHZ_KEY,
    words: text,
    ytype: String(from),
    etype: String(to),
    htype: '1',
  })
  const resp = await fetchWithTimeout(`${APIHZ_API}?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!resp.ok) throw new Error(`apihz 异常 (${resp.status})`)
  const data = (await resp.json()) as ApihzResponse
  if (data.code !== 200) throw new Error(data.msg ?? 'apihz 翻译失败')
  return data.words ?? ''
}

// ============================================================
// 翻译源 2：uapis.cn（免费免 Key）
// ============================================================

const UAPIS_API = 'https://uapis.cn/api/v1/translate/text'

interface UapisResponse {
  text?: string
  translate?: string
  code?: number
  msg?: string
}

async function callUapis(text: string, to: number): Promise<string> {
  const toLang = to === 2 ? 'zh' : 'en'
  const resp = await fetchWithTimeout(UAPIS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_lang: toLang, text }),
  })
  if (!resp.ok) throw new Error(`uapis 异常 (${resp.status})`)
  const data = (await resp.json()) as UapisResponse
  if (!data.translate) throw new Error(data.msg ?? 'uapis 翻译失败')
  return data.translate
}

// ============================================================
// 翻译源 3：Google Translate gtx（免费免 Key，服务端调用）
// ============================================================

async function callGoogleGtx(text: string, from: number, to: number): Promise<string> {
  const sl = from === 2 ? 'zh-CN' : 'en'
  const tl = toGoogleLang(to)
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`
  const resp = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; KaoyanApp/1.0)',
    },
  })
  if (!resp.ok) throw new Error(`Google gtx 异常 (${resp.status})`)
  // Google 返回嵌套数组：[[["译文","原文",null,null,1],...],...]
  const data = (await resp.json()) as unknown
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Google gtx 响应格式异常')
  }
  // 拼接所有翻译片段
  const segments = (data[0] as unknown[][])
    .filter((seg) => Array.isArray(seg) && typeof seg[0] === 'string')
    .map((seg) => seg[0] as string)
  const translation = segments.join('')
  if (!translation) throw new Error('Google gtx 返回空译文')
  return translation
}

// ============================================================
// 主处理：多源容错
// ============================================================

export const onRequestPost = async (ctx: PagesContext<Env>): Promise<Response> => {
  const { request, env } = ctx

  let body: TranslateRequest
  try {
    body = (await request.json()) as TranslateRequest
  } catch {
    return errorJson('请求体需为 JSON', 400)
  }

  const text = (body.text ?? '').trim()
  if (!text) return errorJson('参数 text 必填', 400)
  if (text.length > 5000) return errorJson('text 不得超过 5000 字符', 400)

  // 语种识别
  const isChinese = isChineseText(text)
  const from = body.from ?? (isChinese ? 2 : 1)
  const to = body.to ?? (isChinese ? 1 : 2)
  if (from === to) return errorJson('源语种与目标语种相同', 400)

  // 多源尝试：apihz → uapis → Google gtx
  const sources: Array<{ name: string; fn: () => Promise<string> }> = [
    { name: 'apihz', fn: () => callApihz(text, from, to, env) },
    { name: 'uapis', fn: () => callUapis(text, to) },
    { name: 'google', fn: () => callGoogleGtx(text, from, to) },
  ]

  const errors: string[] = []
  for (const src of sources) {
    try {
      const translation = await src.fn()
      if (translation) {
        const result: TranslateResult = {
          code: 200,
          msg: 'ok',
          from,
          to,
          text,
          translation,
          source: src.name,
        }
        return json(result, 200)
      }
    } catch (e) {
      errors.push(`${src.name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return errorJson(`翻译失败（已尝试 ${sources.length} 源）：${errors.join('；')}`, 502)
}
