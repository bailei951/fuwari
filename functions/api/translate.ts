// functions/api/translate.ts
//
// POST /api/translate  body: { text, from?, to? }
//   → 代理 apihz.cn 翻译（用 env.APIHZ_ID / env.APIHZ_KEY，前端不接触密钥）
//
// 语种：1=英语 2=简体中文。自动识别：含汉字→中→英，否则英→中。
// 限制：text ≤ 5000 字符；8s 超时；上游 htype=1 使用缓存加速。

import { errorJson, fetchWithTimeout, json, type PagesContext, type Env } from './_lib'

const TRANSLATE_API = 'https://cn.apihz.cn/api/zici/fanyiapihz.php'

interface TranslateRequest {
  text: string
  /** 1=英语 2=简体中文，默认自动识别 */
  from?: number
  /** 目标语种编号，默认 2（简体中文） */
  to?: number
}

interface ApihzResponse {
  code: number
  msg?: string
  words?: string
}

export const onRequestPost = async (ctx: PagesContext<Env>): Promise<Response> => {
  const { request, env } = ctx

  if (!env.APIHZ_ID || !env.APIHZ_KEY) {
    return errorJson('服务端未配置 API Key', 500)
  }

  let body: TranslateRequest
  try {
    body = (await request.json()) as TranslateRequest
  } catch {
    return errorJson('请求体需为 JSON', 400)
  }

  const text = (body.text ?? '').trim()
  if (!text) return errorJson('参数 text 必填', 400)
  if (text.length > 5000) return errorJson('text 不得超过 5000 字符', 400)

  // 语种识别：含汉字→中文→英语；否则英语→中文
  const isChinese = /[\u4e00-\u9fa5]/.test(text)
  const from = body.from ?? (isChinese ? 2 : 1)
  const to = body.to ?? (isChinese ? 1 : 2)

  if (from === to) return errorJson('源语种与目标语种相同', 400)

  const params = new URLSearchParams({
    id: env.APIHZ_ID,
    key: env.APIHZ_KEY,
    words: text,
    ytype: String(from),
    etype: String(to),
    htype: '1', // 使用缓存
  })

  const resp = await fetchWithTimeout(`${TRANSLATE_API}?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!resp.ok) {
    return errorJson(`翻译服务异常 (${resp.status})`, 502)
  }

  const data = (await resp.json()) as ApihzResponse
  if (data.code !== 200) {
    return errorJson(data.msg ?? '翻译失败', 502)
  }

  return json(
    {
      code: 200,
      msg: 'ok',
      from,
      to,
      text,
      translation: data.words ?? '',
    },
    200,
  )
}
