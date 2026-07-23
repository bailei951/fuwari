import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 相对路径，同时兼容 GitHub Pages / Cloudflare Pages / Vercel Static
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // 本地开发：/api/* 转发到 Cloudflare Worker（默认 8787）
  // 生产环境由 Cloudflare Pages 配置 routes 或独立 Worker 域名接管
  const workerOrigin = env.VITE_WORKER_ORIGIN || 'http://localhost:8787'

  return {
    plugins: [react()],
    base: './',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    },
    server: {
      proxy: {
        '/api': {
          target: workerOrigin,
          changeOrigin: true,
        },
      },
    },
  }
})
