// functions/api/_middleware.ts
//
// 对所有 /api/* 路由生效的中间件：
//   1. 处理 CORS 预检（OPTIONS）→ 204
//   2. 频率限制（10 req/min/IP）→ 429
//   3. 把 CORS 头注入下游响应（含错误响应）
//
// 同源部署（giraak.space 前端调 giraak.space/api）下浏览器不强制 CORS，
// 但保留以兼容预览域名与未来跨域场景。

import {
  corsHeaders,
  checkRateLimit,
  getClientIP,
  errorJson,
  RATE_LIMIT_MAX,
  type PagesContext,
} from './_lib'

export const onRequest = async (ctx: PagesContext): Promise<Response> => {
  const { request, env, next } = ctx

  // 1. CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env, request) })
  }

  // 2. 频率限制
  const ip = getClientIP(request)
  if (!checkRateLimit(ip)) {
    return errorJson(`请求过于频繁（上限 ${RATE_LIMIT_MAX} 次/分钟）`, 429)
  }

  // 3. 下游处理
  const response = await next()

  // 注入 CORS 头（不覆盖已有 Content-Type 等）
  const cors = corsHeaders(env, request)
  const newHeaders = new Headers(response.headers)
  for (const [k, v] of Object.entries(cors)) {
    if (v) newHeaders.set(k, v)
  }
  return new Response(response.body, { status: response.status, headers: newHeaders })
}
