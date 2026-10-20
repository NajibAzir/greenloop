import { useEffect, useRef, useState } from 'react'
import { useStore, useAccount } from '../store/StoreContext.jsx'
import { ITEM_CATALOG, VOUCHERS, TOKEN_TO_RM, getItem, ACCOUNT_TYPES, dropoffCap } from '../data/catalog.js'
import {
  computeDropoff,
  formatRm,
  formatWeight,
  formatGP,
  tokensToRm,
} from '../lib/engine.js'
import { Card, CardHeader, Button, CategoryBadge, StreamBadge } from '../components/ui.jsx'
import ScanItem from '../components/ScanItem.jsx'
import CameraScan from '../components/CameraScan.jsx'
import VoucherModal from '../components/VoucherModal.jsx'
import HubSession from '../components/HubSession.jsx'

// -------------------------------------------------------------------------
// GP balance card (shared header on resident pages)
// -------------------------------------------------------------------------
export function GPBalance({ balance }) {
  const [pop, setPop] = useState(false)
  const prev = useRef(balance)
  useEffect(() => {
    if (balance !== prev.current) {
      setPop(true)
      const t = setTimeout(() => setPop(false), 500)
      prev.current = balance
      return () => clearTimeout(t)
    }
  }, [balance])

  return (
    <Card className="bg-gradient-to-br from-green-600 to-emerald-500 text-white ring-0">
      <div className="px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-green-50">
          Green Points Balance
        </p>
        <div className="mt-1 flex items-end gap-2">
          <span className={`text-4xl font-bold tabular-nums ${pop ? 'animate-pop' : ''}`}>
            {balance.toLocaleString()}
          </span>
          <span className="pb-1 text-sm text-green-50">GP</span>
        </div>
        <p className="mt-1 text-sm text-green-50">
          ≈ {formatRm(tokensToRm(balance))} spendable value
        </p>
      </div>
    </Card>
  )
}

// -------------------------------------------------------------------------
// Scan & Drop-off page (CV gate + drop-off)
// -------------------------------------------------------------------------
function ScanAndDropoff() {
  const { state, dispatch } = useStore()
  const account = useAccount()
  // lines: [{ itemId, quantity }] built from the scan result
  const [lines, setLines] = useState([])
  const [result, setResult] = useState(null)
  const [mode, setMode] = useState('sim') // 'sim' | 'camera'
  const [pairedHub, setPairedHub] = useState(null) // Smart Hub session (QR pairing)

  const acct = state.accountType // 'residence' | 'tenant'
  const capFor = (itemId) => dropoffCap(acct, itemId)
  const clampQty = (itemId, q) => Math.max(1, Math.min(Math.floor(Number(q) || 1), capFor(itemId)))

  // Normalise either scan source into editable drop-off lines, clamped to the
  // realistic per-drop-off cap for this account type.
  // Simulated -> single item (default qty capped). Camera -> tallied counts.
  function onAccepted(res) {
    setResult(null)
    if (!res) {
      setLines([])
      return
    }
    if (res.items) {
      setLines(res.items.map((i) => ({ itemId: i.itemId, quantity: clampQty(i.itemId, i.quantity || 1) })))
    } else if (res.itemId) {
      setLines([{ itemId: res.itemId, quantity: clampQty(res.itemId, 5) }])
    } else {
      setLines([])
    }
  }

  function setLineQty(itemId, qty) {
    setLines((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, quantity: clampQty(itemId, qty) } : l)))
  }

  // Re-clamp quantities if the account type (and thus caps) changes.
  useEffect(() => {
    setLines((ls) => ls.map((l) => ({ ...l, quantity: clampQty(l.itemId, l.quantity) })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acct])

  const previews = lines
    .map((l) => ({ line: l, item: getItem(l.itemId), preview: computeDropoff(l.itemId, l.quantity) }))
    .filter((p) => p.item)
  const totalGP = previews.reduce((s, p) => s + p.preview.tokensAwarded, 0)
  const hasValid = previews.some((p) => p.preview.quantity > 0)

  function handleDrop() {
    const dropped = []
    for (const { line, preview } of previews) {
      if (preview.quantity > 0) {
        // Attribute the drop-off to the paired hub so it feeds that hub's bin.
        dispatch({ type: 'DROP_OFF', itemId: line.itemId, quantity: line.quantity, hubId: pairedHub?.id })
        dropped.push(preview)
      }
    }
    if (dropped.length === 0) return
    setResult({
      lines: dropped,
      hubName: pairedHub?.name,
      totalGP: dropped.reduce((s, d) => s + d.tokensAwarded, 0),
      totalWeight: dropped.reduce((s, d) => s + d.totalWeight, 0),
      totalItems: dropped.reduce((s, d) => s + d.quantity, 0),
      at: Date.now(),
    })
    // Clear the scanned items; keep the session open for more drop-offs.
    setLines([])
  }

  function endSession() {
    setPairedHub(null)
    setLines([])
    setResult(null)
  }

  // Before pairing with a hub, show only the GP balance + the QR session step.
  if (!pairedHub) {
    return (
      <div className="space-y-5">
        <GPBalance balance={account.tokenBalance} />
        <HubSession pairedHub={null} onPaired={setPairedHub} onEnd={endSession} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <HubSession pairedHub={pairedHub} onPaired={setPairedHub} onEnd={endSession} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <GPBalance balance={account.tokenBalance} />

      <Card className="lg:row-span-2">
        <CardHeader
          title="Step 3 — Drop at Smart Hub"
          subtitle="Unlocked only after the AI confirms a recyclable item"
        />
        <div className="space-y-4 px-5 py-4">
          {previews.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-400 ring-1 ring-slate-100">
              🔒 Scan a recyclable item first to unlock drop-off.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {previews.map(({ item, line, preview }) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="text-lg">{item.emoji}</span>
                      <span className="font-semibold text-slate-800">{item.name}</span>
                      <StreamBadge stream={item.stream} />
                      <CategoryBadge category={item.category} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        Qty
                        <input
                          type="number"
                          min="1"
                          max={capFor(item.id)}
                          value={line.quantity}
                          onChange={(e) => setLineQty(item.id, Number(e.target.value))}
                          className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm tabular-nums focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        <span className="text-[11px] text-slate-400">/ max {capFor(item.id)}</span>
                      </label>
                      <span className="text-xs font-semibold text-green-600">
                        +{formatGP(preview.tokensAwarded)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                {acct === 'tenant'
                  ? 'Tenant account — higher bulk limits per drop-off.'
                  : 'Residence account — household-scale limits per drop-off.'}
              </p>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span>Total reward</span>
                <span className="font-bold text-green-600">+{formatGP(totalGP)}</span>
              </div>
              <Button onClick={handleDrop} disabled={!hasValid} className="w-full">
                ♻️ Drop {previews.length > 1 ? 'all at Smart Hub' : 'at Smart Hub'}
              </Button>
            </>
          )}

          {result && (
            <div className="animate-fade-slide rounded-xl bg-green-50 p-4 ring-1 ring-green-200">
              <p className="text-sm font-semibold text-green-800">
                ✅ Drop-off confirmed at {result.hubName} — {result.lines.length} material
                {result.lines.length > 1 ? 's' : ''} graded
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-slate-900">{result.totalItems}</p>
                  <p className="text-xs text-slate-500">items</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{formatWeight(result.totalWeight)}</p>
                  <p className="text-xs text-slate-500">weight</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">+{result.totalGP}</p>
                  <p className="text-xs text-slate-500">GP</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Step 2 — AI Recyclability Check"
          subtitle="Computer vision verifies the item before it enters the hub"
          right={
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
              {[
                { id: 'sim', label: 'Simulated' },
                { id: 'camera', label: 'Live Camera' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setMode(m.id)
                    setLines([])
                    setResult(null)
                  }}
                  className={`rounded-md px-2.5 py-1 transition ${
                    mode === m.id ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          }
        />
        <div className="px-5 py-4">
          {mode === 'sim' ? (
            <ScanItem onAccepted={onAccepted} />
          ) : (
            <CameraScan onAccepted={onAccepted} />
          )}
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title="How Green Points are calculated"
          subtitle="Points are granted by material and weight — the same model real recycling schemes use"
        />
        <div className="px-5 py-4">
          <p className="mb-3 text-xs text-slate-500">
            GP earned = material rate (GP/kg) × weight. Rates reflect each material's
            recycling value (aluminium and e-waste are worth the most).
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ITEM_CATALOG.map((it) => (
              <div key={it.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs text-slate-700">
                  <span>{it.emoji}</span>
                  <CategoryBadge category={it.category} />
                </span>
                <span className="text-xs font-semibold text-green-600">{it.gpPerKg} GP/kg</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Redeem Vouchers page
// -------------------------------------------------------------------------
function RedeemVouchers() {
  const { dispatch } = useStore()
  const account = useAccount()
  const [openVoucher, setOpenVoucher] = useState(null)

  return (
    <div className="space-y-5">
      <GPBalance balance={account.tokenBalance} />

      <Card>
        <CardHeader
          title="Redeem Green Points — Mall Tenant Vouchers"
          subtitle="Spend GP like cash at township mall tenants and F&B outlets"
        />
        <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
          {VOUCHERS.map((v) => {
            const affordable = account.tokenBalance >= v.costTokens
            return (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {v.emoji} {formatRm(v.value)} {v.name}
                  </p>
                  <p className="text-xs text-slate-500">{formatGP(v.costTokens)}</p>
                </div>
                <Button
                  variant={affordable ? 'primary' : 'secondary'}
                  disabled={!affordable}
                  onClick={() => dispatch({ type: 'REDEEM_VOUCHER', voucherId: v.id })}
                >
                  Redeem
                </Button>
              </div>
            )
          })}
        </div>
      </Card>

      {/* My Vouchers — redeemed voucher slots, click to show QR / barcode / code */}
      <Card>
        <CardHeader
          title="My Vouchers"
          subtitle="Tap a voucher to show its QR code, barcode and redemption code"
        />
        <div className="px-5 py-4">
          {account.redeemedVouchers.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-400 ring-1 ring-slate-100">
              No vouchers yet. Redeem one above to see it here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {account.redeemedVouchers.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setOpenVoucher(r)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition hover:shadow-sm ${
                    r.used ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-green-200 bg-green-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {r.emoji} {formatRm(r.value)} {r.name}
                    </p>
                    <p className="font-mono text-xs text-slate-500">{r.code}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.used ? 'bg-slate-200 text-slate-500' : 'bg-green-600 text-white'
                    }`}
                  >
                    {r.used ? 'Used' : 'Active'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <VoucherModal
        voucher={openVoucher ? account.redeemedVouchers.find((r) => r.id === openVoucher.id) : null}
        onClose={() => setOpenVoucher(null)}
      />
    </div>
  )
}

// -------------------------------------------------------------------------
// Offset Maintenance Fee page (slider)
// -------------------------------------------------------------------------
function OffsetFee() {
  const { state, dispatch } = useStore()
  const account = useAccount()
  const acct = ACCOUNT_TYPES[state.accountType] || ACCOUNT_TYPES.residence
  const remaining = Math.max(0, account.maintenanceFee - account.feeOffsetRm)
  const pct = Math.min(100, (account.feeOffsetRm / account.maintenanceFee) * 100)
  const availableRm = tokensToRm(account.tokenBalance)

  // Max GP the resident can usefully apply = min(balance, remaining-fee-in-GP)
  const remainingGP = Math.ceil(remaining / TOKEN_TO_RM)
  const maxGP = Math.min(account.tokenBalance, remainingGP)
  const [gp, setGp] = useState(0)

  // Clamp any input (slider or typed) into the valid range.
  function setGpClamped(v) {
    const n = Math.floor(Number(v) || 0)
    setGp(Math.max(0, Math.min(n, maxGP)))
  }

  // Keep value within bounds as balance/fee change.
  useEffect(() => {
    setGp((g) => Math.min(g, maxGP))
  }, [maxGP])

  const applyRm = Math.min(gp * TOKEN_TO_RM, remaining)
  const canApply = gp > 0 && remaining > 0

  function apply() {
    dispatch({ type: 'OFFSET_FEE', tokens: gp, rmPerToken: TOKEN_TO_RM })
    setGp(0)
  }

  return (
    <div className="space-y-5">
      <GPBalance balance={account.tokenBalance} />
      <Card>
        <CardHeader
          title={`Offset ${acct.feeLabel}`}
          subtitle={`This month's ${acct.feeShort}: ${formatRm(account.maintenanceFee)}`}
        />
        <div className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Offset so far</span>
            <span className="font-bold text-green-600">{formatRm(account.feeOffsetRm)}</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{pct.toFixed(0)}% covered</span>
            <span>{formatRm(remaining)} remaining</span>
          </div>

          {/* Slider + typed value (kept in sync) */}
          <div className="mt-6 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">Choose how much to apply</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max={maxGP}
                  step="10"
                  value={gp}
                  disabled={maxGP <= 0}
                  onChange={(e) => setGpClamped(e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-sm font-semibold tabular-nums focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-40"
                />
                <span className="text-sm font-semibold text-slate-500">GP</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max={maxGP}
              step="10"
              value={gp}
              disabled={maxGP <= 0}
              onChange={(e) => setGpClamped(e.target.value)}
              className="mt-3 w-full accent-green-600 disabled:opacity-40"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>0 GP</span>
              <span>{formatGP(maxGP)} max</span>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setGpClamped(Math.floor(maxGP / 2))}
                disabled={maxGP <= 0}
                className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Half
              </button>
              <button
                onClick={() => setGpClamped(maxGP)}
                disabled={maxGP <= 0}
                className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Max
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Applies <span className="font-semibold text-green-600">{formatRm(applyRm)}</span> to your fee
              </p>
              <Button disabled={!canApply} onClick={apply}>
                Apply to fee
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              You have {formatGP(account.tokenBalance)} ≈ {formatRm(availableRm)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// -------------------------------------------------------------------------
// My Activity page (history)
// -------------------------------------------------------------------------
function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MyActivity() {
  const account = useAccount()

  const events = [
    ...account.transactions.map((t) => ({
      id: t.id,
      ts: t.timestamp,
      icon: '♻️',
      title: `Dropped ${t.quantity}× ${t.name}`,
      detail: `${formatWeight(t.totalWeight)} · Grade ${t.grade}`,
      amount: `+${formatGP(t.tokensAwarded)}`,
      positive: true,
    })),
    ...account.redeemedVouchers.map((r) => ({
      id: r.id,
      ts: r.timestamp,
      icon: '🎟️',
      title: `Redeemed ${r.name}`,
      detail: `${formatRm(r.value)} voucher`,
      amount: `−${formatGP(r.costTokens)}`,
      positive: false,
    })),
    ...account.feeOffsets.map((f) => ({
      id: f.id,
      ts: f.timestamp,
      icon: '🏠',
      title: 'Offset maintenance fee',
      detail: `${formatRm(f.rm)} applied`,
      amount: `−${formatGP(f.tokensUsed)}`,
      positive: false,
    })),
  ].sort((a, b) => b.ts - a.ts)

  return (
    <div className="space-y-5">
      <GPBalance balance={account.tokenBalance} />
      <Card>
        <CardHeader title="My Activity" subtitle="Your drop-offs, redemptions and fee offsets" />
        {events.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            No activity yet. Scan and drop off a recyclable to get started.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-xl">{e.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{e.title}</p>
                  <p className="truncate text-xs text-slate-500">{e.detail}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${e.positive ? 'text-green-600' : 'text-slate-500'}`}>
                    {e.amount}
                  </p>
                  <p className="text-xs text-slate-400">{fmtTime(e.ts)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

// -------------------------------------------------------------------------
// Account-type bar — switch between Residence and Mall Tenant personas
// -------------------------------------------------------------------------
function AccountBar() {
  const { state, dispatch } = useStore()
  const acct = ACCOUNT_TYPES[state.accountType] || ACCOUNT_TYPES.residence
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xl">{acct.icon}</span>
          <div>
            <p className="font-semibold text-slate-800">{acct.label} account</p>
            <p className="text-xs text-slate-500">{acct.account}</p>
          </div>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
          {Object.values(ACCOUNT_TYPES).map((a) => (
            <button
              key={a.id}
              onClick={() => dispatch({ type: 'SET_ACCOUNT', accountType: a.id })}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                state.accountType === a.id ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              <span>{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">{acct.hint}</p>
    </div>
  )
}

// -------------------------------------------------------------------------
// Router for resident pages
// -------------------------------------------------------------------------
export default function ResidentView({ page }) {
  let content
  switch (page) {
    case 'redeem':
      content = <RedeemVouchers />
      break
    case 'offset':
      content = <OffsetFee />
      break
    case 'activity':
      content = <MyActivity />
      break
    case 'dropoff':
    default:
      content = <ScanAndDropoff />
  }
  return (
    <div className="space-y-5">
      <AccountBar />
      {content}
    </div>
  )
}
