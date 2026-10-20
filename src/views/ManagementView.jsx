import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
} from 'recharts'
import { useStore } from '../store/StoreContext.jsx'
import { CATEGORIES, ECONOMICS, COLLECTION_HUBS } from '../data/catalog.js'
import { aggregate, formatRm, formatWeight, formatGP } from '../lib/engine.js'
import {
  computeRoi,
  forecast,
  monthTrend,
  monthlySeries,
  annualSeries,
  monthFigures,
  yearTotal,
  scaleForMonth,
  scaleForYear,
  currentYearMonth,
} from '../lib/finance.js'
import { Card, CardHeader, Stat } from '../components/ui.jsx'
import LiveLogistics from './LiveLogistics.jsx'

// Stat card with a trend arrow + period-over-period % change.
function TrendStat({ label, value, sub, accent = 'text-slate-900', trend }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {trend && (
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
              trend.up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {trend.up ? '▲' : '▼'} {Math.abs(trend.pct)}%
          </span>
        )}
      </div>
      <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${accent}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

// -------------------------------------------------------------------------
// Diversion Metrics page
// -------------------------------------------------------------------------
function MaterialCharts({ byCategory, scale = 1 }) {
  const data = byCategory.map((c) => ({
    name: CATEGORIES[c.category]?.label || c.category,
    weight: Math.round(c.weight * scale),
    color: CATEGORIES[c.category]?.color || '#64748b',
  }))

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        No drop-offs yet. Load demo data or simulate a drop-off in the Resident view.
      </div>
    )
  }

  const fmtKg = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} t` : `${v} kg`)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}t` : v)} />
            <Tooltip formatter={(v) => fmtKg(v)} />
            <Bar dataKey="weight" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="weight" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => fmtKg(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Rank hubs by how much they've contributed (by weight), from ops transactions
// that carry a hubId. Shows which hubs drive the township's diversion.
function HubRanking({ transactions }) {
  const totals = {}
  for (const t of transactions) {
    if (!t.hubId) continue
    totals[t.hubId] = (totals[t.hubId] || 0) + t.totalWeight
  }
  const rows = COLLECTION_HUBS.map((h) => ({ id: h.id, name: h.name, kg: Math.round(totals[h.id] || 0) }))
    .sort((a, b) => b.kg - a.kg)
  const max = Math.max(1, ...rows.map((r) => r.kg))
  const grand = rows.reduce((s, r) => s + r.kg, 0)
  const medal = ['🥇', '🥈', '🥉']

  if (grand === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-slate-400">
        No hub activity yet. Load demo data or record drop-offs.
      </div>
    )
  }

  return (
    <div className="space-y-2 px-5 py-4">
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3">
          <span className="w-6 text-center text-sm">{medal[i] || `${i + 1}`}</span>
          <span className="w-40 shrink-0 truncate text-sm font-medium text-slate-700" title={r.name}>
            {r.name}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
              style={{ width: `${(r.kg / max) * 100}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-600">
            {formatWeight(r.kg)}
          </span>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-400">
            {Math.round((r.kg / grand) * 100)}%
          </span>
        </div>
      ))}
    </div>
  )
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// Per-month (or per-year) diversion chart. The SOLID line is actual data and
// stops at today (future periods are null, never fabricated). When projection
// is on, a separate DASHED line continues from now into the future so the two
// are always visually distinct. A "Now" marker shows where today sits.
function DiversionChart({ data, showForecast }) {
  const nowRow = data.find((d) => d.isNow)
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}t` : v)} />
          <Tooltip formatter={(v, n) => [`${Math.round(v).toLocaleString()} kg`, n === 'actual' ? 'Actual' : 'Projected']} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {nowRow && (
            <ReferenceLine
              x={nowRow.label}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              label={{ value: 'Now', fontSize: 10, fill: '#64748b', position: 'top' }}
            />
          )}
          <Area type="monotone" dataKey="actual" name="Actual" stroke="#16a34a" fill="#bbf7d0" strokeWidth={2.5} connectNulls={false} dot={{ r: 2 }} />
          {showForecast && (
            <Line type="monotone" dataKey="forecast" name="Projected" stroke="#16a34a" strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function DiversionMetrics() {
  const { state } = useStore()
  const { year: nowYear, month: nowMonth } = currentYearMonth()

  const [view, setView] = useState('month') // 'month' | 'year'
  const [selYear, setSelYear] = useState(nowYear)
  const [selMonth, setSelMonth] = useState(nowMonth)
  const [showForecast, setShowForecast] = useState(false) // dashed projection on/off

  const mom = useMemo(() => monthTrend(state.opsTransactions), [state.opsTransactions])
  const years = useMemo(() => {
    const arr = []
    for (let y = nowYear - 2; y <= nowYear + 3; y++) arr.push(y)
    return arr
  }, [nowYear])

  const baseAgg = useMemo(() => aggregate(state.opsTransactions), [state.opsTransactions])

  const chartData = useMemo(() => {
    if (view === 'year') return annualSeries(state.opsTransactions, years, showForecast)
    return monthlySeries(state.opsTransactions, selYear, showForecast)
  }, [view, state.opsTransactions, years, selYear, showForecast])

  const scope = useMemo(() => {
    if (view === 'year') {
      const t = yearTotal(state.opsTransactions, selYear)
      return {
        label: `${selYear}`,
        empty: t.empty,
        partial: t.partial,
        weight: t.kg,
        co2: t.co2,
        bulk: t.rm,
        gp: t.gp,
        materialScale: scaleForYear(state.opsTransactions, selYear),
      }
    }
    const m = monthFigures(state.opsTransactions, selYear, selMonth)
    return {
      label: `${MONTH_NAMES[selMonth].slice(0, 3)} ${selYear}`,
      empty: m.empty,
      partial: m.partial,
      weight: m.empty ? 0 : m.kg,
      co2: m.empty ? 0 : m.co2,
      bulk: m.empty ? 0 : m.rm,
      gp: m.empty ? 0 : m.gp,
      materialScale: scaleForMonth(state.opsTransactions, selYear, selMonth),
    }
  }, [view, state.opsTransactions, selYear, selMonth])

  // Suffix shown on the stat cards for the selected scope.
  const scopeNote = scope.empty ? ' · no data yet' : scope.partial ? ' · to date' : ''

  return (
    <div className="space-y-5">
      {/* View + period pickers */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
          {[
            { id: 'month', label: 'Monthly' },
            { id: 'year', label: 'Annual' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`rounded-md px-3 py-1.5 transition ${
                view === v.id ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {view === 'month' && (
            <Select
              value={String(selMonth)}
              onChange={(v) => setSelMonth(Number(v))}
              options={MONTH_NAMES.map((m, i) => ({ value: String(i), label: m }))}
            />
          )}
          <Select
            value={String(selYear)}
            onChange={(v) => setSelYear(Number(v))}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        </div>
      </div>

      {/* Stat cards for the selected scope. Future periods show a dash, not 0. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TrendStat label="Waste Diverted" value={scope.empty ? '—' : formatWeight(scope.weight)} sub={`${scope.label}${scopeNote}`} accent="text-green-600" trend={scope.empty ? null : mom} />
        <TrendStat label="CO₂ Avoided" value={scope.empty ? '—' : `${Math.round(scope.co2).toLocaleString()} kg`} sub={`${scope.label}${scopeNote}`} trend={scope.empty ? null : mom} />
        <TrendStat label="Bulk Value" value={scope.empty ? '—' : formatRm(scope.bulk)} sub={`${scope.label} · commodity`} accent="text-green-600" trend={scope.empty ? null : mom} />
        <TrendStat label="GP Issued" value={scope.empty ? '—' : formatGP(scope.gp)} sub={scope.empty ? 'no data yet' : `≈ ${formatRm(scope.gp * 0.1)}`} trend={scope.empty ? null : mom} />
      </div>

      {/* Diversion chart (per-month or per-year, actual vs projected) */}
      <Card>
        <CardHeader
          title={view === 'year' ? 'Annual Diversion' : `Monthly Diversion — ${selYear}`}
          subtitle={
            showForecast
              ? 'Solid = actual up to today · dashed = projection · seasonal pattern included'
              : 'Actual collected volume up to today · seasonal pattern included · future is empty'
          }
          right={
            <button
              onClick={() => setShowForecast((s) => !s)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ring-1 transition ${
                showForecast
                  ? 'bg-green-600 text-white ring-green-600'
                  : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {showForecast ? '✓ Projection on' : 'Show projection'}
            </button>
          }
        />
        <div className="px-5 py-4">
          <DiversionChart data={chartData} showForecast={showForecast} />
        </div>
      </Card>

      {/* Material breakdown for the selected scope */}
      <Card>
        <CardHeader title="Waste Diverted by Material Type" subtitle={`${scope.label}, by material`} />
        <div className="px-5 py-4">
          <MaterialCharts byCategory={baseAgg.byCategory} scale={scope.materialScale} />
        </div>
      </Card>

      {/* Hub contribution ranking */}
      <Card>
        <CardHeader
          title="Hub Contribution Ranking"
          subtitle="Which hubs contribute most of the township's diverted waste"
        />
        <HubRanking transactions={state.opsTransactions} />
      </Card>
    </div>
  )
}

// -------------------------------------------------------------------------
// Financial Ledger page — ROI dashboard + forecast
// -------------------------------------------------------------------------
const HORIZONS = [
  { months: 3, label: 'Next 3 months' },
  { months: 12, label: 'Next 12 months' },
  { months: 24, label: 'Next 2 years' },
]

function BenefitRow({ label, value, note, sign = '+' }) {
  const positive = sign === '+'
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div>
        <span className="text-sm text-slate-700">{label}</span>
        {note && <span className="ml-1 text-xs text-slate-400">{note}</span>}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${positive ? 'text-green-600' : 'text-slate-900'}`}>
        {sign} {formatRm(value)}
      </span>
    </div>
  )
}

function FinancialLedger() {
  const { state } = useStore()
  const [horizon, setHorizon] = useState(12)
  const roi = useMemo(() => computeRoi(state.opsTransactions), [state.opsTransactions])
  const fc = useMemo(() => forecast(state.opsTransactions, horizon), [state.opsTransactions, horizon])

  const surplusPositive = roi.netSurplus >= 0

  return (
    <div className="space-y-5">
      {/* Headline ROI stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Net Operating Surplus"
          value={formatRm(roi.netSurplus)}
          sub="this period"
          accent={surplusPositive ? 'text-green-600' : 'text-red-600'}
        />
        <Stat label="Operating ROI" value={`${roi.roiPct}%`} sub="benefit ÷ cost" accent={surplusPositive ? 'text-green-600' : 'text-red-600'} />
        <Stat
          label="CapEx Payback"
          value={fc.paybackMonth ? `${fc.paybackMonth} mo` : '—'}
          sub={`setup ${formatRm(roi.capex)}`}
        />
        <Stat label="Diverted" value={formatWeight(roi.kg)} sub="from landfill" accent="text-green-600" />
      </div>

      {/* Benefit vs cost breakdown */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Where the value comes from"
            subtitle="Avoided haulage is the biggest driver — not scrap sales alone"
          />
          <div className="divide-y divide-slate-100 py-1">
            <BenefitRow
              label="Avoided landfill & haulage"
              note={`@ RM${ECONOMICS.avoidedHaulageRmPerTonne}/t`}
              value={roi.avoidedHaulage}
            />
            <BenefitRow label="Bulk commodity sales" note="direct-to-recycler" value={roi.commoditySales} />
            <BenefitRow label="Carbon / ESG value" note={`@ RM${ECONOMICS.carbonRmPerTonneCo2}/t CO₂`} value={roi.carbonValue} />
            <div className="flex items-center justify-between bg-green-50 px-4 py-2">
              <span className="text-sm font-semibold text-green-800">Total benefit</span>
              <span className="text-sm font-bold tabular-nums text-green-700">{formatRm(roi.totalBenefit)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Operating costs" subtitle="Only redeemed Green Points are a real cash cost" />
          <div className="divide-y divide-slate-100 py-1">
            <BenefitRow label="Hub operating cost" note="staff, utilities, upkeep" value={roi.opex} sign="−" />
            <BenefitRow
              label="Green Points redeemed"
              note={`${Math.round(ECONOMICS.gpRedemptionRate * 100)}% of issued`}
              value={roi.gpRedeemedRm}
              sign="−"
            />
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm text-slate-500">Outstanding GP liability</span>
              <span className="text-sm font-medium tabular-nums text-slate-400">{formatRm(roi.gpLiabilityRm)}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Total cost</span>
              <span className="text-sm font-bold tabular-nums text-slate-900">{formatRm(roi.totalCost)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Verdict banner */}
      <div
        className={`rounded-xl px-5 py-4 ring-1 ${
          surplusPositive ? 'bg-green-50 ring-green-200' : 'bg-amber-50 ring-amber-200'
        }`}
      >
        <p className={`text-sm font-semibold ${surplusPositive ? 'text-green-800' : 'text-amber-800'}`}>
          {surplusPositive
            ? `This hub runs a monthly surplus of ${formatRm(roi.netSurplus)} and pays back its ${formatRm(roi.capex)} setup in about ${fc.paybackMonth ?? '—'} months.`
            : 'Volume is still ramping — load more drop-offs or demo data to reach the operating surplus.'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Because avoided haulage and ESG value scale with participation, the return compounds the longer the hub
          runs — this is a continuous operation, not a one-off campaign.
        </p>
      </div>

      {/* Forecast */}
      <Card>
        <CardHeader
          title="Revenue & ROI Forecast"
          subtitle={`Projected at ${Math.round(ECONOMICS.monthlyGrowthRate * 100)}% monthly volume growth as engagement compounds`}
          right={
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
              {HORIZONS.map((h) => (
                <button
                  key={h.months}
                  onClick={() => setHorizon(h.months)}
                  className={`rounded-md px-2.5 py-1 transition ${
                    horizon === h.months ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          }
        />
        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Projected benefit" value={formatRm(fc.totalBenefit)} sub={`over ${horizon} mo`} accent="text-green-600" />
            <Stat
              label="Cumulative net (incl. CapEx)"
              value={formatRm(fc.endCumulative)}
              sub={`by month ${horizon}`}
              accent={fc.endCumulative >= 0 ? 'text-green-600' : 'text-red-600'}
            />
            <Stat label="Break-even" value={fc.paybackMonth ? `Month ${fc.paybackMonth}` : 'beyond range'} />
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={fc.rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={horizon > 12 ? 1 : 0} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v, n) => [formatRm(v), n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="benefit" name="Monthly benefit" fill="#bbf7d0" stroke="#22c55e" />
                <Line type="monotone" dataKey="net" name="Monthly net" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cumulative" name="Cumulative (incl. CapEx)" stroke="#16a34a" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400">
            The cumulative line starts below zero by the one-time setup cost and crosses break-even where the hub has
            fully paid for itself; everything above the line is net return to the property developer.
          </p>
        </div>
      </Card>
    </div>
  )
}

// -------------------------------------------------------------------------
// Router for management pages
// -------------------------------------------------------------------------
export default function ManagementView({ page }) {
  switch (page) {
    case 'ledger':
      return <FinancialLedger />
    case 'logistics':
      return <LiveLogistics />
    case 'metrics':
    default:
      return <DiversionMetrics />
  }
}
