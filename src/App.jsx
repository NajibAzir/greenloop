import { useState, useMemo, useEffect, useRef } from 'react'
import { useStore, useTheme } from './store/StoreContext.jsx'
import { GREEN_THEMES } from './data/themes.js'
import { buildSeedTransactions, buildAccountHistory } from './lib/seed.js'
import ResidentView from './views/ResidentView.jsx'
import ManagementView from './views/ManagementView.jsx'
import ProfileView from './views/ProfileView.jsx'
import RecycleHubView from './views/RecycleHubView.jsx'
import HubStatView from './views/HubStatView.jsx'
import SlidingToggle from './components/SlidingToggle.jsx'
import { LogoLoaderIcon, PageLoader, PAGE_LOAD_MS } from './components/RecycleLoader.jsx'
import {
  ResidentIcon,
  OperationsIcon,
  ScanDropoffIcon,
  VoucherIcon,
  MaintenanceOffsetIcon,
  ActivityIcon,
  MetricsIcon,
  LedgerIcon,
  LogisticsIcon,
  ThemeLeafIcon,
  SunIcon,
  MoonIcon,
} from './components/NavIcons.jsx'

// Two personas, each with its own menu. The sidebar shows only the active
// persona's items; a top-level switch toggles between them.
const MODES = {
  resident: {
    label: 'Resident & Tenant',
    short: 'Resident',
    icon: ResidentIcon,
    items: [
      { id: 'profile', label: 'Profile', icon: ResidentIcon },
      { id: 'dropoff', label: 'Scan & Drop-off', icon: ScanDropoffIcon },
      { id: 'redeem', label: 'Redeem Vouchers', icon: VoucherIcon },
      { id: 'offset', label: 'Offset Maintenance Fee', icon: MaintenanceOffsetIcon },
      { id: 'activity', label: 'My Activity', icon: ActivityIcon },
    ],
  },
  management: {
    label: 'Developer Operations',
    short: 'Operations',
    icon: OperationsIcon,
    items: [
      { id: 'metrics', label: 'Diversion Metrics', icon: MetricsIcon },
      { id: 'ledger', label: 'Financial Ledger', icon: LedgerIcon },
      { id: 'logistics', label: 'Logistics & Dispatch', icon: LogisticsIcon },
      { id: 'recyclehub', label: 'Recycle Hub', icon: OperationsIcon },
      { id: 'hubstat', label: 'Hub Stat', icon: MetricsIcon },
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

// Tailwind `lg` breakpoint: above it the sidebar is a static column, below it
// an off-canvas drawer.
const LG = 1024
const isDesktop = () => typeof window !== 'undefined' && window.innerWidth >= LG

function ModeSwitch({ mode, setMode }) {
  const items = Object.entries(MODES).map(([key, m]) => ({
    id: key,
    label: m.short,
    title: m.label,
    icon: m.icon,
  }))

  return (
    <div className="w-full">
      <SlidingToggle
        items={items}
        value={mode}
        onChange={setMode}
        trackClassName="gl-mode-track w-full rounded-lg"
        pillClassName="gl-mode-active rounded-md"
        btnClassName="gl-mode-switch-btn w-full gap-1.5 px-2 py-1.5 text-xs font-semibold"
        ariaLabel="Persona Mode Switcher"
        renderItem={(item) => {
          const Icon = item.icon
          return (
            <>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{item.label}</span>
            </>
          )
        }}
      />
    </div>
  )
}

function ThemeSwitcher() {
  const { themeId, setThemeId, colorMode, toggleColorMode } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const currentTheme = useMemo(
    () => GREEN_THEMES.find((t) => t.id === themeId) || GREEN_THEMES[0],
    [themeId]
  )

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen((p) => !p)}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title={`Choose from ${GREEN_THEMES.length} color themes`}
          className="gl-theme-trigger-btn group"
        >
          <ThemeLeafIcon className="h-3.5 w-3.5 shrink-0 text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-transform duration-200 group-hover:rotate-12" />
          <span className="font-semibold text-xs tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
            Theme
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold text-white shadow-inner ring-1 ring-white/20">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/50 shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${currentTheme.swatch} 55%, ${currentTheme.swatchSecondary} 100%)`,
              }}
            />
            <span>{currentTheme.short}</span>
          </span>
          <svg
            className={`h-3.5 w-3.5 text-white/85 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {isOpen && (
          <div
            className="gl-theme-menu absolute right-0 top-full mt-2 w-64 rounded-2xl p-2 z-[100] shadow-2xl origin-top-right transition-all animate-in fade-in zoom-in-95 duration-150"
            role="menu"
            aria-orientation="vertical"
            aria-label="Theme options"
          >
            <div className="px-2.5 py-1.5 mb-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ThemeLeafIcon className="h-3 w-3 text-emerald-500" />
                Select Theme ({GREEN_THEMES.length})
              </span>
              <span className="text-[10px] font-semibold" style={{ color: currentTheme.swatch }}>
                {currentTheme.short}
              </span>
            </div>
            <div className="space-y-1">
              {GREEN_THEMES.map((t) => {
                const active = themeId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setThemeId(t.id)
                      setIsOpen(false)
                    }}
                    className={`gl-theme-option w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-left transition cursor-pointer select-none ${
                      active ? 'gl-theme-option-active' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-5 w-5 shrink-0 rounded-full ring-2 ring-black/10 dark:ring-white/20 shadow-sm"
                        style={{
                          background: `linear-gradient(135deg, ${t.swatch} 55%, ${t.swatchSecondary} 100%)`,
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                          <span>{t.short}</span>
                          {active && (
                            <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wide">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-normal leading-tight opacity-75 truncate">
                          {t.label}
                        </div>
                      </div>
                    </div>
                    {active && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={toggleColorMode}
        title={colorMode === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
        aria-label={colorMode === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 shadow-sm cursor-pointer"
        style={{
          background: colorMode === 'dark' ? 'rgba(2, 44, 34, 0.75)' : 'rgba(255, 255, 255, 0.9)',
          border: colorMode === 'dark' ? '1px solid rgba(52, 211, 153, 0.45)' : '1px solid rgba(203, 213, 225, 0.85)',
          color: colorMode === 'dark' ? '#ecfdf5' : '#0f172a',
          boxShadow: colorMode === 'dark' ? '0 0 12px rgba(16, 185, 129, 0.25)' : '0 1px 3px rgba(0, 0, 0, 0.08)',
        }}
      >
        <span className="flex items-center justify-center leading-none" aria-hidden="true">
          {colorMode === 'dark' ? (
            <MoonIcon className="h-3.5 w-3.5 text-emerald-300" />
          ) : (
            <SunIcon className="h-3.5 w-3.5 text-amber-500" />
          )}
        </span>
        <span className="font-bold">{colorMode === 'dark' ? 'Dark' : 'Light'}</span>
      </button>
    </div>
  )
}

function Sidebar({ mode, setMode, active, setActive, onSeed, onReset, loadClicked, resetClicked, items, loadingId, onCollapse }) {
  return (
    <aside className="gl-sidebar flex h-full w-72 max-w-[85vw] shrink-0 flex-col border-r border-slate-200 lg:w-72">
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/greenloop-icon.png"
            alt="GreenLoop Emblem"
            className="h-11 w-auto shrink-0 select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-transform duration-300 hover:scale-105"
          />
          <div className="min-w-0">
            <h1 className="sr-only">GreenLoop</h1>
            <img
              src="/greenloop-wordmark-white.png"
              alt="GreenLoop"
              className="h-[25px] w-auto max-w-[145px] select-none object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
            />
            <p className="whitespace-nowrap text-xs font-medium text-slate-300/85 tracking-tight mt-0.5">
              Smart Recycling Ecosystem
            </p>
          </div>
        </div>
        <button
          onClick={onCollapse}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
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
            const isLoading = loadingId === item.id
            const Icon = item.icon
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActive(item.id)}
                  aria-busy={isLoading}
                  className={`gl-nav-btn flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium cursor-pointer ${
                    isActive
                      ? 'gl-nav-btn-active bg-green-50 text-green-700 ring-1 ring-green-200'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="gl-nav-icon flex h-5 w-5 shrink-0 items-center justify-center text-base">
                    {isLoading ? <LogoLoaderIcon className="h-4 w-auto" /> : <Icon className="h-4 w-4 shrink-0" />}
                  </span>
                  <span className="whitespace-nowrap">{item.label}</span>
                  {isLoading && <span className="ml-auto text-[10px] font-semibold opacity-80">loading…</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-3">
        <button
          onClick={onSeed}
          className={`gl-footer-btn gl-footer-btn-load w-full rounded-lg px-3 py-2 text-xs font-semibold ring-1 ${
            loadClicked ? 'gl-load-active' : ''
          }`}
        >
          Load Demo Data
        </button>
        <button
          onClick={onReset}
          className={`gl-footer-btn w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 ${
            resetClicked ? 'gl-reset-active' : ''
          }`}
        >
          Reset
        </button>
      </div>
    </aside>
  )
}

export default function App() {
  const [mode, setMode] = useState('resident')
  const [active, setActive] = useState('dropoff')
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop)
  const [loadClicked, setLoadClicked] = useState(false)
  const [resetClicked, setResetClicked] = useState(false)
  const { state, dispatch } = useStore()

  // Keep the sidebar sensible across resize: open on desktop, closed on mobile.
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

  // Page-transition loader: show the spinning recycling logo briefly before
  // rendering the newly selected page.
  const [loadingId, setLoadingId] = useState(null)
  const loadTimer = useRef(null)
  useEffect(() => () => clearTimeout(loadTimer.current), [])

  function navigate(id) {
    clearTimeout(loadTimer.current)
    setActive(id)
    setLoadingId(id)
    loadTimer.current = setTimeout(() => setLoadingId(null), PAGE_LOAD_MS)
    closeOnMobile()
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    navigate(MODES[nextMode].items[0].id) // jump to that mode's first page
  }

  function seed() {
    setLoadClicked(true)
    dispatch({
      type: 'SEED',
      transactions: buildSeedTransactions(),
      residenceTx: buildAccountHistory('residence'),
      tenantTx: buildAccountHistory('tenant'),
    })
    setTimeout(() => setLoadClicked(false), 350)
  }
  function reset() {
    setResetClicked(true)
    setTimeout(() => {
      if (confirm('Reset the demo? This clears all Green Points, drop-offs and vouchers.')) {
        dispatch({ type: 'RESET' })
      }
      setTimeout(() => setResetClicked(false), 350)
    }, 40)
  }

  function renderPage() {
    if (active === 'profile') return <ProfileView />
    if (active === 'recyclehub') return <RecycleHubView />
    if (active === 'hubstat') return <HubStatView />
    return mode === 'resident' ? <ResidentView page={active} /> : <ManagementView page={active} />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Backdrop (mobile only, when drawer open) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: off-canvas drawer on mobile, static column on lg+ */}
      {sidebarOpen && (
        <div className="fixed inset-y-0 left-0 z-40 lg:static lg:z-auto">
          <Sidebar
            mode={mode}
            setMode={(m) => {
              switchMode(m)
            }}
            active={active}
            setActive={navigate}
            loadingId={loadingId}
            items={menuItems}
            onSeed={seed}
            onReset={reset}
            loadClicked={loadClicked}
            resetClicked={resetClicked}
            onCollapse={() => setSidebarOpen(false)}
          />
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Sime Darby Property translucent backdrop */}
        <div className="gl-simedarby-bg" aria-hidden="true" />

        <header className="gl-header relative z-40 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="gl-sidebar-toggle flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 active:scale-95"
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-expanded={sidebarOpen}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2.5" />
                <path d="M9 3v18" />
                {sidebarOpen ? <path d="m16 15-3-3 3-3" /> : <path d="m13 9 3 3-3 3" />}
              </svg>
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">{PAGE_TITLES[active]}</h2>
              <p className="truncate text-xs text-slate-500 sm:text-sm">{PAGE_SUBTITLES[active]}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeSwitcher />
          </div>
        </header>

        <main className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className={`mx-auto max-w-5xl ${loadingId ? 'h-full' : ''}`}>
            {loadingId ? <PageLoader label={PAGE_TITLES[loadingId]} /> : renderPage()}
          </div>
        </main>
      </div>
    </div>
  )
}
