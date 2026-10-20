import { useEffect, useRef, useState } from 'react'
import { useStore, useTheme } from '../store/StoreContext.jsx'
import { Button } from './ui.jsx'
import BinSvg from './BinSvg.jsx'

// --- model (mirrors the reference Smart Recycle Bin + QR station) ---------
const BAYS = [
  { key: 'PET', label: 'PET', color: '#4fc3f7' },
  { key: 'CAN', label: 'CAN', color: '#ffb23e' },
  { key: 'PAPER', label: 'PAPER', color: '#8bd96b' },
]

// AI-stream items (auto-credited) + human-stream items (operator counter).
const ITEMS = [
  { n: 'PET bottle', itemId: 'pet-bottle', bay: 0, kg: 0.025, add: 9, t: 3, e: '🧴' },
  { n: 'Aluminium can', itemId: 'aluminum-can', bay: 1, kg: 0.015, add: 7, t: 6, e: '🥫' },
  { n: 'Paper carton', itemId: 'paper-carton', bay: 2, kg: 0.03, add: 11, t: 1, e: '🧃' },
  { n: 'Cardboard box', human: true, e: '📦' },
  { n: 'Old microwave', human: true, e: '🔌' },
]

const CHEATS = [
  { b: '🪨 Show PET, drop a stone', real: 'Stone (not PET)', e: '🪨', w: 420 },
  { b: '💧 Bottle filled with water', real: 'PET + liquid', e: '💧', w: 510 },
  { b: '🔁 Re-insert same bottle', real: 'Duplicate: already credited', e: '🔁', w: 25 },
  { b: '🖐 Reach into the slot', real: 'Hand detected', e: '🖐', w: 0 },
]

const RESIDENT = 'Aisyah R.'

export default function SmartBin({ hub, onBack }) {
  const { dispatch } = useStore()
  // The Smart Bin follows the app's global color mode — no separate toggle.
  // Dark mode keeps the amber station look; light mode uses the green look.
  const { colorMode } = useTheme()
  const dark = colorMode === 'dark'
  const timers = useRef([])
  const dataHubId = hub.dataHubId || 'hub-elmina-west'
  const code = hub.code || 'ELM-01'
  const isAuto = hub.type === 'auto'
  const [auto, setAuto] = useState(false) // auto-simulation running

  // session state
  const [fills, setFills] = useState([34, 12, 52]) // bay fill %
  const [linked, setLinked] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(-1) // open bay index
  const [scan, setScan] = useState(-1) // bay being scanned by cam1
  const [c2, setC2] = useState(-1) // bay cam2 active
  const [flag, setFlag] = useState(false)
  const [alert, setAlert] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [cam1, setCam1] = useState(null) // { e, l, ok }
  const [cam2, setCam2] = useState(null)
  const [sessTk, setSessTk] = useState(0)
  const [wallet, setWallet] = useState(1240)
  const [feed, setFeed] = useState([])
  const [strikes, setStrikes] = useState(0)
  const [log, setLog] = useState([])
  const [status, setStatus] = useState('Station ready. Waiting for a resident to scan.')

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); return id }

  const full = fills.some((v) => v >= 80)

  // Latest-value refs so the auto-sim loop never acts on stale state.
  const ref = useRef({})
  ref.current = { linked, busy, connecting, scanQR, drop, cheat, endSession, sessTk }

  // Auto-simulation: link a resident, drop a few random items (with the odd
  // cheat attempt), then end the session — on repeat. Hands-free "any situation".
  useEffect(() => {
    if (!auto) return
    let stop = false
    let dropsThisSession = 0
    const tick = () => {
      if (stop) return
      const s = ref.current
      let delay = 1800
      if (s.busy || s.connecting) {
        delay = 700
      } else if (!s.linked) {
        s.scanQR()
        dropsThisSession = 0
        delay = 1800
      } else if (dropsThisSession >= 4 + Math.floor(Math.random() * 3)) {
        s.endSession()
        delay = 1500
      } else {
        // 20% chance to try a cheat, else drop a valid AI-stream item.
        if (Math.random() < 0.2) {
          s.cheat(CHEATS[Math.floor(Math.random() * CHEATS.length)])
        } else {
          const valid = ITEMS.filter((it) => !it.human)
          s.drop(valid[Math.floor(Math.random() * valid.length)])
        }
        dropsThisSession += 1
        delay = 2600
      }
      const id = setTimeout(tick, delay)
      timers.current.push(id)
    }
    const id = setTimeout(tick, 600)
    timers.current.push(id)
    return () => { stop = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto])

  // Auto hubs start simulating as soon as the console opens.
  useEffect(() => {
    if (isAuto) setAuto(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addLog(d, c, w, r, k) {
    setLog((L) => [
      { time: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), d, c, w, r, k },
      ...L,
    ].slice(0, 8))
  }

  function scanQR() {
    setConnecting(true)
    setStatus('Phone scanned the QR. Pairing with the bin…')
    later(() => {
      setConnecting(false)
      setLinked(true)
      setSessTk(0)
      setFeed([])
      setStrikes(0)
      setStatus('Linked. Anything you drop now is credited straight to your wallet.')
    }, 1300)
  }

  function endSession() {
    const t = sessTk
    setLinked(false)
    setSessTk(0)
    setStatus(`Session ended${t ? `: ${t} tokens were added to the wallet.` : '.'} New QR generated for the next resident.`)
  }

  function drop(item) {
    if (busy) return
    if (!linked) {
      setAlert(true)
      setStatus('Lid locked: scan the QR on the station to start a session first.')
      later(() => setAlert(false), 2200)
      return
    }
    if (item.human) {
      setAlert(true)
      setStatus(`${item.n} is not an AI-stream item. Take it to the staffed counter; the operator credits it to your linked app.`)
      later(() => setAlert(false), 2500)
      return
    }
    if (fills[item.bay] >= 100) {
      setStatus(`${BAYS[item.bay].label} bay is full. Collection already requested.`)
      return
    }
    setBusy(true)
    setScan(item.bay)
    setStatus('Scanning with camera…')

    // Cam 1 — entry identify + grade
    later(() => {
      const r = Math.random()
      const grade = r < 0.7 ? 'A' : r < 0.93 ? 'B' : 'C'
      setOpen(item.bay)
      setCam1({ e: item.e, l: `${item.n} · Grade ${grade}`, ok: true })
      setCam2(null)
      setFlag(false)
      setStatus(`Cam 1 identified: ${item.n} · ${item.kg} kg · Grade ${grade}. Lid open.`)
      item._grade = grade
    }, 800)

    // Cam 2 — inside confirm
    later(() => {
      setC2(item.bay)
      setCam2({ e: item.e, l: `matches · ${Math.round(item.kg * 1000)} g`, ok: true })
      setStatus('Cam 2 inside the bin confirms the item matches.')
    }, 1300)

    // credit
    later(() => {
      const grade = item._grade || 'A'
      const tok = item.t + (grade === 'A' ? 1 : 0)
      setSessTk((v) => v + tok)
      setWallet((v) => v + tok)
      setFeed((f) => [{ n: `${item.n} · ${grade}`, t: tok }, ...f].slice(0, 4))
      setFills((f) => f.map((v, i) => (i === item.bay ? Math.min(100, v + item.add) : v)))
      setOpen(-1); setScan(-1); setC2(-1); setPulse(true)
      const actual = Math.round(item.kg * 1000 * (0.96 + Math.random() * 0.08))
      addLog(item.n, `${item.n} ✓`, `${actual} g (exp ${Math.round(item.kg * 1000)})`, 'APPROVED', `+${tok}`)
      // Feed township metrics with a real drop-off.
      dispatch({ type: 'DROP_OFF', itemId: item.itemId, quantity: 1, hubId: dataHubId })
      setStatus(`+${tok} Green Tokens sent to ${RESIDENT}'s app.` + (fills[item.bay] + item.add >= 80 ? ' Bay nearly full: collection requested.' : ''))
      setBusy(false)
      later(() => setPulse(false), 500)
    }, 1800)
  }

  function cheat(c) {
    if (busy) return
    if (!linked) {
      setAlert(true)
      setStatus('Lid locked: scan the QR first.')
      later(() => setAlert(false), 2200)
      return
    }
    setBusy(true); setScan(0); setFlag(false); setCam2(null)
    setStatus('Cam 1 scanning…')
    later(() => {
      setOpen(0)
      setCam1({ e: '🧴', l: 'PET bottle · Grade A', ok: true })
      setStatus('Cam 1 sees a PET bottle. Lid open.')
    }, 800)
    later(() => {
      setC2(0); setFlag(true); setOpen(-1)
      setCam2({ e: c.e, l: c.real, ok: false })
      setStatus(`Cam 2 inside the bin disagrees with Cam 1: ${c.real}. Lid shut, tokens withheld.`)
    }, 1400)
    later(() => {
      setStrikes((s) => {
        const n = s + 1
        addLog('PET bottle', `${c.real} ✗`, `${c.w} g (exp 25)`, 'FLAGGED', '0 tokens')
        if (n >= 3) {
          addLog('—', '—', '—', 'SUSPENDED', 'operator alerted')
          setLinked(false)
          setSessTk(0)
          setStatus('3 flagged attempts: session suspended and the operator has been alerted.')
        }
        return n
      })
      setScan(-1); setC2(-1); setBusy(false)
      later(() => setFlag(false), 1500)
    }, 2200)
  }

  function collect() {
    setFills((f) => f.map((v) => (v >= 80 ? 0 : v)))
    setStatus('Collector emptied the full bays.')
  }

  // theme tokens
  const T = dark
    ? {
        page: 'bg-[#0d1117] text-[#e8edf3]',
        panel: 'bg-[#141a23] ring-[#3b4656]',
        mute: 'text-[#8b98a8]',
        amb: '#ffb23e',
        btn: 'bg-[#141a23] text-[#e8edf3] ring-[#3b4656] hover:ring-[#ffb23e]',
        logbg: 'bg-[#141a23] ring-[#3b4656]',
        accent: 'text-[#ffb23e]',
      }
    : {
        page: 'bg-white text-slate-800',
        panel: 'bg-slate-50 ring-slate-200',
        mute: 'text-slate-500',
        amb: '#16a34a',
        btn: 'bg-white text-slate-700 ring-slate-300 hover:ring-green-500',
        logbg: 'bg-white ring-slate-200',
        accent: 'text-green-600',
      }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>← Back to hub grid</Button>
        <div className="flex items-center gap-2">
          {isAuto && (
            <button
              onClick={() => setAuto((a) => !a)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${
                auto ? 'bg-sky-600 text-white ring-sky-600' : 'bg-white text-sky-700 ring-sky-300'
              }`}
            >
              {auto ? '⏸ Pause simulation' : '▶ Run simulation'}
            </button>
          )}
        </div>
      </div>

      <div className={`rounded-2xl p-4 ring-1 ${T.page} ${dark ? 'ring-[#222b38]' : 'ring-slate-200'}`}>
        <h1 className="text-lg font-bold">Smart Recycle Bin + QR Station — {hub.name}</h1>
        <p className={`text-sm ${T.mute}`}>
          Scan the station QR to link your phone, then drop items. Tokens land in your app instantly. · Hub {code}
        </p>

        {/* Bin on the LEFT, controls on the RIGHT — neat side-by-side layout */}
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {/* LEFT: isometric bin + phone app */}
          <div className="space-y-3 self-start">
            <BinSvg fills={fills} open={open} scan={scan} c2={c2} linked={linked} connecting={connecting}
              flag={flag} alert={alert} pulse={pulse} tk={sessTk} resident={RESIDENT} code={code} dark={dark} />
            <div className={`rounded-[22px] p-4 ring-2 ${dark ? 'bg-[#141a23] ring-[#3b4656]' : 'bg-white ring-slate-300'}`}>
              <p className="text-sm font-semibold">📱 Green Token app</p>
              {!linked ? (
                <>
                  <p className={`my-4 text-sm ${T.mute}`}>
                    {connecting ? `Connecting to station ${code}…` : 'Point your camera at the QR code on the station to start a session.'}
                  </p>
                  <p className={`text-xs ${T.mute}`}>Wallet</p>
                  <p className="text-3xl font-bold" style={{ color: T.amb }}>{wallet.toLocaleString()}</p>
                </>
              ) : (
                <>
                  <p className={dark ? 'text-[#4be08a]' : 'gl-num-pos text-green-600'}>● Linked to {code}</p>
                  <p className={`text-xs ${T.mute}`}>{RESIDENT} · City of Elmina</p>
                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <p className={`text-xs ${T.mute}`}>Wallet</p>
                      <p className="text-3xl font-bold" style={{ color: T.amb }}>{wallet.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className={`mt-2 text-xs ${T.mute}`}>This session</p>
                  {feed.length === 0 ? (
                    <p className={`text-sm ${T.mute}`}>No drops yet</p>
                  ) : (
                    feed.map((e, i) => (
                      <div key={i} className={`flex items-center justify-between border-b py-1.5 text-sm ${dark ? 'border-[#3b4656]' : 'border-slate-100'}`}>
                        <span>{e.n}</span>
                        <b className={dark ? 'text-[#4be08a]' : 'gl-num-pos text-green-600'}>+{e.t}</b>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT: controls */}
          <div>
            <div className="flex flex-wrap gap-2">
              <button onClick={scanQR} disabled={linked || connecting}
                className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: T.amb, color: dark ? '#1a1200' : '#fff' }}>
                📱 Scan QR with phone
              </button>
              <button onClick={endSession} disabled={!linked}
                className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 disabled:opacity-50 ${T.btn}`}>
                End session
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {ITEMS.map((it, i) => (
                <button key={i} onClick={() => drop(it)}
                  className={`rounded-lg px-3 py-2 text-sm ring-1 ${T.btn} ${it.human ? 'border-dashed' : ''}`}
                  style={it.human ? { borderStyle: 'dashed' } : undefined}>
                  {it.e} {it.n}
                </button>
              ))}
            </div>

            <p className={`mt-3 text-xs ${T.mute}`}>Try to cheat the bin:</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {CHEATS.map((c, i) => (
                <button key={i} onClick={() => cheat(c)}
                  className={`rounded-lg border-dashed px-3 py-2 text-sm ring-1 ${T.btn}`} style={{ borderStyle: 'dashed' }}>
                  {c.b}
                </button>
              ))}
            </div>

            {/* cam tiles */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <CamTile title="CAM 1 · ENTRY" f={cam1} dark={dark} />
              <CamTile title="CAM 2 · INSIDE" f={cam2} dark={dark} />
            </div>

            <div className={`mt-3 rounded-lg px-3 py-2.5 text-sm ring-1 ${T.logbg}`}>{status}</div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={collect} disabled={!full}
                className={`rounded-lg px-3 py-2 text-sm ring-1 disabled:opacity-50 ${T.btn}`}>
                Collector: empty bays over 80%
              </button>
            </div>

            {/* event log */}
            <div className={`mt-3 rounded-lg p-3 ring-1 ${T.logbg}`}>
              <p className="text-sm font-semibold">
                Event log {strikes > 0 && <span className={`text-xs ${T.mute}`}>· strikes {strikes}/3</span>}
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={T.mute}>
                      <th className="py-1 pr-3 font-medium">Time</th>
                      <th className="py-1 pr-3 font-medium">Cam 1 (entry)</th>
                      <th className="py-1 pr-3 font-medium">Cam 2 (inside)</th>
                      <th className="py-1 pr-3 font-medium">Weight</th>
                      <th className="py-1 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.length === 0 ? (
                      <tr><td colSpan={5} className={`py-2 ${T.mute}`}>No events yet</td></tr>
                    ) : (
                      log.map((l, i) => (
                        <tr key={i} className={dark ? 'border-t border-[#2a3442]' : 'border-t border-slate-100'}>
                          <td className="py-1.5 pr-3 font-mono">{l.time}</td>
                          <td className="py-1.5 pr-3">{l.d}</td>
                          <td className="py-1.5 pr-3">{l.c}</td>
                          <td className="py-1.5 pr-3">{l.w}</td>
                          <td className="py-1.5">
                            <span className={`font-bold ${l.r === 'APPROVED' ? (dark ? 'text-[#4be08a]' : 'gl-num-pos text-green-600') : 'gl-num-neg text-red-500'}`}>{l.r}</span> {l.k}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CamTile({ title, f, dark }) {
  const base = dark ? 'bg-[#05080c] ring-[#3b4656] text-[#8b98a8]' : 'bg-slate-50 ring-slate-200 text-slate-500'
  const tone = f ? (f.ok ? (dark ? 'ring-[#4be08a]' : 'ring-green-400') : 'ring-red-400 text-red-400') : ''
  return (
    <div className={`rounded-lg p-2 text-center text-xs ring-1 ${base} ${tone}`}>
      {title}
      <div className="text-3xl leading-tight">{f ? f.e : '–'}</div>
      <span>{f ? f.l : 'idle'}</span>
    </div>
  )
}
