import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import { reducer, initialState, STORAGE_KEY } from './reducer.js'
import { DEFAULT_THEME_ID, THEME_STORAGE_KEY, getTheme } from '../data/themes.js'

const StoreContext = createContext(null)

function lazyInit() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...initialState(), ...parsed }
    }
  } catch {
    // ignore corrupt storage
  }
  return initialState()
}

export const COLOR_MODE_STORAGE_KEY = 'greenloop-color-mode'

function initColorMode() {
  try {
    const saved = localStorage.getItem(COLOR_MODE_STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // ignore
  }
  return 'light'
}

function initThemeId() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved) return getTheme(saved).id
  } catch {
    // ignore storage errors
  }
  return DEFAULT_THEME_ID
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, lazyInit)
  const [themeId, setThemeId] = useState(initThemeId)
  const [colorMode, setColorMode] = useState(initColorMode)

  const toggleColorMode = () => {
    setColorMode((m) => (m === 'dark' ? 'light' : 'dark'))
  }

  // Persist app state to localStorage on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage may be unavailable; demo still works in-memory
    }
  }, [state])

  // Apply data-theme attribute to <html> and persist theme selection.
  useEffect(() => {
    const theme = getTheme(themeId)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme.id)
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme.id)
    } catch {
      // ignore storage errors
    }
  }, [themeId])

  // Apply data-color-mode attribute and .dark class to <html> and persist.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-color-mode', colorMode)
      if (colorMode === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode)
    } catch {
      // ignore
    }
  }, [colorMode])

  const theme = getTheme(themeId)

  return (
    <StoreContext.Provider
      value={{
        state,
        dispatch,
        themeId: theme.id,
        setThemeId,
        theme,
        colorMode,
        setColorMode,
        toggleColorMode,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within a StoreProvider')
  return ctx
}

export function useTheme() {
  const ctx = useContext(StoreContext)
  if (!ctx) {
    return {
      themeId: DEFAULT_THEME_ID,
      setThemeId: () => {},
      theme: getTheme(DEFAULT_THEME_ID),
      colorMode: 'light',
      setColorMode: () => {},
      toggleColorMode: () => {},
    }
  }
  return {
    themeId: ctx.themeId,
    setThemeId: ctx.setThemeId,
    theme: ctx.theme,
    colorMode: ctx.colorMode,
    setColorMode: ctx.setColorMode,
    toggleColorMode: ctx.toggleColorMode,
  }
}

// Convenience: the currently-active persona account (residence or tenant).
export function useAccount() {
  const { state } = useStore()
  return state.accounts[state.accountType]
}
