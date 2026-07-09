'use client'

import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { ChartSpec } from '@/lib/ia/types'

// Paleta categórica liderada por el morado de marca.
const PALETA = ['#7c3aed', '#0891b2', '#f59e0b', '#db2777', '#16a34a', '#2563eb', '#e11d48', '#9333ea']

function fmt(v: unknown, unidad?: string) {
  if (typeof v === 'number') {
    const n = new Intl.NumberFormat('es-CO').format(v)
    return unidad === 'COP' ? `$${n}` : unidad ? `${n} ${unidad}` : n
  }
  return String(v ?? '')
}

export function ChartRenderer({ spec }: { spec: ChartSpec }) {
  const series = spec.series ?? []
  const xKey = spec.xKey ?? Object.keys(spec.data[0] ?? {})[0] ?? 'name'

  return (
    <figure className="not-prose my-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      {spec.title && (
        <figcaption className="mb-3 text-sm font-semibold text-gray-800">{spec.title}</figcaption>
      )}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === 'pie' ? (
            <PieChart>
              <Tooltip formatter={(v) => fmt(v, spec.unidad)} />
              <Pie
                data={spec.data}
                dataKey={spec.valueKey ?? 'value'}
                nameKey={spec.nameKey ?? 'name'}
                cx="50%" cy="50%"
                outerRadius={90}
                label={(e: { name?: string }) => e.name ?? ''}
              >
                {spec.data.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
              </Pie>
              <Legend />
            </PieChart>
          ) : spec.type === 'line' ? (
            <LineChart data={spec.data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip formatter={(v) => fmt(v, spec.unidad)} />
              <Legend />
              {series.map((s, i) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key}
                  stroke={s.color ?? PALETA[i % PALETA.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          ) : spec.type === 'area' ? (
            <AreaChart data={spec.data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip formatter={(v) => fmt(v, spec.unidad)} />
              <Legend />
              {series.map((s, i) => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key}
                  stroke={s.color ?? PALETA[i % PALETA.length]}
                  fill={s.color ?? PALETA[i % PALETA.length]} fillOpacity={0.15} strokeWidth={2} />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={spec.data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip formatter={(v) => fmt(v, spec.unidad)} />
              <Legend />
              {(series.length ? series : [{ key: spec.valueKey ?? 'value', name: 'Valor' }]).map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key}
                  fill={('color' in s && s.color) ? s.color : PALETA[i % PALETA.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
