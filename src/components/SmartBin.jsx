import { useEffect, useMemo, useRef, useState } from 'react'
import { computeDropoff } from '../lib/engine.js'

// ---------------------------------------------------------------------------
// Simulation model
// ---------------------------------------------------------------------------
export const BIN_ITEMS = [
  { key: 'pet', n: 'PET bottle', bay: 0, kg: 25, add: 9, itemId: 'pet-bottle', emoji: '🧴' },
  { key: 'can', n: 'Aluminium can', bay: 1, kg: 15, add: 7, itemId: 'aluminum-can', emoji: '🥫' },
  { key: 'carton', n: 'Paper carton', bay: 2, kg: 30, add: 11, itemId: 'paper-carton', emoji: '🧃' },
]
export const BAYS = [
  { n: 'PET', col: '#3b82f6' },
  { n: 'CAN', col: '#f59e0b' },
  { n: 'PAPER', col: '#22c55e' },
]

const fresh = () => ({
  linked: false, connecting: false,
  fills: [34, 12, 52],
  door: { open: false, type: -1 },
  scan1: -1, scan2: false,
  cam1label: null,
  tray: { n: 0, held: [] },
  ret: false, flag: false,
  strikes: 0, tokens: 0, kg: 0, items: 0,
  events: [], t: 15,
  status: 'Station ready. Waiting for a resident to scan.',
})

const mkEv = (cam1, cam2, weight, result, note) => ({
  t: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  cam1, cam2, weight, result, note,
})
const pushEv = (s, e) => ({ ...s, events: [e, ...s.events].slice(0, 14) })

export function useBinSim({ hubId, dispatch, auto = false }) {
  const [st, setSt] = useState(fresh)
  const stRef = useRef(st)
  useEffect(() => { stRef.current = st }, [st])
  const timers = useRef([])
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Door auto-close countdown (manual mode only).
  useEffect(() => {
    if (auto || !st.door.open || st.ret) return
    if (st.t <= 0) { closeDoor('auto-closed: no activity for 15 s'); return }
    const id = setTimeout(() => setSt((s) => ({ ...s, t: s.t - 1 })), 1000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.door.open, st.t, st.ret, auto])

  // Automatic hub simulation: residents scan & recycle on their own.
  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => {
      const s = stRef.current
      const it = BIN_ITEMS[Math.floor(Math.random() * 3)]
      const qty = 1 + Math.floor(Math.random() * 3)
      if (s.fills[it.bay] >= 100) return
      if (Math.random() < 0.1) {
        setSt(pushEv({ ...s, status: `Cam 2 flagged a foreign item in the ${BAYS[it.bay].n} bay — operator notified.` },
          mkEv(it.n + ' stream', '❓ foreign object', '—', 'FLAGGED', '0 GP · operator review')))
        return
      }
      const r = computeDropoff(it.itemId, qty)
      const fills = [...s.fills]
      fills[it.bay] = Math.min(100, fills[it.bay] + qty * it.add * 0.6)
      setSt(pushEv({
        ...s, fills,
        tokens: s.tokens + r.tokensAwarded, kg: s.kg + r.totalWeight, items: s.items + qty,
        status: `Resident recycled ${it.n} ×${qty} — approved, +${r.tokensAwarded} GP.`,
      }, mkEv(it.emoji + ' ×' + qty, it.n + ' ✓', r.totalWeight.toFixed(2) + ' kg', 'APPROVED', '+' + r.tokensAwarded + ' GP')))
      dispatch({ type: 'OPS_DROP', hubId, itemId: it.itemId, quantity: qty })
    }, 2400)
    return () => clearInterval(id)
  }, [auto, hubId, dispatch])

  function linkPhone() {
    const s = stRef.current
    if (s.linked || s.connecting) return
    setSt({ ...s, connecting: true, status: 'Phone scanned the QR. Pairing with the bin…' })
    later(() => setSt((cur) => ({
      ...cur, connecting: false, linked: true,
      status: 'Linked. Show your items to Cam 1 — only the matching door will open.',
    })), 1200)
  }

  function endSession() {
    const s = stRef.current
    setSt({ ...fresh(), events: s.events, fills: s.fills, status: 'Session ended. New QR generated for the next resident.' })
  }

  function cam1(itemKey) {
    const s = stRef.current
    if (s.scan1 >= 0 || s.scan2 || s.connecting) return
    if (itemKey === 'error') {
      setSt(pushEv({ ...s, status: 'Cam 1: item NOT recognised. Only PET bottle, aluminium can and paper carton are accepted here.' },
        mkEv('❌ unknown item', 'rejected at entry', '—', 'REJECTED', 'not an accepted material')))
      return
    }
    const it = BIN_ITEMS.find((i) => i.key === itemKey)
    if (!it) return
    if (s.door.open) {
      if (s.door.type === it.bay) { setSt({ ...s, t: 15, status: `The ${BAYS[it.bay].n} door is already open — add your items.` }); return }
      setSt({ ...s, status: `The ${BAYS[s.door.type].n} door is open. Close it before scanning a different type.` })
      return
    }
    if (s.fills[it.bay] >= 100) { setSt({ ...s, status: `${BAYS[it.bay].n} bay is full — collection already requested.` }); return }
    setSt({ ...s, scan1: it.bay, status: 'Cam 1 scanning your item…' })
    later(() => {
      const cur = stRef.current
      setSt({
        ...cur, scan1: -1, door: { open: true, type: it.bay }, t: 15,
        cam1label: it.emoji + ' ' + it.n,
        status: `Cam 1 identified ${it.n}. Only the ${BAYS[it.bay].n} door is open (closes after 15 s idle).`,
      })
    }, 900)
  }

  function dropN(n, kind) {
    const s = stRef.current
    if (!s.door.open || s.ret || s.scan2) return
    const tray = { n: s.tray.n, held: [...s.tray.held] }
    if (kind === 'ok') tray.n += n
    else if (kind === 'wrong') {
      tray.n += n - 1
      const oth = BIN_ITEMS[(s.door.type + 1 + Math.floor(Math.random() * 2)) % 3]
      tray.held.push({ n: oth.n, emoji: oth.emoji, mix: true })
    } else {
      tray.held.push(kind === 'stone' ? { n: 'Stone', emoji: '🪨' } : { n: 'Bottle with liquid', emoji: '💧' })
    }
    const c = tray.n + tray.held.length
    setSt({ ...s, tray, t: 15, status: `${c} item(s) on the tray. Cam 2 scans only after the door closes.` })
  }

  function takeBack() {
    const s = stRef.current
    if (!s.ret) return
    setSt(pushEv({ ...s, ret: false, flag: false, tray: { n: s.tray.n, held: [] }, t: 15, status: 'Item taken back. Add more items, or close the door so Cam 2 can rescan.' },
      mkEv('—', s.tray.held[0]?.n || 'held item', '—', 'RETURNED', 'user took it back')))
  }

  function closeDoor(why) {
    const s = stRef.current
    if (!s.door.open || s.scan2) return
    const ty = s.door.type
    if (s.ret) {
      setSt(pushEv({
        ...s, ret: false, flag: false, strikes: s.strikes + 1,
        tray: { n: 0, held: [] }, door: { open: false, type: -1 },
        status: 'Flagged item not taken back — tray held for the operator. Door closed.',
      }, mkEv('—', s.tray.held[0]?.n || 'held item', '—', 'FLAGGED', 'not taken back · held for operator')))
      return
    }
    const has = s.tray.n + s.tray.held.length > 0
    const base = { ...s, door: { open: false, type: -1 } }
    if (!has) { setSt({ ...base, status: `Door closed (${why}). Tray empty.` }); return }
    setSt({ ...base, scan2: true, status: `Door closed (${why}). Cam 2 is scanning the tray…` })
    later(() => resolveTray(ty), 1400)
  }

  function resolveTray(ty) {
    const s = stRef.current
    const it = BIN_ITEMS[ty]
    const held = s.tray.held[0] || null
    const acc = s.tray.n
    const wexp = acc * it.kg
    const extra = s.tray.held.reduce((a, h) => a + (h.n === 'Stone' ? 420 : h.n === 'Bottle with liquid' ? 510 : 30), 0)
    const wact = Math.round(wexp * (0.97 + Math.random() * 0.06)) + extra
    if (held) {
      const strikes = held.mix ? s.strikes : s.strikes + 1
      setSt(pushEv({
        ...s, scan2: false, flag: true, ret: true, strikes,
        door: { open: true, type: ty }, t: 15,
        status: `Cam 2 found a different material: ${held.n}. Door re-opened — take it back, then close the door to rescan.`,
      }, mkEv(it.n + ' stream', `${held.emoji} ${held.n} ✗`, `${wact} g (exp ${wexp} g)`, 'FLAGGED', '0 GP until taken back')))
      return
    }
    const r = computeDropoff(it.itemId, acc)
    const fills = [...s.fills]
    fills[ty] = Math.min(100, fills[ty] + acc * it.add * 0.6)
    setSt(pushEv({
      ...s, scan2: false, fills,
      tokens: s.tokens + r.tokensAwarded, kg: s.kg + r.totalWeight, items: s.items + acc,
      tray: { n: 0, held: [] },
      status: `Cam 2 confirmed ${acc} × ${it.n}. +${r.tokensAwarded} GP sent to the app.`,
    }, mkEv(it.n + ' stream', `${acc} × ${it.n} ✓`, `${r.totalWeight.toFixed(2)} kg (exp ${(wexp / 1000).toFixed(2)} kg)`, 'APPROVED', '+' + r.tokensAwarded + ' GP')))
    dispatch({ type: 'OPS_DROP', hubId, itemId: it.itemId, quantity: acc })
  }

  function collect() {
    const s = stRef.current
    if (!s.fills.some((f) => f >= 80)) return
    setSt({ ...s, fills: s.fills.map((f) => (f >= 80 ? 0 : f)), status: 'Collector emptied the full bays.' })
  }

  return { st, linkPhone, endSession, cam1, dropN, takeBack, closeDoor, collect }
}

// ---------------------------------------------------------------------------
// Isometric bin rendering (ported from the standalone Smart Recycle Bin sim)
// ---------------------------------------------------------------------------
const X = 120, Y = 50, H = 84, sc = 2, ox = 330, oy = 222
const c = 0.866 * sc, hh = 0.5 * sc
const P = (x, y, z) => [ox + (x - y) * c, oy + (x + y) * hh - z * sc]
const pts = (a) => a.map((p) => P(...p).map((n) => n.toFixed(1)).join(',')).join(' ')

const Poly = ({ a, cls, style }) => <polygon points={pts(a)} className={cls} style={style} />
const Box = ({ x0, y0, z0, x1, y1, z1 }) => (
  <>
    <Poly a={[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]} cls="f" />
    <Poly a={[[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]} cls="f" />
    <Poly a={[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]} cls="f t" />
  </>
)

const SVG_CSS = `
.f{fill:#182030;stroke:#3b4656;stroke-width:1.1;stroke-linejoin:round}
.t{fill:#212c3d}.d{fill:#101722}
.thin{fill:none;stroke:#3b4656;stroke-width:.9}
.slot{fill:#04070a;stroke:#3b4656}
.slot.on{stroke:#f59e0b;filter:url(#gbin)}
.cover{fill:#2a3547;stroke:#3b4656;stroke-width:1.1;stroke-linejoin:round}
.beam{fill:#f59e0b;opacity:.28;filter:url(#gbin)}
`

function makeQr() {
  let a = 7 * 977 + 13
  const rng = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const q = 1.15
  let s = ''
  for (let j = 0; j < 21; j++)
    for (let i = 0; i < 21; i++) {
      const fd = i < 7 && j < 7 ? [i, j] : i > 13 && j < 7 ? [i - 14, j] : i < 7 && j > 13 ? [i, j - 14] : null
      const on = fd ? Math.max(Math.abs(fd[0] - 3), Math.abs(fd[1] - 3)) !== 2 : rng() > 0.52
      if (on) s += `<rect x="${(8.4 + i * q).toFixed(2)}" y="${(-59.6 + j * q).toFixed(2)}" width="${(q + 0.03).toFixed(2)}" height="${(q + 0.03).toFixed(2)}" fill="#0b0f14"/>`
    }
  return s
}

export function BinSVG({ st }) {
  const full = st.fills.some((f) => f >= 80)
  const L = P(60, 20, H + 7)
  const gL = `matrix(${c} ${hh} 0 ${sc} ${ox - Y * c} ${oy + Y * hh})`
  const gR = (xp, ym) => `matrix(${c} ${-hh} 0 ${sc} ${ox + (xp - ym) * c} ${oy + (xp + ym) * hh})`
  const qr = useMemo(makeQr, [])

  const statusText = st.ret
    ? 'TAKE ITEM BACK'
    : st.flag
      ? 'FLAGGED: ITEM MISMATCH'
      : !st.linked
        ? 'SCAN QR TO START'
        : st.door.open
          ? `${BAYS[st.door.type].n} DOOR OPEN · ${st.t}s · ${st.tray.n + st.tray.held.length} ITEMS`
          : st.scan2
            ? 'DOOR CLOSED · CAM 2 SCANNING'
            : st.scan1 >= 0
              ? 'CAM 1 SCANNING…'
              : 'SHOW ITEM TO CAM 1'
  const statusCol = st.ret || st.flag ? '#f87171' : st.linked ? '#4be08a' : '#ffb23e'

  return (
    <svg viewBox="0 0 660 440" className="block h-auto w-full" role="img" aria-label="Isometric smart recycling bin with QR link station">
      <style>{SVG_CSS}</style>
      <defs>
        <filter id="gbin" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <polygon points={pts([[-28, -28, 0], [165, -28, 0], [165, 60, 0], [-28, 60, 0]])} fill="none" stroke="#202938" strokeWidth="1" />
      {/* data conduit bin->kiosk */}
      <polyline points={pts([[X + 3, 24, 1], [134, 24, 1]])} fill="none" stroke={st.linked ? '#ffb23e' : '#2a3442'} strokeWidth={st.linked ? 3.4 : 2.2} filter={st.linked ? 'url(#gbin)' : undefined} />

      {/* bin */}
      <Box x0={-3} y0={-3} z0={0} x1={X + 3} y1={Y + 3} z1={6} />
      <Box x0={0} y0={0} z0={6} x1={X} y1={Y} z1={H} />
      {[40, 80].map((x) => (
        <polyline key={x} className="thin" points={pts([[x, Y, 6], [x, Y, H], [x, 0, H]])} />
      ))}

      {/* solar pod, mast, scanner */}
      <Poly a={[[80, 3, H + 9], [116, 3, H + 9], [116, 22, H + 2], [80, 22, H + 2]]} cls="f" style={{ fill: '#0e2a4a' }} />
      {[1, 2, 3].map((i) => (
        <polyline key={i} className="thin" points={pts([[80 + i * 9, 3, H + 9], [80 + i * 9, 22, H + 2]])} style={{ stroke: '#2f5f95' }} />
      ))}
      <polyline className="thin" points={pts([[80, 12.5, H + 5.5], [116, 12.5, H + 5.5]])} style={{ stroke: '#2f5f95' }} />
      <polyline className="thin" points={pts([[6, 8, H], [6, 8, H + 24]])} />
      <circle cx={P(6, 8, H + 24)[0]} cy={P(6, 8, H + 24)[1]} r="2.6" fill={st.linked || full ? '#ffb23e' : '#3b4656'} filter={st.linked || full ? 'url(#gbin)' : undefined} />
      <Box x0={46} y0={3} z0={H} x1={74} y1={20} z1={H + 14} />
      <circle cx={L[0]} cy={L[1]} r="6.5" fill="#05080c" stroke="#3b4656" />
      <circle cx={L[0]} cy={L[1]} r="4" fill={st.scan1 >= 0 ? '#ffb23e' : '#1c2633'} filter={st.scan1 >= 0 ? 'url(#gbin)' : undefined} />
      {[[50, st.linked ? '#4be08a' : '#3b4656'], [70, st.flag ? '#ff5a4f' : full ? '#ffb23e' : '#3b4656']].map(([x, col]) => (
        <circle key={x} cx={P(x, 20, H + 11)[0]} cy={P(x, 20, H + 11)[1]} r="1.8" fill={col} />
      ))}

      {/* slots + lids */}
      {BAYS.map((b, i) => {
        const x0 = i * 40 + 7, x1 = i * 40 + 33
        const on = st.door.open && st.door.type === i
        const z = on ? H + 11 : H + 0.6
        return (
          <g key={b.n}>
            <Poly a={[[x0 - 2, 27, H], [x1 + 2, 27, H], [x1 + 2, 45, H], [x0 - 2, 45, H]]} cls="d" style={{ stroke: b.col, strokeWidth: 1, opacity: 0.8 }} />
            <polygon points={pts([[x0, 29, H], [x1, 29, H], [x1, 43, H], [x0, 43, H]])} className={'slot' + (on ? ' on' : '')} />
            <polyline className="thin" points={pts([[x0 + 2, 36, H], [x1 - 2, 36, H]])} />
            <Poly a={[[x0 - 1, 28, z], [x1 + 1, 28, z], [x1 + 1, 44, z], [x0 - 1, 44, z]]} cls="cover" style={on ? { opacity: 0.5 } : undefined} />
          </g>
        )
      })}

      {/* scanner beam */}
      {st.scan1 >= 0 && (
        <polygon className="beam" points={`${L[0]},${L[1]} ${pts([[st.scan1 * 40 + 9, 29, H], [st.scan1 * 40 + 31, 43, H]])}`} />
      )}

      {/* full-bin alert waves */}
      {full && [7, 13, 19].map((r, i) => {
        const q = P(6, 8, H + 24)
        return <path key={r} d={`M${q[0] - r},${q[1] - r * 0.3} A${r},${r} 0 0 1 ${q[0] + r},${q[1] - r * 0.3}`} fill="none" stroke="#ffb23e" strokeWidth="1.3" opacity={0.9 - i * 0.25} filter="url(#gbin)" />
      })}

      {/* left face panel */}
      <g transform={gL} fontFamily="system-ui,sans-serif">
        <rect x="4" y="-80" width="112" height="19" rx="2" fill="#04070a" stroke={st.flag ? '#ff5a4f' : '#3b4656'} strokeWidth="0.7" />
        <text x="8" y="-74.5" fontSize="4" fill="#8b98a8">GREEN TOKEN HUB · ELM-014</text>
        <text x="8" y="-65" fontSize="5.2" fill={statusCol}>{statusText}</text>
        <text x="112" y="-65" fontSize="9" fontWeight="700" textAnchor="end" fill="#ffb23e">+{st.tokens}</text>
        {BAYS.map((b, i) => {
          const u = i * 40 + 5, hot = st.fills[i] >= 80, n = Math.round(st.fills[i] / 10)
          return (
            <g key={b.n}>
              <rect x={u} y="-58" width="30" height="46" rx="2" fill="#1d2838" stroke="#3b4656" strokeWidth="0.7" />
              <rect x={u} y="-58" width="30" height="6.5" rx="2" fill={b.col} opacity="0.92" />
              <text x={u + 15} y="-53.4" fontSize="4.4" fontWeight="700" textAnchor="middle" fill="#0b0f14">{b.n}</text>
              <rect x={u + 3} y="-23" width="13" height="2.2" rx="1" fill="#6b7a8e" />
              <text x={u + 3} y="-38" fontSize="7" fontWeight="700" fill={hot ? '#ffb23e' : '#e8edf3'}>{Math.round(st.fills[i])}%</text>
              {Array.from({ length: 10 }).map((_, k) => (
                <rect key={k} x={u + 21} y={-17 - (k + 1) * 3.4} width="6" height="2.5" rx="0.6" fill={k < n ? (hot ? '#ff9b2e' : b.col) : '#2a3442'} />
              ))}
              {[0, 1, 2].map((k) => (
                <line key={k} x1={u + 4} y1={-10.5 + k * 1.6} x2={u + 26} y2={-10.5 + k * 1.6} stroke="#3b4656" strokeWidth="0.5" />
              ))}
            </g>
          )
        })}
      </g>

      {/* right face */}
      <g transform={gR(X, Y)} fontFamily="system-ui,sans-serif">
        {Array.from({ length: 7 }).map((_, k) => (
          <line key={k} x1="12" y1={-76 + k * 3.2} x2="38" y2={-76 + k * 3.2} stroke="#3b4656" strokeWidth="0.7" />
        ))}
        <rect x="8" y="-52" width="34" height="38" rx="2" fill="#1d2838" stroke="#3b4656" strokeWidth="0.7" />
        <rect x="32" y="-36" width="3" height="8" rx="1" fill="#6b7a8e" />
        <circle cx="14" cy="-46" r="1.3" fill="#6b7a8e" />
        <circle cx="14" cy="-20" r="1.3" fill="#6b7a8e" />
        <text x="25" y="-10" fontSize="3.6" textAnchor="middle" fill="#8b98a8">SERVICE · IoT · 4G</text>
      </g>

      {/* QR kiosk */}
      <Box x0={134} y0={4} z0={0} x1={150} y1={44} z1={70} />
      <Box x0={132} y0={2} z0={70} x1={152} y1={46} z1={75} />
      <g transform={gR(150, 44)} fontFamily="system-ui,sans-serif">
        <rect x="2" y="-70" width="36" height="66" rx="3" fill="#06090d" stroke={st.linked ? '#4be08a' : '#3b4656'} strokeWidth="0.8" filter={st.linked ? 'url(#gbin)' : undefined} />
        <text x="20" y="-65" fontSize="4" fontWeight="700" textAnchor="middle" fill="#ffb23e">SCAN TO LINK</text>
        <rect x="5.5" y="-62" width="29" height="29" rx="1.5" fill="#f2f5f8" />
        <g dangerouslySetInnerHTML={{ __html: qr }} />
        <text x="20" y="-28" fontSize="3.4" textAnchor="middle" fill="#8b98a8">or tap phone · NFC</text>
        <rect x="8" y="-22" width="24" height="3" rx="1.5" fill={st.linked ? '#4be08a' : '#1c2633'} filter={st.linked ? 'url(#gbin)' : undefined} />
        <text x="20" y="-10" fontSize="4.6" fontWeight="700" textAnchor="middle" fill={st.linked ? '#4be08a' : '#8b98a8'}>{st.linked ? 'SESSION LIVE' : 'READY'}</text>
      </g>
    </svg>
  )
}