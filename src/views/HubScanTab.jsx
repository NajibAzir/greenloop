import { useRef, useState } from 'react'
import { useStore, useAccount } from '../store/StoreContext.jsx'
import { Button, Card, CardHeader } from '../components/ui.jsx'
import { GPBalance } from './ResidentView.jsx'
import { computeDropoff, formatGP } from '../lib/engine.js'

const SCAN_ITEMS = [
  { itemId: 'pet-bottle', emoji: '🧴', n: 'PET bottle' },
  { itemId: 'aluminum-can', emoji: '🥫', n: 'Aluminium can' },
  { itemId: 'paper-carton', emoji: '🧃', n: 'Paper carton' },
]

export default function HubScanTab() {
  const { state, dispatch } = useStore()
  const account = useAccount()
  const [hub, setHub] = useState(null)
  const [connecting, setConnecting] = useState(null)
  const [pending, setPending] = useState([])
  const [done, setDone] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('Scan a hub QR to start a recycling session.')
  const timers = useRef([])

  function scan(h) {
    if (busy) return
    setConnecting(h.id)
    setMsg('Scanning QR… pairing with ' + h.name)
    const id = setTimeout(() => {
      setHub(h)
      setConnecting(null)
      setPending([])
      setDone([])
      setMsg('Connected to ' + h.name + '. Show items to the hub camera, then deposit.')
    }, 1100)
    timers.current.push(id)
  }

  function recycle(itemId) {
    if (!hub || busy) return
    setBusy(true)
    setMsg('Hub camera is checking your item…')
    const id = setTimeout(() => {
      setBusy(false)
      if (Math.random() < 0.08) {
        setMsg('❌ Item rejected — contamination / unrecognised material. Not credited.')
        return
      }
      const it = SCAN_ITEMS.find((s) => s.itemId === itemId)
      setPending((p) => [...p, it])
      setMsg('✅ ' + it.n + ' accepted. Deposit when ready (+GP on deposit).')
    }, 700)
    timers.current.push(id)
  }

  function cheat() {
    if (!hub || busy) return
    setBusy(true)
    setMsg('Hub camera is checking your item…')
    const id = setTimeout(() => {
      setBusy(false)
      setMsg('❌ Rejected: not an accepted recyclable (stone / liquid / mixed material). 0 GP.')
    }, 700)
    timers.current.push(id)
  }

  function deposit() {
    if (!hub || pending.length === 0 || busy) return
    const groups = {}
    pending.forEach((p) => { groups[p.itemId] = (groups[p.itemId] || 0) + 1 })
    const results = []
    Object.entries(groups).forEach(([itemId, quantity]) => {
      const r = computeDropoff(itemId, quantity)
      dispatch({ type: 'DROP_OFF', itemId, quantity, hubId: hub.id })
      results.push({ emoji: SCAN_ITEMS.find((s) => s.itemId === itemId).emoji, n: r.name || SCAN_ITEMS.find((s) => s.itemId === itemId).n, quantity, gp: r.tokensAwarded })
    })
    setDone((d) => [...results, ...d])
    setPending([])
    setMsg('Deposited ' + results.reduce((s, r) => s + r.quantity, 0) + ' item(s). +' + results.reduce((s, r) => s + r.gp, 0) + ' GP credited to your wallet.')
  }

  function end() {
    setHub(null)
    setPending([])
    setMsg('Session ended. Scan another hub QR to recycle more.')
  }

  return (
    <div className="space-y-5">
      <GPBalance balance={account?.tokenBalance ?? 0} />

      {!hub ? (
        <Card>
          <CardHeader title="Scan Hub QR" subtitle="Pick a Recycle Hub to simulate scanning its QR code" />
          <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
            {state.hubs.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">♻️ {h.name}</p>
                  <p className="text-xs text-slate-500">{h.location}</p>
                  <p className="font-mono text-[11px] text-slate-400">{h.id}</p>
                </div>
                <Button onClick={() => scan(h)} disabled={connecting !== null}>
                  {connecting === h.id ? 'Linking…' : '📷 Scan QR'}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={hub.name}
            subtitle={<span>📍 {hub.location} · <span className="font-mono">{hub.id}</span></span>}
            right={<span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">● Connected</span>}
          />
          <div className="space-y-4 px-5 py-4">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-100">{msg}</p>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">1 · Show item to hub camera</p>
              <div className="flex flex-wrap gap-2">
                {SCAN_ITEMS.map((s) => (
                  <Button key={s.itemId} variant="secondary" onClick={() => recycle(s.itemId)} disabled={busy}>
                    {s.emoji} {s.n}
                  </Button>
                ))}
                <Button variant="secondary" onClick={cheat} disabled={busy}>🪨 Try to cheat</Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">2 · Drop into hub</p>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                <span className="text-sm text-slate-600">{pending.length} item(s) on the tray</span>
                <div className="flex gap-2">
                  <Button onClick={deposit} disabled={pending.length === 0 || busy}>♻️ Deposit & earn GP</Button>
                  <Button variant="secondary" onClick={end}>End session</Button>
                </div>
              </div>
            </div>

            {done.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Items recycled successfully at this hub
                </p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {done.map((r, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{r.emoji} {r.quantity} × {r.n}</span>
                      <span className="font-semibold text-green-600">+{formatGP(r.gp)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}