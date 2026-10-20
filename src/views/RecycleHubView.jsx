import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { COLLECTION_HUBS, ITEM_CATALOG } from '../data/catalog.js'
import { computeDropoff, formatGP, formatWeight } from '../lib/engine.js'
import { Card, CardHeader, Button } from '../components/ui.jsx'

// Map the entry camera (Cam 1) detection to a catalog item id + bay key.
const DETECTIONS = {
  PET: { itemId: 'pet-bottle', bay: 'PET', label: '🧴 PET bottle' },
  CAN: { itemId: 'aluminum-can', bay: 'CAN', label: '🥫 Aluminium can' },
  PAPER: { itemId: 'paper-carton', bay: 'PAPER', label: '🧃 Paper carton' },
}

// Bay display config (label + fill colour).
const BAYS = [
  { key: 'PET', label: 'PET', color: '#3b82f6' },
  { key: 'CAN', label: 'CAN', color: '#64748b' },
  { key: 'PAPER', label: 'PAPER', color: '#f59e0b' },
]

// A demo hub that is always available at the top of the grid. Its data writes
// to the real 'hub-a' so township metrics still update.
const DEMO_HUB = {
  id: 'hub-00000001',
  dataHubId: 'hub-a',
  name: 'Elm Avenue Hub (Manual Demo)',
  location: 'Jalan Elm, City of Elmina',
  demo: true,
}

const INITIAL_BAYS = { PET: 0.56, CAN: 0.15, PAPER: 0.55 }

export default function RecycleHubView() {
  const { dispatch } = useStore()
  const [selectedHub, setSelectedHub] = useState(null)

  // --- session state (reset when hub changes or session ends) ---
  const [paired, setPaired] = useState(false)
  const [sessionGP, setSessionGP] = useState(0)
  const [sessionItems, setSessionItems] = useState(0)
  const [sessionWeight, setSessionWeight] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [events, setEvents] = useState([])
  const [cam1, setCam1] = useState(null) // 'PET' | 'CAN' | 'PAPER' | 'OTHER' | null
  const [bayLevels, setBayLevels] = useState(INITIAL_BAYS)
  const [doorOpen, setDoorOpen] = useState(false)
  const [liveCamera, setLiveCamera] = useState(false)

  const locked = strikes >= 3

  // The hub id used for data operations (demo hub routes to hub-a).
  const dataHubId = selectedHub?.dataHubId || selectedHub?.id || 'hub-a'

  function resetSession() {
    setPaired(false)
    setSessionGP(0)
    setSessionItems(0)
    setSessionWeight(0)
    setStrikes(0)
    setEvents([])
    setCam1(null)
    setBayLevels(INITIAL_BAYS)
    setDoorOpen(false)
    setLiveCamera(false)
  }

  function openHub(hub) {
    resetSession()
    setSelectedHub(hub)
  }

  function backToGrid() {
    resetSession()
    setSelectedHub(null)
  }

  function logEvent(partial) {
    setEvents((prev) => [
      { id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), ...partial },
      ...prev,
    ])
  }

  function raiseBay(bayKey, amount) {
    setBayLevels((prev) => ({
      ...prev,
      [bayKey]: Math.min(1, (prev[bayKey] || 0) + amount),
    }))
  }

  function addStrike() {
    let total = strikes
    setStrikes((s) => {
      total = s + 1
      return total
    })
    return total
  }

  // --- actions -------------------------------------------------------------

  function handleDetect(key) {
    if (!paired) return
    setCam1(key)
    setDoorOpen(key !== 'OTHER')
    if (key === 'OTHER') {
      logEvent({
        cam1: 'Other',
        cam2: '-',
        weight: '-',
        result: '❌ Rejected at entry',
      })
    }
  }

  function creditDrop(itemId, qty, bayKey) {
    const result = computeDropoff(itemId, qty)
    setSessionGP((g) => g + result.tokensAwarded)
    setSessionItems((i) => i + result.quantity)
    setSessionWeight((w) => w + result.totalWeight)
    raiseBay(bayKey, 0.02 * qty)
    dispatch({ type: 'DROP_OFF', itemId, quantity: qty, hubId: dataHubId })
    return result
  }

  function handleDrop(qty) {
    if (!paired || locked) return
    const det = DETECTIONS[cam1]
    if (!det) {
      logEvent({ cam1: 'Other', cam2: '-', weight: '-', result: '❌ Rejected at entry' })
      return
    }
    const result = creditDrop(det.itemId, qty, det.bay)
    logEvent({
      cam1: result.name,
      cam2: '✅ verified',
      weight: formatWeight(result.totalWeight),
      result: `✅ +${result.tokensAwarded} GP`,
    })
  }

  function handleDropWithContaminant() {
    if (!paired || locked) return
    const det = DETECTIONS[cam1]
    if (!det) {
      logEvent({ cam1: 'Other', cam2: '-', weight: '-', result: '❌ Rejected at entry' })
      return
    }
    // 9 good items are credited; the 1 wrong item is caught by Cam 2.
    const result = creditDrop(det.itemId, 9, det.bay)
    logEvent({
      cam1: result.name,
      cam2: '⚠️ contaminant found',
      weight: formatWeight(result.totalWeight),
      result: '⚠️ 1 item rejected inside',
    })
    const total = addStrike()
    if (total >= 3) {
      logEvent({
        cam1: '-',
        cam2: 'strike limit',
        weight: '-',
        result: '🚫 Bay locked — operator alerted',
      })
    }
  }

  function handleTakeBack() {
    if (!paired) return
    logEvent({ cam1: cam1 ? (DETECTIONS[cam1]?.name || 'Other') : '-', cam2: '-', weight: '-', result: '↩ Item returned, no GP' })
    setCam1(null)
    setDoorOpen(false)
  }

  function handleCloseDoor() {
    if (!paired) return
    setCam1(null)
    setDoorOpen(false)
    logEvent({ cam1: '-', cam2: '-', weight: '-', result: '🚪 Door closed' })
  }

  function handleStone() {
    if (!paired || locked) return
    const total = addStrike()
    logEvent({
      cam1: 'Stone?',
      cam2: '❌ not recyclable',
      weight: '-',
      result: '🚫 Rejected (cheat)',
    })
    if (total >= 3) {
      logEvent({ cam1: '-', cam2: 'strike limit', weight: '-', result: '🚫 Bay locked — operator alerted' })
    }
  }

  function handleWaterBottle() {
    if (!paired || locked) return
    const total = addStrike()
    logEvent({
      cam1: 'PET bottle?',
      cam2: '⚠️ weight audit',
      weight: 'too heavy',
      result: '🚫 Rejected: weight audit failed (water)',
    })
    if (total >= 3) {
      logEvent({ cam1: '-', cam2: 'strike limit', weight: '-', result: '🚫 Bay locked — operator alerted' })
    }
  }

  function handleEmptyBays() {
    let emptied = false
    setBayLevels((prev) => {
      const next = { ...prev }
      for (const b of BAYS) {
        if ((next[b.key] || 0) >= 0.8) {
          next[b.key] = 0.1
          emptied = true
        }
      }
      return next
    })
    logEvent({
      cam1: '-',
      cam2: '-',
      weight: '-',
      result: emptied ? '🚛 Collector emptied full bays' : '🚛 No bays over 80%',
    })
  }

  function handleResetStrikes() {
    setStrikes(0)
    logEvent({ cam1: '-', cam2: '-', weight: '-', result: '🔧 Operator reset strikes' })
  }

  function endSession() {
    resetSession()
  }

  // --- render --------------------------------------------------------------

  if (!selectedHub) {
    return <HubGrid onOpen={openHub} />
  }

  const dropEnabled = paired && !locked && !!DETECTIONS[cam1]
  const location = selectedHub.demo ? selectedHub.location : selectedHub.name

  return (
    <div className="space-y-5">
      <div>
        <Button variant="secondary" onClick={backToGrid}>← Back to hub grid</Button>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">{selectedHub.name}</h2>
        <p className="text-sm text-slate-500">📍 {location}</p>
      </div>

      {/* Session stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SessionStat label="Green Point (GP) — This Session" value={`+${sessionGP}`} accent="text-green-600" />
        <SessionStat label="Items Accepted" value={sessionItems} />
        <SessionStat label="Weight Collected" value={formatWeight(sessionWeight)} />
        <SessionStat label="Flag Strikes" value={`${strikes}/3`} accent={locked ? 'text-red-600' : 'text-slate-900'} />
      </div>

      {/* Two-column console */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT — the bin */}
        <div className="rounded-xl bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setPaired(true)}>Scan QR with phone</Button>
            <Button variant="secondary" onClick={endSession}>End session</Button>
          </div>

          <p className="mt-4 text-sm text-slate-300">
            {paired ? 'Session active — resident paired.' : 'Status: ready. Waiting for a resident to scan.'}
          </p>

          <div className="mt-6 flex items-end justify-center gap-4">
            {BAYS.map((b) => {
              const pct = Math.round((bayLevels[b.key] || 0) * 100)
              return (
                <div key={b.key} className="flex flex-col items-center gap-2">
                  <div className="relative h-40 w-20 overflow-hidden rounded-lg bg-slate-800 ring-1 ring-slate-700">
                    <div
                      className="absolute inset-x-0 bottom-0 transition-all"
                      style={{ height: `${pct}%`, backgroundColor: b.color }}
                    />
                    <span className="absolute inset-x-0 top-1 text-center text-[11px] font-semibold text-white/90">
                      {pct}%
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-300">{b.label}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            {doorOpen ? '🔓 Bay door open' : '🔒 Bay door closed'}
          </p>
        </div>

        {/* RIGHT — operator controls */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {!paired ? (
            <div className="flex h-full min-h-[18rem] items-center justify-center">
              <p className="text-sm text-slate-400">Scan QR to start a session</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Cam 1 */}
              <section>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cam 1 — Entry Detection
                  </h3>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={liveCamera}
                      onChange={(e) => setLiveCamera(e.target.checked)}
                      className="accent-green-600"
                    />
                    📷 Use live camera
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant={cam1 === 'PET' ? 'primary' : 'secondary'}
                    onClick={() => handleDetect('PET')}
                  >
                    🧴 PET bottle
                  </Button>
                  <Button
                    variant={cam1 === 'CAN' ? 'primary' : 'secondary'}
                    onClick={() => handleDetect('CAN')}
                  >
                    🥫 Aluminium can
                  </Button>
                  <Button
                    variant={cam1 === 'PAPER' ? 'primary' : 'secondary'}
                    onClick={() => handleDetect('PAPER')}
                  >
                    🧃 Paper carton
                  </Button>
                  <Button
                    variant={cam1 === 'OTHER' ? 'danger' : 'secondary'}
                    onClick={() => handleDetect('OTHER')}
                  >
                    ❌ Other (error)
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Cam 1 accepts PET bottle, aluminium can and paper carton. Any other material is
                  rejected before the door opens.
                </p>
              </section>

              {/* Step 2 — drop */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  2 — Put Items Into The Open Bay
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={!dropEnabled} onClick={() => handleDrop(1)}>
                    Drop 1 item
                  </Button>
                  <Button variant="secondary" disabled={!dropEnabled} onClick={() => handleDrop(10)}>
                    Drop 10 items
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!dropEnabled}
                    onClick={handleDropWithContaminant}
                  >
                    Drop 10 incl. 1 wrong material
                  </Button>
                  <Button variant="secondary" onClick={handleCloseDoor}>
                    Close door
                  </Button>
                  <Button variant="secondary" disabled={!dropEnabled} onClick={handleTakeBack}>
                    ↩ Take item back
                  </Button>
                </div>
                {locked && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    🚫 Bay locked after 3 strikes. Reset strikes to continue.
                  </p>
                )}
              </section>

              {/* Cheat attempts */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Try To Cheat
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="danger" disabled={locked} onClick={handleStone}>
                    🪨 Drop a stone
                  </Button>
                  <Button variant="danger" disabled={locked} onClick={handleWaterBottle}>
                    💧 Water-filled bottle
                  </Button>
                </div>
              </section>

              {/* Collector + bay levels */}
              <section className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={handleEmptyBays}>
                    ♻️ Collector: empty bays over 80%
                  </Button>
                  {locked && (
                    <Button variant="secondary" onClick={handleResetStrikes}>
                      Reset strikes
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Bay levels: PET {Math.round((bayLevels.PET || 0) * 100)}% · CAN{' '}
                  {Math.round((bayLevels.CAN || 0) * 100)}% · PAPER{' '}
                  {Math.round((bayLevels.PAPER || 0) * 100)}%
                </p>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Event Log */}
      <Card>
        <CardHeader
          title="Event Log"
          subtitle="Cam 1 entry check · Cam 2 tray verification · weight audit"
        />
        <div className="overflow-x-auto px-5 py-4">
          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No events yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-4 font-medium">Time</th>
                  <th className="pb-2 pr-4 font-medium">Cam 1 (entry)</th>
                  <th className="pb-2 pr-4 font-medium">Cam 2 (inside)</th>
                  <th className="pb-2 pr-4 font-medium">Weight</th>
                  <th className="pb-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs text-slate-500">{e.time}</td>
                    <td className="py-2 pr-4 text-slate-700">{e.cam1}</td>
                    <td className="py-2 pr-4 text-slate-700">{e.cam2}</td>
                    <td className="py-2 pr-4 text-slate-700">{e.weight}</td>
                    <td className="py-2 font-medium text-slate-800">{e.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}

// --- Screen 1 — hub grid ---------------------------------------------------

function HubGrid({ onOpen }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Recycle Hub</h2>
        <p className="text-sm text-slate-500">
          Select a hub to open its AI Smart Recycle Bin console.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Demo hub pinned first */}
        <HubCard hub={DEMO_HUB} location={DEMO_HUB.location} onOpen={onOpen} highlight />
        {COLLECTION_HUBS.map((h) => (
          <HubCard key={h.id} hub={h} location={h.name} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

function HubCard({ hub, location, onOpen, highlight = false }) {
  return (
    <div
      className={`rounded-xl bg-white p-5 shadow-sm ring-1 ${
        highlight ? 'ring-green-200' : 'ring-slate-200'
      }`}
    >
      <h3 className="text-sm font-semibold text-slate-900">{hub.name}</h3>
      <p className="mt-1 font-mono text-xs uppercase text-slate-400">{hub.id.toUpperCase()}</p>
      <p className="mt-2 text-sm text-slate-500">📍 {location}</p>
      <div className="mt-4">
        <Button onClick={() => onOpen(hub)}>Open hub</Button>
      </div>
    </div>
  )
}

// --- small session stat card ----------------------------------------------

function SessionStat({ label, value, accent = 'text-slate-900' }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
    </div>
  )
}
