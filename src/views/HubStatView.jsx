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

// Deterministic per-hub share of the township total. Shares are DERIVED from the
// current hub count (not a fixed 4-element array) and always normalised to sum
// to 1, so the numbers stay in sync no matter how many hubs are registered. A
// fixed sine seed per index keeps each hub's share stable across renders.
function hubWeights(count) {
  if (count <= 0) return []
  const raw = Array.from({ length: count }, (_, i) => {
    const s = Math.sin((i + 1) * 12.9898) * 43758.5453
    return 0.6 + (((s % 1) + 1) % 1) * 0.8 // 0.6..1.4 spread
  })
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map((r) => r / sum) // normalised, sums to 1
}

export default function HubStatView() {
  const { state } = useStore()
  const hubs = state.registeredHubs || []
  const [hubCode, setHubCode] = useState('all')
  const [gran, setGran] = useState('month') // day | month | year
  const now = new Date()
  const nowMonth = now.getMonth()
  const nowYear = now.getFullYear()
  const nowDay = now.getDate()
  const [monthIdx, setMonthIdx] = useState(nowMonth)
  const [year] = useState(nowYear)

  const agg = useMemo(() => aggregate(state.opsTransactions), [state.opsTransactions])
  const baseKg = agg.totalWeight || 10905 // monthly township weight
  const baseGP = agg.totalTokens || 75860

  // Normalised per-hub shares, derived from the live hub count (stays in sync).
  const weights = useMemo(() => hubWeights(hubs.length), [hubs.length])
  const hubShareKg = (i, total) => total * (weights[i] ?? 0)

  // Scale factor for the selected hub (all hubs = 1).
  const hubIdx = hubs.findIndex((h) => h.code === hubCode)
  const hubFactor = hubCode === 'all' ? 1 : (weights[hubIdx] ?? 0)

  // Per-period chart data. Buckets strictly AFTER today are empty (kg = null) —
  // the chart never fabricates future recycling that hasn't happened yet.
  const chart = useMemo(() => {
    const season = MALAYSIA_SEASONALITY
    const wob = (n) => 0.9 + ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.2
    if (gran === 'day') {
      const days = new Date(year, monthIdx + 1, 0).getDate()
      const perDay = (baseKg * (season[monthIdx] / season[nowMonth]) * hubFactor) / days
      const monthInFuture = year > nowYear || (year === nowYear && monthIdx > nowMonth)
      const monthInPast = year < nowYear || (year === nowYear && monthIdx < nowMonth)
      return Array.from({ length: days }, (_, d) => {
        const day = d + 1
        // Future days (this month, after today; or any future month) are empty.
        const future = monthInFuture || (year === nowYear && monthIdx === nowMonth && day > nowDay)
        return {
          label: String(day),
          kg: future ? null : Math.round(perDay * wob(day + monthIdx * 31)),
        }
      })
    }
    if (gran === 'year') {
      const g = 1 + 0.08
      return [year - 2, year - 1, year].map((y, k) => {
        // Current year is year-to-date: only the months elapsed so far.
        const monthsElapsed = y < nowYear ? 12 : y === nowYear ? nowMonth + nowDay / 31 : 0
        return {
          label: String(y),
          kg: y > nowYear ? null : Math.round(baseKg * monthsElapsed * hubFactor * g ** (k - 2)),
        }
      })
    }
    // month: 12 months of the selected year; future months (and the remainder
    // of the current month) are empty.
    return MONTHS.map((m, i) => {
      const future = year > nowYear || (year === nowYear && i > nowMonth)
      const partial = year === nowYear && i === nowMonth ? nowDay / new Date(year, i + 1, 0).getDate() : 1
      return {
        label: m,
        kg: future ? null : Math.round(baseKg * (season[i] / season[nowMonth]) * hubFactor * partial),
      }
    })
  }, [gran, monthIdx, year, baseKg, hubFactor, nowMonth, nowYear, nowDay])

  const periodKg = chart.reduce((s, r) => s + (r.kg || 0), 0)
  const periodItems = Math.round(periodKg / 0.0386) // avg item weight ~38.6g
  const periodGP = Math.round(baseGP * (periodKg / (baseKg || 1)))

  // Top hub (by share).
  const topHub = hubs.reduce((top, h, i) => {
    const kg = hubShareKg(i, baseKg)
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
    .map((h, i) => ({ ...h, kg: Math.round(hubShareKg(i, periodKg || baseKg)) }))
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
