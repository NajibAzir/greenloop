import { useState, useMemo, useEffect } from 'react'
import { useStore } from './store/StoreContext.jsx'
import { buildSeedTransactions, buildAccountHistory } from './lib/seed.js'
import ResidentView from './views/ResidentView.jsx'
import ManagementView from './views/ManagementView.jsx'
import ProfileView from './views/ProfileView.jsx'
import RecycleHubView from './views/RecycleHubView.jsx'
import HubStatView from './views/HubStatView.jsx'

// Two personas, each with its own menu. The sidebar shows only the active
// persona's items; a top-level switch toggles between them.
const MODES = {
  resident: {
    label: 'Resident & Tenant',
    short: 'Resident',
    icon: '🙋',
    items: [
      { id: 'profile', label: 'Profile', icon: '🧑' },
      { id: 'dropoff', label: 'Scan & Drop-off', icon: '📷' },
      { id: 'redeem', label: 'Redeem Vouchers', icon: '🎟️' },
      { id: 'offset', label: 'Offset Maintenance Fee', icon: '🏠' },
      { id: 'activity', label: 'My Activity', icon: '📜' },
    ],
  },
  management: {
    label: 'Developer Operations',
    short: 'Operations',
    icon: '🏢',
    items: [
      { id: 'metrics', label: 'Diversion Metrics', icon: '📊' },
      { id: 'ledger', label: 'Financial Ledger', icon: '💰' },
      { id: 'logistics', label: 'Logistics & Dispatch', icon: '🚛' },
      { id: 'recyclehub', label: 'Recycle Hub', icon: '🗑️' },
      { id: 'hubstat', label: 'Hub Stat', icon: '📈' },
    ],
  },
}

const PAGE_TITLES = {
  profile: 'Profile',
  dropoff: 'Scan & Drop-off',
  redeem: 'Redeem Vouchers',
  offset: 'Offset Maintenance Fee',
  activity: 'My Activity',
  metrics: 'Diversion Metrics',
  ledger: 'Financial Ledger',
  logistics: 'Logistics & Dispatch',
  recyclehub: 'Recycle Hub',
  hubstat: 'Hub Stat',
}

const PAGE_SUBTITLES = {
  profile: 'Your account, Green Point balance and details.',
  dropoff: 'Scan an item for recyclability, then drop it at the Smart Hub to earn Green Points.',
  redeem: 'Spend your Green Points like cash at township mall tenants.',
  offset: 'Apply Green Points to this month’s township maintenance fee.',
  activity: 'A history of everything you have recycled, redeemed and offset.',
  metrics: 'Live landfill diversion across the township, broken down by material.',
  ledger: 'Operating ROI, payback and revenue forecast for the hub.',
  logistics: 'Predicted hub capacity and AI dispatch of the collection fleet.',
  recyclehub: 'Registered recycle hubs — open a hub to run the Smart Recycle Bin.',
  hubstat: 'Hub station performance, material breakdown and contribution ranking.',
}

function ModeSwitch({ mode, setMode }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
      {Object.entries(MODES).map(([key, m]) => (
        <button
          key={key}
          onClick={() => setMode(key)}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
            mode === key ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          title={m.label}
        >
          <span>{m.icon}</span>
          <span>{m.short}</span>
        </button>
      ))}
    </div>
  )
}

function Sidebar({ mode, setMode, active, setActive, onSeed, onReset, onCollapse, items }) {
  return (
    <aside className="flex h-full w-72 max-w-[85vw] shrink-0 flex-col border-r border-slate-200 bg-white lg:w-60 lg:max-w-none">
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♻️</span>
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-900">GreenLoop</h1>
            <p className="text-[11px] text-slate-500">Smart Recycling Ecosystem</p>
          </div>
        </div>
        <button
          onClick={onCollapse}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Hide menu"
          aria-label="Hide menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="px-3 pb-3">
        <ModeSwitch mode={mode} setMode={setMode} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {MODES[mode].label}
        </p>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const isActive = active === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActive(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-3">
        <button
          onClick={onSeed}
          className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          Load Demo Data
        </button>
        <button
          onClick={onReset}
          className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50"
        >
          Reset
        </button>
      </div>
    </aside>
  )
}

// Tailwind's `lg` breakpoint — above this the sidebar is a static column, below
// it's an off-canvas drawer.
const LG = 1024
const isDesktop = () => typeof window !== 'undefined' && window.innerWidth >= LG

export default function App() {
  const [mode, setMode] = useState('resident')
  const [active, setActive] = useState('dropoff')
  // Open by default on desktop, collapsed on phones/tablets so the 60-wide
  // sidebar doesn't eat the viewport.
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop)
  const { state, dispatch } = useStore()

  // Keep the sidebar sensible across orientation / resize: show it on desktop,
  // hide it when shrinking down to mobile.
  useEffect(() => {
    let wasDesktop = isDesktop()
    function onResize() {
      const nowDesktop = isDesktop()
      if (nowDesktop !== wasDesktop) {
        setSidebarOpen(nowDesktop)
        wasDesktop = nowDesktop
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // On mobile, collapse the drawer after the user picks a page / switches mode.
  function closeOnMobile() {
    if (!isDesktop()) setSidebarOpen(false)
  }

  // Resident menu items, filtered by account type. Mall tenants are businesses,
  // not individuals, so they don't get consumer voucher redemption.
  const menuItems = useMemo(() => {
    const items = MODES[mode].items
    if (mode === 'resident' && state.accountType === 'tenant') {
      return items.filter((i) => i.id !== 'redeem')
    }
    return items
  }, [mode, state.accountType])

  // If the active page is no longer available (e.g. tenant on the hidden
  // Redeem page), fall back to the first available page.
  useEffect(() => {
    if (!menuItems.some((i) => i.id === active)) {
      setActive(menuItems[0].id)
    }
  }, [menuItems, active])

  function switchMode(nextMode) {
    setMode(nextMode)
    setActive(MODES[nextMode].items[0].id) // jump to that mode's first page
  }

  // Navigate to a page and, on mobile, close the drawer.
  function goTo(pageId) {
    setActive(pageId)
    closeOnMobile()
  }

  function seed() {
    dispatch({
      type: 'SEED',
      transactions: buildSeedTransactions(),
      residenceTx: buildAccountHistory('residence'),
      tenantTx: buildAccountHistory('tenant'),
    })
  }
  function reset() {
    if (confirm('Reset the demo? This clears all Green Points, drop-offs and vouchers.')) {
      dispatch({ type: 'RESET' })
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Backdrop — only on mobile when the drawer is open. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: fixed off-canvas drawer on mobile, static column on lg+. */}
      {sidebarOpen && (
        <div className="fixed inset-y-0 left-0 z-40 lg:static lg:z-auto">
          <Sidebar
            mode={mode}
            setMode={(m) => {
              switchMode(m)
              closeOnMobile()
            }}
            active={active}
            setActive={goTo}
            items={menuItems}
            onSeed={seed}
            onReset={reset}
            onCollapse={() => setSidebarOpen(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-700"
            title={sidebarOpen ? 'Hide menu' : 'Show menu'}
            aria-label={sidebarOpen ? 'Hide menu' : 'Show menu'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">{PAGE_TITLES[active]}</h2>
            <p className="truncate text-xs text-slate-500 sm:text-sm">{PAGE_SUBTITLES[active]}</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-5xl">
            {active === 'profile' ? (
              <ProfileView />
            ) : active === 'recyclehub' ? (
              <RecycleHubView />
            ) : active === 'hubstat' ? (
              <HubStatView />
            ) : mode === 'resident' ? (
              <ResidentView page={active} />
            ) : (
              <ManagementView page={active} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
