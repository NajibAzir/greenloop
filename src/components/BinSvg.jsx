// Isometric Smart Recycle Bin + QR kiosk, ported from the reference station.
// Renders bays with live fill %, a scan beam, status LED, LED label strip and
// a generated QR block on the kiosk. Supports a dark-amber and light-green theme.

const X = 120, Y = 50, HT = 84, sc = 2
const ox = 330, oy = 222
const c = 0.866 * sc, h = 0.5 * sc

const P = (x, y, z) => [ox + (x - y) * c, oy + (x + y) * h - z * sc]
const ptsOf = (a) => a.map((p) => P(...p).map((n) => n.toFixed(1)).join(',')).join(' ')

const BAYS = [
  { n: 'PET', col: '#4fc3f7' },
  { n: 'CAN', col: '#ffb23e' },
  { n: 'PAPER', col: '#8bd96b' },
]

// Deterministic QR-ish block.
function qr(seed) {
  let a = seed | 0
  const rnd = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const q = 1.15
  const cells = []
  for (let j = 0; j < 21; j++)
    for (let i = 0; i < 21; i++) {
      const fd = i < 7 && j < 7 ? [i, j] : i > 13 && j < 7 ? [i - 14, j] : i < 7 && j > 13 ? [i, j - 14] : null
      const on = fd ? Math.max(Math.abs(fd[0] - 3), Math.abs(fd[1] - 3)) !== 2 : rnd() > 0.52
      if (on) cells.push(<rect key={`${i}-${j}`} x={(8.4 + i * q).toFixed(2)} y={(-59.6 + j * q).toFixed(2)} width={q + 0.03} height={q + 0.03} fill="#0b0f14" />)
    }
  return cells
}

export default function BinSvg({ fills, open, scan, c2, linked, connecting, flag, alert, pulse, tk, resident, code, dark }) {
  const amber = dark ? '#ffb23e' : '#16a34a'
  const line = dark ? '#3b4656' : '#c7d2dd'
  const faceStroke = line
  const full = fills.some((v) => v >= 80)

  const gL = `matrix(${c} ${h} 0 ${sc} ${ox - Y * c} ${oy + Y * h})`
  const gR = (xp, ym) => `matrix(${c} ${-h} 0 ${sc} ${ox + (xp - ym) * c} ${oy + (xp + ym) * h})`

  const poly = (a, cls, style) => (
    <polygon points={ptsOf(a)} className={cls} style={style} />
  )
  const fFill = dark ? '#182030' : '#e8eef4'
  const tFill = dark ? '#212c3d' : '#d7e0ea'
  const box = (x0, y0, z0, x1, y1, z1, key) => (
    <g key={key}>
      <polygon points={ptsOf([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]])} fill={fFill} stroke={faceStroke} strokeWidth="1.1" strokeLinejoin="round" />
      <polygon points={ptsOf([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]])} fill={fFill} stroke={faceStroke} strokeWidth="1.1" strokeLinejoin="round" />
      <polygon points={ptsOf([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])} fill={tFill} stroke={faceStroke} strokeWidth="1.1" strokeLinejoin="round" />
    </g>
  )

  const L = P(60, 20, HT + 7)
  const statusText = flag
    ? 'FLAGGED: ITEM MISMATCH'
    : alert
    ? (linked ? 'USE STAFFED COUNTER' : 'SCAN QR FIRST')
    : linked
    ? `LINKED · ${resident.toUpperCase()}`
    : 'SCAN QR TO START'

  return (
    <svg viewBox="0 0 660 440" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Smart recycling bin with QR link station">
      <defs>
        <filter id="g" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* floor */}
      <polygon points={ptsOf([[-28, -28, 0], [165, -28, 0], [165, 60, 0], [-28, 60, 0]])} fill="none" stroke={dark ? '#202938' : '#dde5ec'} strokeWidth="1" />

      {/* data conduit bin -> kiosk */}
      <polyline points={ptsOf([[X + 3, 24, 1], [134, 24, 1]])} fill="none" stroke={linked ? amber : (dark ? '#2a3442' : '#cbd5e1')} strokeWidth={pulse ? 4 : 2.2} filter={linked ? 'url(#g)' : undefined} />

      {/* bin body */}
      {box(-3, -3, 0, X + 3, Y + 3, 6, 'base')}
      {box(0, 0, 6, X, Y, HT, 'body')}
      {[40, 80].map((x) => (
        <polyline key={x} className="thin" points={ptsOf([[x, Y, 6], [x, Y, HT], [x, 0, HT]])} fill="none" stroke={line} strokeWidth="0.9" />
      ))}

      {/* solar pod + mast + sensor box */}
      <polygon points={ptsOf([[80, 3, HT + 9], [116, 3, HT + 9], [116, 22, HT + 2], [80, 22, HT + 2]])} fill="#0e2a4a" stroke={faceStroke} strokeWidth="1.1" />
      <polyline className="thin" points={ptsOf([[6, 8, HT], [6, 8, HT + 24]])} fill="none" stroke={line} strokeWidth="0.9" />
      <circle cx={P(6, 8, HT + 24)[0]} cy={P(6, 8, HT + 24)[1]} r="2.6" fill={linked || full ? amber : '#3b4656'} filter={linked || full ? 'url(#g)' : undefined} />
      {box(46, 3, HT, 74, 20, HT + 14, 'sensor')}
      <circle cx={L[0]} cy={L[1]} r="6.5" fill="#05080c" stroke="#3b4656" />
      <circle cx={L[0]} cy={L[1]} r="4" fill={scan >= 0 ? amber : '#1c2633'} filter={scan >= 0 ? 'url(#g)' : undefined} />

      {/* slots */}
      {BAYS.map((b, i) => {
        const x0 = i * 40 + 7, x1 = i * 40 + 33
        const on = open === i || scan === i
        const z = open === i ? HT + 11 : HT + 0.6
        const cp = P(i * 40 + 20, 32, HT)
        const a2 = c2 === i
        return (
          <g key={b.n}>
            <polygon points={ptsOf([[x0 - 2, 27, HT], [x1 + 2, 27, HT], [x1 + 2, 45, HT], [x0 - 2, 45, HT]])} fill={dark ? '#101722' : '#cfd9e3'} stroke={b.col} strokeWidth="1" opacity="0.8" />
            <polygon points={ptsOf([[x0, 29, HT], [x1, 29, HT], [x1, 43, HT], [x0, 43, HT]])} fill="#04070a" stroke={on ? amber : line} strokeWidth="1" filter={on ? 'url(#g)' : undefined} />
            <circle cx={cp[0]} cy={cp[1]} r="2" fill={a2 ? (flag ? '#ff5a4f' : '#4fe0ff') : '#26313f'} filter={a2 ? 'url(#g)' : undefined} />
            <polygon points={ptsOf([[x0 - 1, 28, z], [x1 + 1, 28, z], [x1 + 1, 44, z], [x0 - 1, 44, z]])} fill="#2a3547" stroke={line} strokeWidth="1.1" opacity={open === i ? 0.5 : 1} />
          </g>
        )
      })}

      {/* scan beam */}
      {scan >= 0 && (
        <polygon className="beam" points={`${L[0]},${L[1]} ${ptsOf([[scan * 40 + 20 - 11, 29, HT], [scan * 40 + 20 + 11, 43, HT]])}`} fill={amber} opacity="0.28" filter="url(#g)" />
      )}

      {/* left face: label + bay meters */}
      <g transform={gL} fontFamily="system-ui,sans-serif">
        <rect x="4" y="-80" width="112" height="19" rx="2" fill="#04070a" stroke={alert || flag ? '#ff5a4f' : line} strokeWidth="0.7" />
        <text x="8" y="-74.5" fontSize="4" fill="#8b98a8">GREEN TOKEN HUB · {code}</text>
        <text x="8" y="-65" fontSize="5.2" fill={alert || flag ? '#ff5a4f' : linked ? '#4be08a' : amber}>{statusText}</text>
        <text x="112" y="-65" fontSize="9" fontWeight="700" textAnchor="end" fill={amber}>+{tk}</text>
        {BAYS.map((b, i) => {
          const u = i * 40 + 5, hot = fills[i] >= 80, n = Math.round(fills[i] / 10)
          return (
            <g key={b.n}>
              <rect x={u} y="-58" width="30" height="46" rx="2" fill="#1d2838" stroke="#3b4656" strokeWidth="0.7" />
              <rect x={u} y="-58" width="30" height="6.5" rx="2" fill={b.col} opacity="0.92" />
              <text x={u + 15} y="-53.4" fontSize="4.4" fontWeight="700" textAnchor="middle" fill="#0b0f14">{b.n}</text>
              <text x={u + 3} y="-38" fontSize="7" fontWeight="700" fill={hot ? '#ffb23e' : '#e8edf3'}>{Math.round(fills[i])}%</text>
              {Array.from({ length: 10 }).map((_, k) => (
                <rect key={k} x={u + 21} y={-17 - (k + 1) * 3.4} width="6" height="2.5" rx="0.6" fill={k < n ? (hot ? '#ff9b2e' : b.col) : '#2a3442'} filter={k < n && hot ? 'url(#g)' : undefined} />
              ))}
            </g>
          )
        })}
      </g>

      {/* kiosk */}
      {box(134, 4, 0, 150, 44, 70, 'kiosk')}
      {box(132, 2, 70, 152, 46, 75, 'kiosktop')}
      <g transform={gR(150, 44)} fontFamily="system-ui,sans-serif">
        <rect x="2" y="-70" width="36" height="66" rx="3" fill="#06090d" stroke={linked ? '#4be08a' : line} strokeWidth="0.8" filter={linked ? 'url(#g)' : undefined} />
        <text x="20" y="-65" fontSize="4" fontWeight="700" textAnchor="middle" fill={amber}>SCAN TO LINK</text>
        <rect x="5.5" y="-62" width="29" height="29" rx="1.5" fill="#f2f5f8" />
        {qr(7)}
        <text x="20" y="-28" fontSize="3.4" textAnchor="middle" fill="#8b98a8">or tap phone · NFC</text>
        <rect x="8" y="-22" width="24" height="3" rx="1.5" fill={connecting ? amber : linked ? '#4be08a' : '#1c2633'} filter={linked || connecting ? 'url(#g)' : undefined} />
        <text x="20" y="-10" fontSize="4.6" fontWeight="700" textAnchor="middle" fill={linked ? '#4be08a' : '#8b98a8'}>
          {connecting ? 'LINKING…' : linked ? 'SESSION LIVE' : 'READY'}
        </text>
      </g>
    </svg>
  )
}
