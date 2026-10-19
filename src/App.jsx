import { useEffect, useState } from 'react'
import { useStore } from './store/StoreContext.jsx'
import { buildSeedTransactions, buildAccountHistory } from './lib/seed.js'
import AuthView from './views/AuthView.jsx'
import UserView from './views/UserView.jsx'
import ManagementView from './views/ManagementView.jsx'

const MENUS = {
  user: {
    label: 'User View',
    items: [
      { id: 'profile', label: 'Profile', icon: '👤' },
      { id: 'scan', label: 'Scan', icon: '📷' },
      { id: 'redeem', label: 'Redeem', icon: '🎟️' },
      { id: 'activity', label: 'Activity', icon: '📜' },
    ],
  },
  tenant: {
    label: 'Tenant View',
    items: [
      { id: 'profile', label: 'Profile', icon: '👤' },
      { id: 'scan', label: 'Scan', icon: '📷' },
      { id: 'offset', label: 'Offset Maintenance Fee', icon: '🏠' },
      { id: 'activity', label: 'Activity', icon: '📜' },
    ],
  },
  ops: {
    label: 'Operation View',
    items: [
      { id: 'metrics', label: 'Diversion Metrics', icon: '📊' },
      { id: 'ledger', label: 'Financial Ledger', icon: '💰' },
      { id: 'logistics', label: 'Logistics & Dispatch', icon: '🚛' },
      { id: 'hubs', label: 'Recycle Hub', icon: '♻️' },
      { id: 'hubstats', label: 'Hub Stat', icon: '📈' },
    ],
  },
}

const PAGE_TITLES = {
  profile: 'Profile',
  scan: 'Scan Hub QR',
  redeem: 'Redeem Vouchers',
  offset: 'Offset Maintenance Fee',
  activity: 'My Activity',
  metrics: 'Diversion Metrics',
  ledger: 'Financial Ledger',
  logistics: 'Logistics & Dispatch',
  hubs: 'Recycle Hub',
  hubstats: 'Hub Stat',
}

const PAGE_SUBTITLES = {
  profile: 'Your account, Green Point balance and settings',
  scan: 'Scan a hub QR to connect, then recycle items to earn Green Points',
  redeem: 'Spend your Green Points like cash at township mall tenants',
  offset: 'Apply Green Points to this month’s fee',
  activity: 'A history of everything you have recycled, redeemed and offset',
  metrics: 'Live landfill diversion across the township, broken down by material',
  ledger: 'Operating ROI, payback and revenue forecast for the hub',
  logistics: 'Predicted hub capacity and AI dispatch of the collection fleet',
  hubs: 'Registered recycle hubs — open a hub to run the Smart Recycle Bin',
  hubstats: 'Hub station performance, material breakdown and contribution ranking',
}

function Sidebar({ menu, active, setActive, onLogout, onSeed, onReset, showOpsTools }) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="text-2xl">♻️</span>
        <div>
          <h1 className="text-base font-bold leading-tight text-slate-900">GreenLoop</h1>
          <p className="text-[11px] text-slate-500">Smart Recycling Ecosystem</p>
        </div>
      </div>

      <div className="px-3 pb-1">
        <p className="rounded-lg bg-green-50 px-2.5 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-green-700 ring-1 ring-green-200">
          {menu.label}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-0.5">
          {menu.items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActive(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                  active === item.id
                    ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-3">
        {showOpsTools && (
          <>
            <button onClick={onSeed} className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
              Load Demo Data
            </button>
            <button onClick={onReset} className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
              Reset
            </button>
          </>
        )}
        <button onClick={onLogout} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
          ⏻ Logout
        </button>
      </div>
    </aside>
  )
}

export default function App() {
  const { state, dispatch } = useStore()
  const session = state.auth?.session
  const [active, setActive] = useState('profile')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const menu = session ? MENUS[session.role] : null

  useEffect(() => {
    if (menu && !menu.items.some((i) => i.id === active)) setActive(menu.items[0].id)
  }, [menu, active])

  if (!session) return <AuthView />

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
  function logout() {
    dispatch({ type: 'LOGOUT' })
    setActive('profile')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <Sidebar
          menu={menu}
          active={active}
          setActive={setActive}
          onLogout={logout}
          onSeed={seed}
          onReset={reset}
          showOpsTools={session.role === 'ops'}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="rounded-md p-2 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900">{PAGE_TITLES[active]}</h2>
            <p className="truncate text-sm text-slate-500">{PAGE_SUBTITLES[active]}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight text-slate-800">{session.name}</p>
              <p className="font-mono text-[11px] text-slate-400">{session.id}</p>
            </div>
            {session.avatar ? (
              <img src={session.avatar} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-green-200" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-lg ring-2 ring-green-200">
                {session.role === 'ops' ? '🏢' : session.role === 'tenant' ? '🏬' : '🙋'}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl">
            {session.role === 'ops' ? (
              <ManagementView page={active} />
            ) : (
              <UserView page={active} role={session.role} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}