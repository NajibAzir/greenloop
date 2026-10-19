import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { Button, Card, CardHeader } from '../components/ui.jsx'
import CameraScan from '../components/CameraScan.jsx'
import { useBinSim, BinSVG, BIN_ITEMS, BAYS } from '../components/SmartBin.jsx'

// ---------------------------------------------------------------------------
// CAM 1 detection panel — live camera (friend's CameraScan) OR buttons.
// Detects PET bottle / aluminium can / paper carton; anything else = error.
// ---------------------------------------------------------------------------
const camBtn =
  'rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'

function Cam1Panel({ onDetect }) {
  const [live, setLive] = useState(false)
  const mapId = (itemId) =>
    itemId === 'pet-bottle' ? 'pet' : itemId === 'aluminum-can' ? 'can' : itemId === 'paper-carton' ? 'carton' : 'error'
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cam 1 · Entry detection</p>
        <button onClick={() => setLive((v) => !v)} className="text-xs font-semibold text-green-700 hover:underline">
          {live ? 'Use buttons instead' : '📷 Use live camera'}
        </button>
      </div>
      {live ? (
        <CameraScan
          onAccepted={(res) => {
            if (res?.items) res.items.forEach((it) => onDetect(mapId(it.itemId)))
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {BIN_ITEMS.map((it) => (
            <button key={it.key} className={camBtn} onClick={() => onDetect(it.key)}>
              {it.emoji} {it.n}
            </button>
          ))}
          <button className={camBtn + ' !text-red-600 !ring-red-200'} onClick={() => onDetect('error')}>
            ❌ Other (error)
          </button>
        </div>
      )}
      <p className="text-[11px] text-slate-400">
        Cam 1 accepts PET bottle, aluminium can and paper carton. Any other material is rejected before the door opens.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accent || 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function EventLog({ events }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-400">
            <th className="py-2 pr-2 font-medium">Time</th>
            <th className="py-2 pr-2 font-medium">Cam 1 (entry)</th>
            <th className="py-2 pr-2 font-medium">Cam 2 (inside)</th>
            <th className="py-2 pr-2 font-medium">Weight</th>
            <th className="py-2 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr><td colSpan="5" className="py-4 text-center text-slate-400">No events yet</td></tr>
          ) : (
            events.map((e, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-2 tabular-nums text-slate-500">{e.t}</td>
                <td className="py-2 pr-2 text-slate-600">{e.cam1}</td>
                <td className="py-2 pr-2 text-slate-600">{e.cam2}</td>
                <td className="py-2 pr-2 tabular-nums text-slate-500">{e.weight}</td>
                <td className="py-2">
                  <span className={`font-semibold ${e.result === 'APPROVED' || e.result === 'RETURNED' ? 'text-green-600' : e.result === 'DOOR CLOSED' ? 'text-slate-500' : 'text-red-500'}`}>
                    {e.result}
                  </span>{' '}
                  <span className="text-slate-400">{e.note}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HUB 1 (manual) — full Smart Recycle Bin demo
// Layout: GP + details top · isometric bin LEFT · controls RIGHT · log BOTTOM
// ---------------------------------------------------------------------------
function ManualHub({ hub, dispatch }) {
  const sim = useBinSim({ hubId: hub.id, dispatch })
  const { st } = sim
  const full = st.fills.some((f) => f >= 80)
  const act = st.door.open && !st.scan2 && !st.ret

  return (
    <div className="space-y-4">
      {/* top: GP token + details */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Green Point (GP) — this session" value={`+${st.tokens}`} accent="text-green-600" />
        <Stat label="Items accepted" value={st.items} />
        <Stat label="Weight collected" value={`${st.kg.toFixed(2)} kg`} />
        <Stat label="Flag strikes" value={`${st.strikes}/3`} accent={st.strikes > 0 ? 'text-red-600' : undefined} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* LEFT: isometric bin */}
        <div className="rounded-2xl bg-slate-900 p-2 lg:w-[46%]">
          <BinSVG st={st} />
          <p className={`px-3 pb-3 text-xs ${st.flag || st.ret ? 'text-red-300' : 'text-slate-400'}`}>{st.status}</p>
        </div>

        {/* RIGHT: scan → drop-off → collector controls + CAM 1 */}
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={sim.linkPhone} disabled={st.linked || st.connecting} className="flex-1">
              📱 {st.connecting ? 'Pairing…' : st.linked ? 'Phone linked' : 'Scan QR with phone'}
            </Button>
            <Button variant="secondary" onClick={sim.endSession} disabled={!st.linked || st.door.open || st.scan2}>
              End session
            </Button>
          </div>

          <Cam1Panel onDetect={sim.cam1} />

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">2 · Put items into the open bay</p>
            <div className="flex flex-wrap gap-2">
              <button className={camBtn} onClick={() => sim.dropN(1, 'ok')} disabled={!act}>Drop 1 item</button>
              <button className={camBtn} onClick={() => sim.dropN(10, 'ok')} disabled={!act}>Drop 10 items</button>
              <button className={camBtn + ' !border-dashed'} onClick={() => sim.dropN(10, 'wrong')} disabled={!act}>
                10 incl. 1 wrong material
              </button>
              <button className={camBtn} onClick={() => sim.closeDoor('closed by user')} disabled={!st.door.open || st.ret}>
                Close door
              </button>
              <button className={camBtn + ' !text-amber-700 !ring-amber-300'} onClick={sim.takeBack} disabled={!st.ret}>
                ↩ Take item back
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Try to cheat</p>
            <div className="flex flex-wrap gap-2">
              <button className={camBtn + ' !border-dashed'} onClick={() => sim.dropN(1, 'stone')} disabled={!act}>🪨 Drop a stone</button>
              <button className={camBtn + ' !border-dashed'} onClick={() => sim.dropN(1, 'water')} disabled={!act}>💧 Water-filled bottle</button>
            </div>
          </div>

          <Button variant="secondary" onClick={sim.collect} disabled={!full} className="w-full">
            🚛 Collector: empty bays over 80%
          </Button>
          <p className="text-[11px] text-slate-400">
            Bay levels: {BAYS.map((b, i) => `${b.n} ${Math.round(st.fills[i])}%`).join(' · ')}
          </p>
        </div>
      </div>

      {/* BOTTOM: event log */}
      <Card>
        <CardHeader title="Event Log" subtitle="Cam 1 entry check · Cam 2 tray verification · weight audit" />
        <div className="px-5 py-3"><EventLog events={st.events} /></div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HUBs 2–4 (automatic) — isometric view LEFT · GP + details TOP · log RIGHT
// ---------------------------------------------------------------------------
function AutoHub({ hub, dispatch }) {
  const sim = useBinSim({ hubId: hub.id, dispatch, auto: true })
  const { st } = sim
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Green Point (GP) — today" value={`+${st.tokens}`} accent="text-green-600" />
        <Stat label="Items accepted" value={st.items} />
        <Stat label="Weight collected" value={`${st.kg.toFixed(2)} kg`} />
        <Stat label="Status" value="● Live" accent="text-green-600" />
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="rounded-2xl bg-slate-900 p-2 lg:w-1/2">
          <BinSVG st={{ ...st, linked: true }} />
          <p className="px-3 pb-3 text-xs text-slate-400">{st.status}</p>
        </div>
        <div className="flex-1">
          <Card>
            <CardHeader title="Event Log" subtitle="Automatic simulation — residents scan the hub QR and recycle autonomously" />
            <div className="px-5 py-3"><EventLog events={st.events} /></div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hub grid + Register Hub
// ---------------------------------------------------------------------------
export default function RecycleHubs() {
  const { state, dispatch } = useStore()
  const [sel, setSel] = useState(null)
  const [reg, setReg] = useState(false)
  const [hname, setHname] = useState('')
  const [hloc, setHloc] = useState('')

  const hub = state.hubs.find((h) => h.id === sel)

  function register(e) {
    e.preventDefault()
    if (!hname.trim() || !hloc.trim()) return
    dispatch({ type: 'REGISTER_HUB', name: hname.trim(), location: hloc.trim() })
    setHname(''); setHloc(''); setReg(false)
  }

  return (
    <div className="space-y-5">
      {!hub ? (
        <>
          <Card>
            <CardHeader
              title="Registered Recycle Hubs"
              subtitle="Select a hub to open its Smart Recycle Bin — Hub 1 is the manual demo, the rest run live simulations"
              right={
                <Button onClick={() => setReg(true)}>＋ Register Hub</Button>
              }
            />
            <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
              {state.hubs.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSel(h.id)}
                  className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-green-400 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">♻️ {h.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${h.mode === 'manual' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {h.mode === 'manual' ? 'MANUAL DEMO' : 'AUTOMATIC'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">📍 {h.location}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">{h.id}</p>
                </button>
              ))}
            </div>
          </Card>

          {reg && (
            <Card>
              <CardHeader title="Register New Hub" subtitle="The Hub ID is generated automatically when you save" />
              <form onSubmit={register} className="space-y-4 px-5 py-4">
                <div><label className="mb-1 block text-xs font-semibold text-slate-600">Hub Name</label>
                  <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={hname} onChange={(e) => setHname(e.target.value)} placeholder="e.g. Riverside Hub" /></div>
                <div><label className="mb-1 block text-xs font-semibold text-slate-600">Hub Location</label>
                  <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={hloc} onChange={(e) => setHloc(e.target.value)} placeholder="e.g. Riverside Promenade" /></div>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-100">
                  Next ID: <span className="font-mono font-semibold">HUB-{String(state.hubs.length + 1).padStart(9, '0')}</span>
                </p>
                <div className="flex gap-2">
                  <Button type="submit">Save</Button>
                  <Button type="button" variant="secondary" onClick={() => setReg(false)}>Cancel</Button>
                </div>
              </form>
            </Card>
          )}
        </>
      ) : (
        <>
          <button onClick={() => setSel(null)} className="text-sm font-semibold text-green-700 hover:underline">
            ← Back to hub grid
          </button>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{hub.name}</h3>
            <p className="text-sm text-slate-500">📍 {hub.location} · <span className="font-mono">{hub.id}</span></p>
          </div>
          {hub.mode === 'manual' ? <ManualHub hub={hub} dispatch={dispatch} /> : <AutoHub hub={hub} dispatch={dispatch} />}
        </>
      )}
    </div>
  )
}