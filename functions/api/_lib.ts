// functions/api/_lib.ts
//
// 考研英语刷题网站的 API 代理共享工具（Cloudflare Pages Functions）。
// 文件名以 _ 开头 → Pages 不会把它当作路由，仅作为模块被引入。
//
// 移植自 zip 中 worker/src/index.ts 的安全逻辑：
//   - 频率限制：内存 Map，10 req/min/IP（isolate 级，足够防滥用）
//   - CORS：ALLOWED_ORIGINS 白名单（同源部署时浏览器不强制 CORS，保留以兼容预览域/跨域）
//   - 超时：AbortController 8s
//   - 错误不向前端泄露内部细节

export interface Env {
  /** DeepL API Key（含 :fx 后缀为 Free 版，自动选用 api-free 端点） */
  DEEPL_API_KEY?: string
  /** apihz.cn 开发者 ID（数字字符串） */
  APIHZ_ID: string
  /** apihz.cn 通讯秘钥 */
  APIHZ_KEY: string
  /** 允许的 Origin，逗号分隔，如 https://giraak.space,http://localhost:5173 */
  ALLOWED_ORIGINS?: string
}

/** Pages Function 上下文（最小可用类型，避免强依赖 @cloudflare/workers-types） */
export interface PagesContext<E = Env> {
  request: Request
  env: E
  params: Record<string, string>
  next: () => Promise<Response>
}

// ============================================================
// 频率限制
// ============================================================
export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX = 10
const ipHits = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipHits.get(ip)
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count += 1
  return true
}

export function getClientIP(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Real-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

// ============================================================
// CORS
// ============================================================
export function getAllowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = getAllowedOrigins(env)
  // 未配置时允许所有（开发环境）；配置后仅白名单内 Origin 放行
  const allowOrigin = allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

// ============================================================
// 响应工具
// ============================================================
export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  })
}

export function errorJson(message: string, status: number, extra: Record<string, string> = {}): Response {
  return json({ code: status, msg: message }, status, extra)
}

// ============================================================
// 上游 fetch 带超时
// ============================================================
export async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs = 8000,
): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}
