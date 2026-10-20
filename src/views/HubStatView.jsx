import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useStore } from '../store/StoreContext.jsx'
import { CATEGORIES, ITEM_CATALOG, MALAYSIA_SEASONALITY } from '../data/catalog.js'
import { aggregate, formatWeight, formatGP } from '../lib/engine.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Deterministic per-hub weight: split the township total across hubs by a fixed
// share, so each hub has a stable, believable contribution.
function hubShare(code, i, total) {
  const shares = [0.274, 0.216, 0.343, 0.167] // sums ~1 for the 4 base hubs
  const s = shares[i] ?? (0.1 + ((i * 37) % 20) / 100)
  return total * s
}

export default function HubStatView() {
  const { state } = useStore()
  const hubs = state.registeredHubs || []
  const [hubCode, setHubCode] = useState('all')
  const [gran, setGran] = useState('month') // day | month | year
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth())
  const [year] = useState(new Date().getFullYear())

  const agg = useMemo(() => aggregate(state.opsTransactions), [state.opsTransactions])
  const baseKg = agg.totalWeight || 10905 // monthly township weight
  const baseGP = agg.totalTokens || 75860

  // Scale factor for the selected hub (all hubs = 1).
  const hubIdx = hubs.findIndex((h) => h.code === hubCode)
  const hubFactor = hubCode === 'all' ? 1 : (hubShare(hubCode, hubIdx, baseKg) / (baseKg || 1))

  // Per-period chart data.
  const chart = useMemo(() => {
    const season = MALAYSIA_SEASONALITY
    const wob = (n) => 0.9 + ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.2
    if (gran === 'day') {
      const days = new Date(year, monthIdx + 1, 0).getDate()
      const perDay = (baseKg * (season[monthIdx] / season[new Date().getMonth()]) * hubFactor) / days
      return Array.from({ length: days }, (_, d) => ({
        label: String(d + 1),
        kg: Math.round(perDay * wob(d + monthIdx * 31)),
      }))
    }
    if (gran === 'year') {
      const g = 1.08
      return [year - 2, year - 1, year, year + 1].map((y, k) => ({
        label: String(y),
        kg: Math.round(baseKg * 12 * hubFactor * g ** (k - 2)),
      }))
    }
    // month: 12 months of the year
    return MONTHS.map((m, i) => ({
      label: m,
      kg: Math.round(baseKg * (season[i] / season[new Date().getMonth()]) * hubFactor),
    }))
  }, [gran, monthIdx, year, baseKg, hubFactor])

  const periodKg = chart.reduce((s, r) => s + r.kg, 0)
  const periodItems = Math.round(periodKg / 0.0386) // avg item weight ~38.6g
  const periodGP = Math.round(baseGP * (periodKg / (baseKg || 1)))

  // Top hub (by share).
  const topHub = hubs.reduce((top, h, i) => {
    const kg = hubShare(h.code, i, baseKg)
    return kg > (top?.kg ?? -1) ? { ...h, kg } : top
  }, null)

  // Recycled by item type (scaled to the period).
  const materials = agg.byCategory.map((c) => ({
    name: CATEGORIES[c.category]?.label || c.category,
    weight: Math.round(c.weight * hubFactor * (gran === 'year' ? 12 : 1)),
    color: CATEGORIES[c.category]?.color || '#64748b',
  }))

  // Hub ranking (all hubs, this period).
  const ranking = hubs
    .map((h, i) => ({ ...h, kg: Math.round(hubShare(h.code, i, periodKg || baseKg)) }))
    .sort((a, b) => b.kg - a.kg)
  const rankTotal = ranking.reduce((s, r) => s + r.kg, 0) || 1
  const medal = ['🥇', '🥈', '🥉']

  const fmtKg = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} t` : `${v} kg`)

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <select
          value={hubCode}
          onChange={(e) => setHubCode(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="all">All hubs</option>
          {hubs.map((h) => (
            <option key={h.code} value={h.code}>{h.name}</option>
          ))}
        </select>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
          {['day', 'month', 'year'].map((g) => (
            <button key={g} onClick={() => setGran(g)}
              className={`rounded-md px-3 py-1.5 capitalize transition ${gran === g ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'}`}>
              {g}
            </button>
          ))}
        </div>
        {gran === 'day' && (
          <select value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m} {year}</option>)}
          </select>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Recycled" value={fmtKg(periodKg)} sub={hubCode === 'all' ? 'all hubs' : hubs[hubIdx]?.name} accent="text-green-600" />
        <Kpi label="Items" value={periodItems.toLocaleString()} />
        <Kpi label="GP Awarded" value={periodGP.toLocaleString()} accent="text-green-600" />
        <Kpi label="Top Hub" value={topHub?.code || '—'} sub={topHub?.name} />
      </div>

      {/* Station performance */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Station performance</h3>
        <p className="mb-2 text-xs text-slate-500">
          {hubCode === 'all' ? 'All hubs' : hubs[hubIdx]?.name} · kg recycled per {gran}
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={gran === 'day' ? 2 : 0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}t` : v)} />
              <Tooltip formatter={(v) => fmtKg(v)} />
              <Bar dataKey="kg" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recycled by item type */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Recycled by item type</h3>
          <p className="mb-2 text-xs text-slate-500">{hubCode === 'all' ? 'All hubs' : hubs[hubIdx]?.name} · kg</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={materials} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtKg(v)} />
                <Bar dataKey="weight" radius={[4, 4, 0, 0]}>
                  {materials.map((m) => <Cell key={m.name} fill={m.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hub ranking */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Hub ranking</h3>
          <p className="mb-3 text-xs text-slate-500">Contribution to recycling in this period (all hubs)</p>
          <div className="space-y-3">
            {ranking.map((r, i) => (
              <div key={r.code}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span>{medal[i] || i + 1}</span>
                    <span className="font-medium text-slate-800">{r.name}</span>
                    <span className="font-mono text-[11px] text-slate-400">{r.code}</span>
                  </span>
                  <span className="tabular-nums text-slate-600">
                    {fmtKg(r.kg)} · {Math.round((r.kg / rankTotal) * 100)}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                    style={{ width: `${(r.kg / (ranking[0]?.kg || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, accent = 'text-slate-900' }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
