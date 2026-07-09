'use client'

import { Fragment, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChartSpec } from '@/lib/ia/types'
import { ChartRenderer } from './ChartRenderer'

// Estilos de cada elemento (sin plugin de typography).
const COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="mb-2 mt-3 text-lg font-bold text-gray-900">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-bold text-gray-900">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-2 text-sm font-semibold text-gray-900">{children}</h3>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{children}</a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-gray-600 italic">{children}</blockquote>
  ),
  code: ({ className, children }) => {
    const inline = !className
    return inline ? (
      <code className="rounded bg-gray-100 px-1 py-0.5 text-[0.85em] text-primary">{children}</code>
    ) : (
      <code className={className}>{children}</code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  th: ({ children }) => <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-700">{children}</th>,
  td: ({ children }) => <td className="border border-gray-200 px-2 py-1 text-gray-600">{children}</td>,
}

// Separa bloques ```chart {json} del resto del markdown.
const CHART_RE = /```chart\s*\n([\s\S]*?)```/g

function splitCharts(text: string): { type: 'md' | 'chart'; value: string }[] {
  const out: { type: 'md' | 'chart'; value: string }[] = []
  let last = 0
  let m: RegExpExecArray | null
  CHART_RE.lastIndex = 0
  while ((m = CHART_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'md', value: text.slice(last, m.index) })
    out.push({ type: 'chart', value: (m[1] ?? '').trim() })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'md', value: text.slice(last) })
  return out
}

export function Markdown({ children }: { children: string }) {
  const partes = splitCharts(children ?? '')
  return (
    <div className="text-sm text-gray-700">
      {partes.map((p, i) => {
        if (p.type === 'chart') {
          let spec: ChartSpec | null = null
          try { spec = JSON.parse(p.value) as ChartSpec } catch { spec = null }
          if (spec && Array.isArray(spec.data) && spec.data.length) {
            return <ChartRenderer key={i} spec={spec} />
          }
          return null // JSON de gráfica incompleto (durante el streaming): se omite
        }
        if (!p.value.trim()) return <Fragment key={i} />
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={COMPONENTS}>
            {p.value}
          </ReactMarkdown>
        )
      }) as ReactNode}
    </div>
  )
}
