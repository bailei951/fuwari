import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ProgressProvider } from './context/ProgressContext'
import { VocabProvider } from './context/VocabContext'
import { RecentProvider } from './context/RecentContext'
import { AnnotationProvider } from './context/AnnotationContext'
import { initTheme } from './hooks/useTheme'
import './index.css'

// 在应用挂载前同步主题，避免首屏闪烁
initTheme()

// 使用 HashRouter：嵌入 fuwari 的 /tools/kaoyan/ 子目录后，
// 路由变为 #/papers、#/paper/:id，任何静态托管下刷新/直开子路径均正常，
// 且与 Astro/swup 的页面路由完全隔离，零服务端配置。
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ProgressProvider>
        <VocabProvider>
          <RecentProvider>
            <AnnotationProvider>
              <App />
            </AnnotationProvider>
          </RecentProvider>
        </VocabProvider>
      </ProgressProvider>
    </HashRouter>
  </React.StrictMode>,
)
