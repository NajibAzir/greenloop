import { useState } from 'react'
import { useStore, useAccount } from '../store/StoreContext.jsx'
import { ACCOUNT_TYPES } from '../data/catalog.js'
import { formatRm, formatGP, tokensToRm } from '../lib/engine.js'
import { Card, CardHeader, Button } from '../components/ui.jsx'

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export default function ProfileView() {
  const { state, dispatch } = useStore()
  const persona = state.accountType // 'residence' | 'tenant'
  const acct = ACCOUNT_TYPES[persona] || ACCOUNT_TYPES.residence
  const account = useAccount()
  const profile = state.profiles[persona]

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(profile)

  const roleLabel = persona === 'tenant' ? 'Tenant' : 'User'
  const avatar = persona === 'tenant' ? '🏬' : '🧑'

  function save() {
    dispatch({ type: 'UPDATE_PROFILE', persona, patch: form })
    setEditing(false)
  }

  function switchPersona(p) {
    dispatch({ type: 'SET_ACCOUNT', accountType: p })
    setEditing(false)
  }

  return (
    <div className="space-y-5">
      {/* GP balance */}
      <Card className="bg-gradient-to-br from-green-600 to-emerald-500 text-white ring-0">
        <div className="px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-green-50">Green Points Balance</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-4xl font-bold tabular-nums">{account.tokenBalance.toLocaleString()}</span>
            <span className="pb-1 text-sm text-green-50">GP</span>
          </div>
          <p className="mt-1 text-sm text-green-50">≈ {formatRm(tokensToRm(account.tokenBalance))} spendable value</p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`${roleLabel} Profile`}
          subtitle="Your GreenLoop account details"
          right={
            <div className="flex items-center gap-3">
              {/* Persona switch (residence / mall tenant) */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                {Object.values(ACCOUNT_TYPES).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => switchPersona(a.id)}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                      persona === a.id ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    <span>{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-green-100 text-xl ring-2 ring-green-200">
                {avatar}
              </span>
            </div>
          }
        />
        <div className="px-5 py-4">
          {!editing ? (
            <>
              <Row label={`${roleLabel} ID`} value={profile.id} mono />
              <Row label="Name" value={profile.name} />
              <Row label="Email" value={profile.email} />
              <Row label="Address" value={profile.address} />
              <Row label="Green Point (GP) Balance" value={formatGP(account.tokenBalance)} />
              <div className="pt-4">
                <Button variant="secondary" onClick={() => { setForm(profile); setEditing(true) }}>
                  ✎ Edit profile
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {['name', 'email', 'address'].map((k) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-xs font-medium capitalize text-slate-600">{k}</span>
                  <input
                    value={form[k] ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </label>
              ))}
              <div className="flex gap-2 pt-2">
                <Button onClick={save}>Save</Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
