'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Upload, FileText, Trash2, Loader2, Database, Layers, Tag, Sparkles, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { StatCard, EmptyState } from '@/components/dashboard/shared'
import { formatDate } from '@/lib/utils'
import type { KbDocument, KbConcept } from '@/types/database'
import { deleteKbDocument } from '@/actions/conocimiento'
import { KnowledgeGraph } from './KnowledgeGraph'

interface Props {
  documents: KbDocument[]
  concepts: KbConcept[]
  stats: { documentos: number; chunks: number; conceptos: number; embeddings: boolean }
}

const ACCEPT = '.pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function ConocimientoManager({ documents, concepts, stats }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [cola, setCola] = useState<{ name: string; estado: 'subiendo' | 'ok' | 'error'; msg?: string }[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function subir(files: File[]) {
    if (files.length === 0) return
    setSubiendo(true)
    setCola(files.map(f => ({ name: f.name, estado: 'subiendo' as const })))
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/kb/ingest', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al procesar')
        setCola(prev => prev.map((c, j) => j === i ? { ...c, estado: 'ok', msg: `${data.chunks} fragmentos · ${data.conceptos} conceptos` } : c))
      } catch (err) {
        setCola(prev => prev.map((c, j) => j === i ? { ...c, estado: 'error', msg: err instanceof Error ? err.message : 'Error' } : c))
      }
    }
    setSubiendo(false)
    router.refresh()
  }

  function pick(list: FileList | null) {
    if (!list) return
    subir(Array.from(list))
  }

  async function eliminar(doc: KbDocument) {
    if (!window.confirm(`¿Eliminar "${doc.titulo}" de la base de conocimiento? Se borran sus fragmentos y vectores.`)) return
    const res = await deleteKbDocument(doc.id)
    if (res.ok) { toast.success(res.message); router.refresh() }
    else toast.error(res.message)
  }

  return (
    <div className="space-y-6">
      {!stats.embeddings && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>Configura <code>OPENAI_API_KEY</code> para generar los vectores (embeddings). Sin ella, los documentos se guardan pero el chat no podrá buscarlos.</span>
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Documentos" value={stats.documentos} icon={FileText} tone="primary" />
        <StatCard label="Fragmentos (chunks)" value={stats.chunks} icon={Layers} />
        <StatCard label="Conceptos" value={stats.conceptos} icon={Tag} />
        <StatCard label="Embeddings" value={stats.embeddings ? 'Activos' : 'Sin llave'} icon={Sparkles} tone={stats.embeddings ? 'success' : 'warning'} />
      </div>

      {/* Subida */}
      <Card>
        <CardContent className="p-5">
          <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden"
            onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
          <div
            onClick={() => !subiendo && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files) }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50 hover:bg-muted/50'
            }`}
          >
            {subiendo ? <Loader2 className="size-8 animate-spin text-primary" /> : <Upload className="size-8 text-muted-foreground" />}
            <p className="text-sm font-medium">{subiendo ? 'Procesando…' : 'Arrastra archivos o haz clic para subir'}</p>
            <p className="text-xs text-muted-foreground">PDF, Word (.docx), Excel, CSV, TXT, Markdown o JSON · hasta 8 MB c/u</p>
          </div>

          {cola.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {cola.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {c.estado === 'subiendo' ? <Loader2 className="size-4 animate-spin text-primary" />
                    : c.estado === 'ok' ? <CheckCircle2 className="size-4 text-emerald-600" />
                    : <AlertCircle className="size-4 text-red-500" />}
                  <span className="truncate font-medium">{c.name}</span>
                  {c.msg && <span className="truncate text-xs text-muted-foreground">— {c.msg}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de documentos */}
      {documents.length === 0 ? (
        <EmptyState icon={Database} title="Base de conocimiento vacía"
          description="Sube documentos para convertirlos en vectores y que el Asistente IA los use como fuente." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Documento</th>
                    <th className="px-4 py-2.5 font-medium">Tipo</th>
                    <th className="px-4 py-2.5 font-medium">Estado</th>
                    <th className="px-4 py-2.5 font-medium">Fragmentos</th>
                    <th className="px-4 py-2.5 font-medium">Tamaño</th>
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {documents.map(d => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="max-w-[280px] px-4 py-2.5">
                        <p className="truncate font-medium">{d.titulo}</p>
                        {d.resumen && <p className="truncate text-xs text-muted-foreground">{d.resumen}</p>}
                      </td>
                      <td className="px-4 py-2.5"><Badge variant="muted">{d.tipo ?? '—'}</Badge></td>
                      <td className="px-4 py-2.5"><EstadoBadge doc={d} /></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{d.chunks_count}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatBytes(d.bytes)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(d.created_at)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="ghost" size="icon" onClick={() => eliminar(d)}><Trash2 className="size-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grafo */}
      <KnowledgeGraph documents={documents} concepts={concepts} />
    </div>
  )
}

function EstadoBadge({ doc }: { doc: KbDocument }) {
  if (doc.estado === 'listo') return <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="size-3.5" /> Listo</span>
  if (doc.estado === 'procesando') return <span className="inline-flex items-center gap-1 text-xs text-amber-700"><Clock className="size-3.5" /> Procesando</span>
  return <span className="inline-flex items-center gap-1 text-xs text-red-600" title={doc.error ?? ''}><AlertCircle className="size-3.5" /> Error</span>
}
