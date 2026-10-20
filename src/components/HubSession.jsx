import { useState } from 'react'
import { COLLECTION_HUBS } from '../data/catalog.js'
import { Card, CardHeader, Button } from './ui.jsx'

// Hub QR pairing: the resident "scans a hub QR" to start a recycling session.
// Drop-off is attributed to the paired hub (so it feeds that hub's live bin).
// Simulated: pick a hub from a QR grid; a short "pairing" animation runs.
export default function HubSession({ pairedHub, onPaired, onEnd }) {
  const [pairing, setPairing] = useState(null) // hub being paired (during anim)

  function pair(hub) {
    setPairing(hub)
    setTimeout(() => {
      setPairing(null)
      onPaired(hub)
    }, 900)
  }

  if (pairedHub) {
    return (
      <Card className="bg-green-50 ring-green-200">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-green-800">
                Paired with {pairedHub.name}
              </p>
              <p className="text-xs text-green-600">
                Recycling session active — your drop-offs are logged to this hub.
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={onEnd}>
            End session
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Step 1 — Scan Hub QR to start a session"
        subtitle="Pair with a Smart Hub before dropping off (like scanning the hub's QR on arrival)"
      />
      <div className="px-5 py-4">
        {pairing ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-900 py-8 text-center text-white">
            <div className="text-3xl">📷</div>
            <p className="animate-pulse text-sm text-green-300">
              Scanning QR… pairing with {pairing.name}
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Tap a hub's QR code to pair (in a real deployment you'd scan the QR sticker on the hub):
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {COLLECTION_HUBS.map((h) => (
                <button
                  key={h.id}
                  onClick={() => pair(h)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-left transition hover:border-green-400 hover:bg-green-50"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-900 text-white">
                    {/* mini QR glyph */}
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
                      <path d="M2 2h6v6H2V2zm2 2v2h2V4H4zm10-2h6v6h-6V2zm2 2v2h2V4h-2zM2 14h6v6H2v-6zm2 2v2h2v-2H4zm8-2h2v2h-2v-2zm4 0h4v2h-2v2h2v2h-4v-2h-2v-2h2v-2zm-4 4h2v4h-2v-4z" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">{h.name}</span>
                    <span className="block text-[11px] text-slate-400">QR: {h.id.toUpperCase()}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
