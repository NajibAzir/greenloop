import { useState } from 'react'
import { COLLECTION_HUBS } from '../data/catalog.js'
import { Button } from '../components/ui.jsx'
import SmartBin from '../components/SmartBin.jsx'

// A demo hub pinned first; its data writes to real 'hub-a'.
const DEMO_HUB = {
  id: 'hub-00000001',
  dataHubId: 'hub-a',
  name: 'Elm Avenue Hub (Manual Demo)',
  location: 'Jalan Elm, City of Elmina',
  code: 'ELM-014',
  demo: true,
}

export default function RecycleHubView() {
  const [selected, setSelected] = useState(null)

  if (selected) {
    return <SmartBin hub={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Recycle Hub</h2>
        <p className="text-sm text-slate-500">
          Registered hubs and their smart recycle bins — open a hub to run the Smart Recycle Bin + QR station.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HubCard hub={DEMO_HUB} location={DEMO_HUB.location} code={DEMO_HUB.code} highlight onOpen={setSelected} />
        {COLLECTION_HUBS.map((h, i) => (
          <HubCard
            key={h.id}
            hub={{ ...h, dataHubId: h.id, code: `ELM-${String(100 + i).padStart(3, '0')}` }}
            location={h.name}
            code={`ELM-${String(100 + i).padStart(3, '0')}`}
            onOpen={setSelected}
          />
        ))}
      </div>
    </div>
  )
}

function HubCard({ hub, location, code, onOpen, highlight }) {
  return (
    <div className={`rounded-xl bg-white p-5 shadow-sm ring-1 ${highlight ? 'ring-green-200' : 'ring-slate-200'}`}>
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{hub.name}</h3>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">● online</span>
      </div>
      <p className="mt-1 font-mono text-xs uppercase text-slate-400">{code}</p>
      <p className="mt-2 text-sm text-slate-500">📍 {location}</p>
      <div className="mt-4">
        <Button onClick={() => onOpen(hub)}>Open hub</Button>
      </div>
    </div>
  )
}
