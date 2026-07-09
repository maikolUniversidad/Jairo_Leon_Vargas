'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { Network, FileText, Tag, RotateCcw } from 'lucide-react'
import type { KbDocument, KbConcept, KbGraph } from '@/types/database'
import { getKnowledgeGraph } from '@/actions/conocimiento'

// react-force-graph usa canvas del navegador: solo cliente.
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

const COLOR_DOC = '#7c3aed'      // documento (morado)
const COLOR_CONCEPT = '#0891b2'  // concepto (teal)

type Filtro = { mode: 'todo' | 'documento' | 'concepto'; id?: string }

export function KnowledgeGraph({
  documents, concepts,
}: { documents: KbDocument[]; concepts: KbConcept[] }) {
  const [filtro, setFiltro] = useState<Filtro>({ mode: 'todo' })
  const [graph, setGraph] = useState<KbGraph>({ nodes: [], links: [] })
  const [pending, start] = useTransition()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const medir = () => setWidth(el.clientWidth)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cargar = useCallback((f: Filtro) => {
    start(async () => {
      const g = await getKnowledgeGraph(
        f.mode === 'documento' && f.id ? { documentId: f.id }
        : f.mode === 'concepto' && f.id ? { conceptId: f.id }
        : undefined,
      )
      // Clona para que force-graph pueda mutar posiciones sin congelar el estado.
      setGraph({ nodes: g.nodes.map(n => ({ ...n })), links: g.links.map(l => ({ ...l })) })
    })
  }, [])

  useEffect(() => { cargar(filtro) }, [filtro, cargar])

  const vacio = graph.nodes.length === 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, scale: number) => {
    const r = Math.max(3, (node.val ?? 4) * 0.7)
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = node.tipo === 'documento' ? COLOR_DOC : COLOR_CONCEPT
    ctx.fill()
    if (scale > 1.3) {
      const label = String(node.label ?? '')
      ctx.font = `${Math.max(3, 11 / scale)}px sans-serif`
      ctx.fillStyle = '#374151'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label.length > 28 ? label.slice(0, 27) + '…' : label, node.x, node.y + r + 1)
    }
  }, [])

  const conceptosOrden = useMemo(() => [...concepts].sort((a, b) => b.weight - a.weight), [concepts])

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <Network className="h-4 w-4 text-primary" /> Grafo de conocimiento
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={filtro.mode}
            onChange={(e) => setFiltro({ mode: e.target.value as Filtro['mode'] })}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
          >
            <option value="todo">Todo</option>
            <option value="concepto">Por concepto</option>
            <option value="documento">Por documento</option>
          </select>

          {filtro.mode === 'concepto' && (
            <select
              value={filtro.id ?? ''}
              onChange={(e) => setFiltro({ mode: 'concepto', id: e.target.value || undefined })}
              className="max-w-[200px] rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            >
              <option value="">Elige un concepto…</option>
              {conceptosOrden.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.weight})</option>)}
            </select>
          )}
          {filtro.mode === 'documento' && (
            <select
              value={filtro.id ?? ''}
              onChange={(e) => setFiltro({ mode: 'documento', id: e.target.value || undefined })}
              className="max-w-[200px] rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            >
              <option value="">Elige un documento…</option>
              {documents.map(d => <option key={d.id} value={d.id}>{d.titulo}</option>)}
            </select>
          )}
          {filtro.mode !== 'todo' && (
            <button onClick={() => setFiltro({ mode: 'todo' })}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
              <RotateCcw className="h-3 w-3" /> Reiniciar
            </button>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 px-3 py-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_DOC }} /> Documento <FileText className="h-3 w-3" /></span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_CONCEPT }} /> Concepto <Tag className="h-3 w-3" /></span>
        <span className="ml-auto text-gray-400">{graph.nodes.length} nodos · {graph.links.length} relaciones{pending ? ' · cargando…' : ''}</span>
      </div>

      {/* Lienzo */}
      <div ref={wrapRef} className="relative h-[520px] w-full overflow-hidden rounded-b-xl bg-gray-50/50">
        {vacio ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-gray-400">
            <Network className="h-8 w-8 text-gray-300" />
            {pending ? 'Cargando grafo…' : 'Sube documentos para ver sus conceptos y relaciones aquí.'}
          </div>
        ) : (
          <ForceGraph2D
            graphData={graph}
            width={width}
            height={520}
            nodeCanvasObject={drawNode}
            nodePointerAreaPaint={(node: { x?: number; y?: number; val?: number }, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(node.x ?? 0, node.y ?? 0, Math.max(4, (node.val ?? 4) * 0.7) + 2, 0, 2 * Math.PI)
              ctx.fill()
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onNodeClick={(node: any) => {
              if (node.tipo === 'concepto') setFiltro({ mode: 'concepto', id: String(node.id).slice(2) })
              else setFiltro({ mode: 'documento', id: String(node.id).slice(2) })
            }}
            linkColor={() => '#d1d5db'}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            linkWidth={(l: any) => (l.tipo === 'concepto-concepto' ? 0.5 : 1)}
            cooldownTicks={80}
            nodeRelSize={4}
          />
        )}
      </div>
    </div>
  )
}
