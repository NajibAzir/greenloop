import { useState, useMemo, useEffect } from 'react'
import { useStore, useProfile } from './store/StoreContext.jsx'
import { buildSeedTransactions, buildAccountHistory } from './lib/seed.js'
import LoginView from './views/LoginView.jsx'
import ProfileView from './views/ProfileView.jsx'
import ResidentView from './views/ResidentView.jsx'
import ManagementView from './views/ManagementView.jsx'
import RecycleHubView from './views/RecycleHubView.jsx'
import HubStatView from './views/HubStatView.jsx'

// Menus per role. `view` tells the shell which component renders the page.
const ROLE_MENUS = {
  residence: {
    label: 'User View',
    items: [
      { id: 'profile', label: 'Profile', icon: '🧑', view: 'profile' },
      { id: 'dropoff', label: 'Scan', icon: '📷', view: 'resident' },
      { id: 'redeem', label: 'Redeem', icon: '🎟️', view: 'resident' },
      { id: 'activity', label: 'Activity', icon: '📜', view: 'resident' },
    ],
  },
  tenant: {
    label: 'Tenant View',
    items: [
      { id: 'profile', label: 'Profile', icon: '🏬', view: 'profile' },
      { id: 'dropoff', label: 'Scan', icon: '📷', view: 'resident' },
      { id: 'offset', label: 'Offset Maintenance Fee', icon: '🏠', view: 'resident' },
      { id: 'activity', label: 'Activity', icon: '📜', view: 'resident' },
    ],
  },
  operation: {
    label: 'Operation View',
    items: [
      { id: 'metrics', label: 'Diversion Metrics', icon: '📊', view: 'management' },
      { id: 'ledger', label: 'Financial Ledger', icon: '💰', view: 'management' },
      { id: 'logistics', label: 'Logistics & Dispatch', icon: '🚛', view: 'management' },
      { id: 'recyclehub', label: 'Recycle Hub', icon: '🗑️', view: 'recyclehub' },
      { id: 'hubstat', label: 'Hub Stat', icon: '📈', view: 'hubstat' },
    ],
  },
}

const PAGE_META = {
  profile: ['Profile', 'Your account, Green Point balance and settings'],
  dropoff: ['Scan & Drop-off', 'Scan the recycle hub QR, then drop items to earn Green Points.'],
  redeem: ['Redeem Vouchers', 'Spend your Green Points like cash at township mall tenants.'],
  offset: ['Offset Maintenance Fee', 'Apply Green Points to this month’s charge.'],
  activity: ['Activity', 'A history of everything you have recycled, redeemed and offset.'],
  metrics: ['Diversion Metrics', 'Live landfill diversion across the township, broken down by material.'],
  ledger: ['Financial Ledger', 'Operating ROI, payback and revenue forecast for the hub.'],
  logistics: ['Logistics & Dispatch', 'Predicted hub capacity and AI dispatch of the collection fleet.'],
  recyclehub: ['Recycle Hub', 'Registered recycle hubs — open a hub to run the Smart Recycle Bin.'],
  hubstat: ['Hub Stat', 'Hub station performance, material breakdown and contribution ranking.'],
}

// Which login role each profile maps to (for the demo role toggle).
const ROLE_ORDER = ['residence', 'tenant', 'operation']
const ROLE_SHORT = { residence: 'User', tenant: 'Tenant', operation: 'Operation' }
const ROLE_ICON = { residence: '🧑', tenant: '🏬', operation: '🏢' }

function RoleToggle({ role, onSwitch }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
      {ROLE_ORDER.map((r) => (
        <button
          key={r}
          onClick={() => onSwitch(r)}
          className={`flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-semibold transition ${
            role === r ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          title={ROLE_SHORT[r]}
        >
          <span>{ROLE_ICON[r]}</span>
          <span>{ROLE_SHORT[r]}</span>
        </button>
      ))}
    </div>
  )
}

function Sidebar({ role, menu, active, setActive, onSwitchRole, onSeed, onReset, onCollapse, onLogout }) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
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
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Hide menu"
          aria-label="Hide menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="space-y-2 px-3 pb-3">
        <RoleToggle role={role} onSwitch={onSwitchRole} />
        <p className="px-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {menu.label}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">
          {menu.items.map((item) => {
            const isActive = active === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActive(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'text-slate-600 hover:bg-slate-50'
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
        {role === 'operation' && (
          <>
            <button onClick={onSeed} className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
              Load Demo Data
            </button>
            <button onClick={onReset} className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
              Reset
            </button>
          </>
        )}
        <button onClick={onLogout} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900">
          ⎋ Logout
        </button>
      </div>
    </aside>
  )
}

export default function App() {
  const { state, dispatch } = useStore()
  const profile = useProfile()
  const [active, setActive] = useState('profile')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const role = state.auth?.role
  const loggedIn = state.auth?.loggedIn
  const menu = role ? ROLE_MENUS[role] : null

  // When role changes, jump to that role's first menu item.
  useEffect(() => {
    if (menu && !menu.items.some((i) => i.id === active)) {
      setActive(menu.items[0].id)
    }
  }, [role]) // eslint-disable-line react-hooks/exhaustive-deps

  function seed() {
    dispatch({
      type: 'SEED',
      transactions: buildSeedTransactions(),
      residenceTx: buildAccountHistory('residence'),
      tenantTx: buildAccountHistory('tenant'),
    })
  }
  function reset() {
    if (confirm('Reset the demo? This clears Green Points, drop-offs and vouchers.')) {
      dispatch({ type: 'RESET' })
    }
  }
  function switchRole(r) {
    dispatch({ type: 'SWITCH_ROLE', role: r })
    setActive(ROLE_MENUS[r].items[0].id)
  }

  if (!loggedIn || !menu) return <LoginView />

  const activeItem = menu.items.find((i) => i.id === active) || menu.items[0]
  const [title, subtitle] = PAGE_META[active] || [activeItem.label, '']

  function renderPage() {
    switch (activeItem.view) {
      case 'profile':
        return <ProfileView />
      case 'resident':
        return <ResidentView page={active} />
      case 'management':
        return <ManagementView page={active} />
      case 'recyclehub':
        return <RecycleHubView />
      case 'hubstat':
        return <HubStatView />
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <Sidebar
          role={role}
          menu={menu}
          active={active}
          setActive={setActive}
          onSwitchRole={switchRole}
          onSeed={seed}
          onReset={reset}
          onCollapse={() => setSidebarOpen(false)}
          onLogout={() => dispatch({ type: 'LOGOUT' })}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="rounded-md p-2 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-700"
            title={sidebarOpen ? 'Hide menu' : 'Show menu'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          {/* Identity chip */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800">{profile?.name}</p>
              <p className="text-[11px] text-slate-400">{profile?.id}</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-green-100 text-lg ring-2 ring-green-200">
              {ROLE_ICON[role]}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl">{renderPage()}</div>
        </main>
      </div>
    </div>
  )
}
