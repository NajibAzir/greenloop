import { createContext, useContext, useEffect, useReducer } from 'react'
import { reducer, initialState, STORAGE_KEY } from './reducer.js'

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

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, lazyInit)

  // Persist to localStorage on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage may be unavailable; demo still works in-memory
    }
  }, [state])

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within a StoreProvider')
  return ctx
}

// Convenience: the currently-active persona account (residence or tenant).
export function useAccount() {
  const { state } = useStore()
  return state.accounts[state.accountType]
}
