import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { Button } from '../components/ui.jsx'
import SmartBin from '../components/SmartBin.jsx'

export default function RecycleHubView() {
  const { state, dispatch } = useStore()
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  const hubs = state.registeredHubs || []

  if (selected) {
    return <SmartBin hub={selected} onBack={() => setSelected(null)} />
  }

  function register(e) {
    e.preventDefault()
    if (!name.trim()) return
    dispatch({ type: 'REGISTER_HUB', name: name.trim(), address: address.trim() })
    setName(''); setAddress(''); setShowForm(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recycle Hub</h2>
          <p className="text-sm text-slate-500">Registered hubs and their smart recycle bins.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>+ Register hub</Button>
      </div>

      {showForm && (
        <form onSubmit={register} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="mb-3 text-sm font-semibold text-slate-800">Register a new Smart-Bin hub</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Hub name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Taman Melati Hub"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Address</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500" />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit">Register</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hubs.map((h) => (
          <HubCard key={h.code} hub={h} onOpen={() => setSelected(h)} />
        ))}
      </div>
    </div>
  )
}

function HubCard({ hub, onOpen }) {
  const manual = hub.type === 'manual'
  return (
    <button
      onClick={onOpen}
      className={`block rounded-xl bg-white p-4 text-left shadow-sm ring-1 transition hover:shadow-md ${
        manual ? 'ring-green-300' : 'ring-slate-200'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-xl">🗑️</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            manual ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
          }`}
        >
          {manual ? 'Manual demo' : 'Auto simulation'}
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{hub.name}</h3>
      <p className="font-mono text-xs text-slate-400">{hub.code}</p>
      <p className="mt-2 text-sm text-slate-500">{hub.address}</p>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-400">
        <span className="inline-block h-2 w-2 rounded-full ring-1 ring-slate-300" />
        No user linked
      </p>
    </button>
  )
}
