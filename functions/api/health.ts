// functions/api/health.ts
//
// GET /api/health → 健康检查，用于部署后验证 Pages Functions 是否生效。
// 返回 {"code":200,"msg":"ok","time":<ms>}

import { json, type PagesContext } from './_lib'

export const onRequestGet = async (_ctx: PagesContext): Promise<Response> => {
  return json({ code: 200, msg: 'ok', time: Date.now() })
}
