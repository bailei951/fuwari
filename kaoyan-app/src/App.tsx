import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import PapersPage from './pages/PapersPage'
import PaperPage from './pages/PaperPage'
import VocabPage from './pages/VocabPage'
import HistoryPage from './pages/HistoryPage'
import WrongBookPage from './pages/WrongBookPage'
import TrainingPage from './pages/TrainingPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        {/* 主路由 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/papers" element={<PapersPage />} />
        <Route path="/paper/:paperId" element={<PaperPage />} />
        <Route path="/vocab" element={<VocabPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/wrongbook" element={<WrongBookPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* 兼容旧路径（重定向，避免书签失效） */}
        <Route path="/exams" element={<Navigate to="/papers" replace />} />
        <Route path="/progress" element={<Navigate to="/history" replace />} />

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="max-w-md mx-auto py-20 text-center text-ink-muted">
              <p className="font-serif text-lg">页面不存在</p>
              <p className="text-sm mt-1">返回首页查看真题目录。</p>
            </div>
          }
        />
      </Routes>
    </Layout>
  )
}
