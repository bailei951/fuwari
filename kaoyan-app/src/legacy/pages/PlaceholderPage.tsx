// 占位页面：后续 Step 实现

import { Link } from 'react-router-dom'
import { Construction, ArrowLeft } from 'lucide-react'

interface PlaceholderProps {
  title: string
  desc?: string
}

export default function PlaceholderPage({ title, desc }: PlaceholderProps) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center animate-fade-in">
      <div className="inline-flex w-14 h-14 rounded-sm bg-ochre-pale/50 items-center justify-center mb-5">
        <Construction className="w-6 h-6 text-ochre-dark" />
      </div>
      <h1 className="font-serif text-3xl font-bold text-ink mb-2">{title}</h1>
      <p className="text-sm text-ink-muted mb-8">
        {desc ?? '此页面将在后续步骤实现，敬请期待。'}
      </p>
      <Link to="/" className="scholar-tag hover:bg-ochre-pale">
        <ArrowLeft className="w-3 h-3" /> 返回书房
      </Link>
    </div>
  )
}
