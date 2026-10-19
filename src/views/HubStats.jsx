import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { useStore } from '../store/StoreContext.jsx'
import { CATEGORIES, getItem } from '../data/catalog.js'
import { Card, CardHeader } from '../components/ui.jsx'
import { formatGP } from '../lib/engine.js'

const catOf = (t) => t.category || getItem(t.itemId)?.category || 'Other'
const catLabel = (c) => CATEGORIES[c]?.label || c
const catColor = (c) => CATEGORIES[c]?.color || '#94a3b8'

function bucketKey(ts, period) {
  const d = new Date(ts)
  return period === 'day'
    ? d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
    : period === 'month'
      ? d.toLocaleDateString('en-MY', { month: 'short', year: '2-digit' })
      : `${d.getFullYear()}`
}

const selCls =
  'rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 focus:border-green-500 focus:outline-none'

export default function HubStats() {
  const { state } = useStore()
  const [hubId, setHubId] = useState('all')
  const [period, setPeriod] = useState('month')

  const txs = state.opsTransactions
  const filtered = useMemo(() => txs.filter((t) => hubId === 'all' || t.hubId === hubId), [txs, hubId])

  // contribution ranking across ALL hubs (independent of filter)
  const ranking = useMemo(
    () =>
      state.hubs
        .map((h) => ({
          id: h.id, name: h.name,
          gp: txs.filter((t) => t.hubId === h.id).reduce((s, t) => s + t.tokensAwarded, 0),
          kg: txs.filter((t) => t.hubId === h.id).reduce((s, t) => s + t.totalWeight, 0),
        }))
        .sort((a, b) => b.gp - a.gp),
    [txs, state.hubs]
  )

  const byBucket = useMemo(() => {
    const m = {}
    filtered.forEach((t) => {
      const k = bucketKey(t.timestamp, period)
      m[k] = m[k] || { key: k, GP: 0, kg: 0, items: 0 }
      m[k].GP += t.tokensAwarded
      m[k].kg += t.totalWeight
      m[k].items += t.quantity
    })
    return Object.values(m).reverse()
  }, [filtered, period])

  const byCat = useMemo(() => {
    const m = {}
    filtered.forEach((t) => {
      const c = catOf(t)
      m[c] = (m[c] || 0) + t.totalWeight
    })
    return Object.entries(m).map(([c, kg]) => ({ name: catLabel(c), kg: Math.round(kg * 100) / 100, color: catColor(c) }))
  }, [filtered])

  const medal = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Hub Station Performance"
          subtitle="Recycling throughput across all registered hubs"
          right={
            <div className="flex gap-2">
              <select className={selCls} value={hubId} onChange={(e) => setHubId(e.target.value)}>
                <option value="all">All hubs</option>
                {state.hubs.map((h) => (<option key={h.id} value={h.id}>{h.id} — {h.name}</option>))}
              </select>
              <select className={selCls} value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="day">By day</option>
                <option value="month">By month</option>
                <option value="year">By year</option>
              </select>
            </div>
          }
        />
        <div className="px-5 py-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No data yet — run the Smart Bin demo, let users recycle from their Scan tab, or press “Load Demo Data”.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byBucket}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="gp" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="kg" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="gp" dataKey="GP" name="Green Points issued" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="kg" dataKey="kg" name="Weight (kg)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recycled Material Type" subtitle={`${hubId === 'all' ? 'All hubs' : hubId} · per ${period}`} />
          <div className="px-5 py-4">
            {byCat.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No material data for this filter.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCat}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v} kg`, 'Weight']} />
                    <Bar dataKey="kg" name="Weight (kg)" radius={[4, 4, 0, 0]}>
                      {byCat.map((d) => (<cell key={d.name} fill={d.color} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Hub Contribution Ranking" subtitle="Which hub contributes the most to recycling (by GP issued)" />
          <div className="px-5 py-4">
            <ul className="divide-y divide-slate-100">
              {ranking.map((h, i) => (
                <li key={h.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-7 text-center text-lg">{medal[i] || `${i + 1}.`}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{h.name}</p>
                    <p className="font-mono text-[11px] text-slate-400">{h.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{formatGP(h.gp)}</p>
                    <p className="text-[11px] text-slate-400">{h.kg.toFixed(1)} kg</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}