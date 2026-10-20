import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useStore } from '../store/StoreContext.jsx'
import { CATEGORIES, COLLECTION_HUBS } from '../data/catalog.js'
import { aggregate, formatWeight, formatGP } from '../lib/engine.js'

// Hub contribution ranking (shared idea with Diversion Metrics).
function HubRanking({ transactions }) {
  const totals = {}
  for (const t of transactions) {
    if (!t.hubId) continue
    if (!totals[t.hubId]) totals[t.hubId] = { kg: 0, gp: 0 }
    totals[t.hubId].kg += t.totalWeight
    totals[t.hubId].gp += t.tokensAwarded
  }
  const rows = COLLECTION_HUBS.map((h) => ({
    id: h.id,
    name: h.name,
    kg: Math.round(totals[h.id]?.kg || 0),
    gp: Math.round(totals[h.id]?.gp || 0),
  })).sort((a, b) => b.gp - a.gp)
  const medal = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
          <span className="w-6 text-center text-lg">{medal[i] || i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{r.name}</p>
            <p className="text-[11px] text-slate-400">{r.id.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-green-600">{formatGP(r.gp)}</p>
            <p className="text-[11px] text-slate-400">{formatWeight(r.kg)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HubStatView() {
  const { state } = useStore()
  const [hubFilter, setHubFilter] = useState('all')

  const txs = state.opsTransactions
  const filtered = hubFilter === 'all' ? txs : txs.filter((t) => t.hubId === hubFilter)
  const agg = useMemo(() => aggregate(filtered), [filtered])

  // Hub station performance: GP issued + weight (single current period bar).
  const perf = [
    {
      name: 'This month',
      gp: agg.totalTokens,
      kg: Math.round(agg.totalWeight),
    },
  ]

  const materials = agg.byCategory.map((c) => ({
    name: CATEGORIES[c.category]?.label || c.category,
    weight: Math.round(c.weight),
    color: CATEGORIES[c.category]?.color || '#64748b',
  }))

  return (
    <div className="space-y-5">
      {/* Hub station performance */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Hub Station Performance</h3>
            <p className="text-xs text-slate-500">Recycling throughput across registered hubs</p>
          </div>
          <select
            value={hubFilter}
            onChange={(e) => setHubFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="all">All hubs</option>
            {COLLECTION_HUBS.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perf} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="gp" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="kg" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="gp" dataKey="gp" name="Green Points issued" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="kg" dataKey="kg" name="Weight (kg)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recycled material type */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Recycled Material Type</h3>
          <p className="mb-2 text-xs text-slate-500">
            {hubFilter === 'all' ? 'All hubs' : COLLECTION_HUBS.find((h) => h.id === hubFilter)?.name} · per month
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={materials} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v} kg`} />
                <Bar dataKey="weight" radius={[4, 4, 0, 0]}>
                  {materials.map((m) => (
                    <Cell key={m.name} fill={m.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hub contribution ranking */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Hub Contribution Ranking</h3>
          <p className="mb-3 text-xs text-slate-500">Which hub contributes the most recycling (by GP issued)</p>
          <HubRanking transactions={txs} />
        </div>
      </div>
    </div>
  )
}
