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
import { CATEGORIES, MALAYSIA_SEASONALITY, DISPATCH_CONFIG } from '../data/catalog.js'
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

// Earliest year the simulation has data for (operations started in 2024).
const MIN_YEAR = 2024

export default function HubStatView() {
  const { state } = useStore()
  const hubs = state.registeredHubs || []
  const [hubCode, setHubCode] = useState('all')
  const [gran, setGran] = useState('month') // day | month | year
  const now = new Date()
  const nowMonth = now.getMonth()
  const nowYear = now.getFullYear()
  const nowDay = now.getDate()
  const nowHour = now.getHours()
  // Selected date components (day view uses all three; month view uses
  // year+month; year view uses year only).
  const [selYear, setSelYear] = useState(nowYear)
  const [monthIdx, setMonthIdx] = useState(nowMonth)
  const [dayNum, setDayNum] = useState(nowDay)

  // Selectable year range: 2024 .. current year.
  const years = useMemo(() => {
    const arr = []
    for (let y = MIN_YEAR; y <= nowYear; y++) arr.push(y)
    return arr
  }, [nowYear])

  // Clamp the chosen day to the number of days in the selected month/year.
  const daysInSelMonth = new Date(selYear, monthIdx + 1, 0).getDate()
  const selDay = Math.min(dayNum, daysInSelMonth)

  const agg = useMemo(() => aggregate(state.opsTransactions), [state.opsTransactions])
  const baseKg = agg.totalWeight || 10905 // CURRENT monthly township weight (now)
  const baseGP = agg.totalTokens || 75860

  // Normalised per-hub shares, derived from the live hub count (stays in sync).
  const weights = useMemo(() => hubWeights(hubs.length), [hubs.length])
  const hubShareKg = (i, total) => total * (weights[i] ?? 0)

  // Scale factor for the selected hub (all hubs = 1).
  const hubIdx = hubs.findIndex((h) => h.code === hubCode)
  const hubFactor = hubCode === 'all' ? 1 : (weights[hubIdx] ?? 0)

  // Deterministic ±10% wobble so bars look organic but stable across renders.
  const wob = (n) => 0.9 + (((Math.sin(n * 12.9898) * 43758.5453) % 1) + 1) % 1 * 0.2
  // Growth trend: volume compounds ~8%/month, so earlier years/months are
  // smaller than now. `monthsFromNow` is negative for the past.
  const G = 1.08
  const season = MALAYSIA_SEASONALITY

  // Modelled FULL-month diversion (kg) for a given calendar year+month, for the
  // selected hub. Relative to the live "now" base. Past only; callers gate the
  // future to null.
  const monthKg = (y, m) => {
    const monthsFromNow = (y - nowYear) * 12 + (m - nowMonth)
    const trend = G ** monthsFromNow
    const seasonF = season[m] / season[nowMonth]
    return baseKg * hubFactor * trend * seasonF * wob(y * 12 + m)
  }

  const isFutureMonth = (y, m) => y > nowYear || (y === nowYear && m > nowMonth)
  const isFutureDay = (y, m, d) =>
    isFutureMonth(y, m) || (y === nowYear && m === nowMonth && d > nowDay)

  // Per-period chart data. Buckets strictly AFTER today are empty (kg = null) —
  // the chart never fabricates future recycling that hasn't happened yet.
  const chart = useMemo(() => {
    if (gran === 'day') {
      // 24 hourly buckets for the selected date. The hub only OPERATES during
      // operating hours (09:00–17:00), so there is zero data before 09:00 and
      // from 17:00 onward — the day's whole diversion falls inside that window.
      const openH = Math.floor(DISPATCH_CONFIG.dayStartMin / 60) // 9
      const closeH = Math.floor(DISPATCH_CONFIG.dayEndMin / 60) // 17
      const dim = new Date(selYear, monthIdx + 1, 0).getDate()
      const perDay = monthKg(selYear, monthIdx) / dim
      // Bell-shaped activity across the operating window (slow start, midday
      // peak, tapering to close). Zero outside operating hours.
      const hourShape = (h) => {
        if (h < openH || h >= closeH) return 0
        const span = closeH - openH // 8 hours
        return 0.5 + Math.sin(((h - openH) / span) * Math.PI) * 1.1
      }
      const shapeSum = Array.from({ length: 24 }, (_, h) => hourShape(h)).reduce((a, b) => a + b, 0) || 1
      const futureDate = isFutureDay(selYear, monthIdx, selDay)
      const partialToday = selYear === nowYear && monthIdx === nowMonth && selDay === nowDay
      return Array.from({ length: 24 }, (_, h) => {
        const operating = h >= openH && h < closeH
        const future = futureDate || (partialToday && h > nowHour)
        const kg = (perDay * hourShape(h)) / shapeSum
        return {
          label: `${String(h).padStart(2, '0')}:00`,
          // Outside operating hours is a real zero (not null) so the gap is
          // clearly "closed", not "no data yet".
          kg: !operating ? 0 : future ? null : Math.round(kg * wob(h + selDay * 24 + monthIdx * 744)),
        }
      })
    }
    if (gran === 'year') {
      // 12 monthly buckets for the selected year.
      return MONTHS.map((m, i) => ({
        label: m,
        kg: isFutureMonth(selYear, i) ? null : Math.round(monthKg(selYear, i)),
      }))
    }
    // month: per-day buckets for the selected month/year.
    const dim = new Date(selYear, monthIdx + 1, 0).getDate()
    const perDay = monthKg(selYear, monthIdx) / dim
    return Array.from({ length: dim }, (_, d) => {
      const day = d + 1
      return {
        label: String(day),
        kg: isFutureDay(selYear, monthIdx, day) ? null : Math.round(perDay * wob(day + monthIdx * 31 + selYear)),
      }
    })
  }, [gran, selYear, monthIdx, selDay, baseKg, hubFactor, nowMonth, nowYear, nowDay, nowHour])

  const periodKg = chart.reduce((s, r) => s + (r.kg || 0), 0)
  const periodItems = Math.round(periodKg / 0.0386) // avg item weight ~38.6g
  const periodGP = Math.round(baseGP * (periodKg / (baseKg || 1)))

  // Top hub (by share).
  const topHub = hubs.reduce((top, h, i) => {
    const kg = hubShareKg(i, baseKg)
    return kg > (top?.kg ?? -1) ? { ...h, kg } : top
  }, null)

  // Recycled by item type, scaled so the material mix totals the period's kg.
  const materialScale = baseKg ? periodKg / baseKg : 0
  const materials = agg.byCategory.map((c) => ({
    name: CATEGORIES[c.category]?.label || c.category,
    weight: Math.round(c.weight * materialScale),
    color: CATEGORIES[c.category]?.color || '#64748b',
  }))

  // Hub ranking (all hubs, this period).
  const ranking = hubs
    .map((h, i) => ({ ...h, kg: Math.round(hubShareKg(i, periodKg || baseKg)) }))
    .sort((a, b) => b.kg - a.kg)
  const rankTotal = ranking.reduce((s, r) => s + r.kg, 0) || 1
  const medal = ['🥇', '🥈', '🥉']

  const fmtKg = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} t` : `${v} kg`)

  // Labels describing the selected period + the chart's bucket resolution.
  const bucketLabel = gran === 'day' ? 'hour' : gran === 'month' ? 'day' : 'month'
  const periodLabel =
    gran === 'day'
      ? `${selDay} ${MONTHS[monthIdx]} ${selYear}`
      : gran === 'month'
      ? `${MONTHS[monthIdx]} ${selYear}`
      : `${selYear}`

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

        {/* Day picker (day view only): day + month + year */}
        {gran === 'day' && (
          <select value={selDay} onChange={(e) => setDayNum(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500">
            {Array.from({ length: daysInSelMonth }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}

        {/* Month picker (day + month views) */}
        {(gran === 'day' || gran === 'month') && (
          <select value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        )}

        {/* Year picker (all views): 2024 .. current */}
        <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Recycled" value={fmtKg(periodKg)} sub={periodLabel} accent="text-green-600" />
        <Kpi label="Items" value={periodItems.toLocaleString()} />
        <Kpi label="GP Awarded" value={periodGP.toLocaleString()} accent="text-green-600" />
        <Kpi label="Top Hub" value={topHub?.code || '—'} sub={topHub?.name} />
      </div>

      {/* Station performance */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Station performance</h3>
        <p className="mb-2 text-xs text-slate-500">
          {hubCode === 'all' ? 'All hubs' : hubs[hubIdx]?.name} · {periodLabel} · kg recycled per {bucketLabel}
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={gran === 'day' ? 2 : gran === 'month' ? 2 : 0} />
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
  // Keep green accents green (positive) under themed palettes.
  const polarity = accent === 'text-green-600' ? 'gl-stat-pos' : ''
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${polarity} ${accent}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
