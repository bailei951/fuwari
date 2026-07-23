// functions/api/dictionary.ts
//
// GET /api/dictionary?word=pretty
//   → 代理 ruseo.cn 单词查询（无需 API Key），用于查词弹窗的兜底查询。
//
// 安全：word 仅允许英文字母与连字符，长度 ≤ 64；8s 超时；上游 JSON 透传。

import { errorJson, fetchWithTimeout, json, type PagesContext } from './_lib'

const DICTIONARY_API = 'https://api.ruseo.cn/api/dictionary'
const WORD_RE = /^[a-zA-Z][a-zA-Z-]*$/

export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  const { request } = ctx
  const url = new URL(request.url)
  const word = (url.searchParams.get('word') ?? '').trim().toLowerCase()

  if (!word) return errorJson('参数 word 必填', 400)
  if (!WORD_RE.test(word)) return errorJson('word 仅允许英文字母和连字符', 400)
  if (word.length > 64) return errorJson('word 过长', 400)

  const upstreamUrl = `${DICTIONARY_API}?word=${encodeURIComponent(word)}`
  const resp = await fetchWithTimeout(upstreamUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!resp.ok) {
    return errorJson(`词典服务异常 (${resp.status})`, 502)
  }

  const text = await resp.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return errorJson('词典返回格式错误', 502)
  }
  return json({ code: 200, msg: 'ok', data }, 200)
}
