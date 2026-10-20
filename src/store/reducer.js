import { computeDropoff } from '../lib/engine.js'
import {
  VOUCHERS,
  HOME_HUB_ID,
  initialHubLoads,
  ACCOUNT_TYPES,
} from '../data/catalog.js'

export const STORAGE_KEY = 'greenloop-state-v2'

// A fresh per-persona account (resident OR mall tenant).
function emptyAccount(accountType) {
  const acct = ACCOUNT_TYPES[accountType]
  return {
    tokenBalance: 0,
    transactions: [], // resident's own drop-offs
    redeemedVouchers: [],
    maintenanceFee: acct.feeAmount,
    feeOffsetRm: 0,
    feeOffsets: [],
  }
}

// Editable profile cards per persona (no auth — just account details shown on
// the Profile page).
function defaultProfiles() {
  return {
    residence: {
      id: 'USER-00000001',
      name: 'fath',
      email: 'fathinzy@gmail.com',
      address: '16A, Jalan Anggerik, Kampung Melayu',
    },
    tenant: {
      id: 'TENT-00000001',
      name: 'kedai kopitiam',
      email: 'kopitiam@gmail.com',
      address: 'Lot G-08, Greenview Mall',
    },
  }
}

export function initialState() {
  return {
    accountType: 'residence', // active persona
    accounts: {
      residence: emptyAccount('residence'),
      tenant: emptyAccount('tenant'),
    },
    profiles: defaultProfiles(),
    // Township-wide operations data (independent of the active persona):
    opsTransactions: [], // feeds Diversion Metrics + Financial Ledger
    hubLoads: initialHubLoads(), // live bin levels for the dispatch sim seed
  }
}

let seq = 0
function uid(prefix) {
  seq += 1
  return `${prefix}-${Date.now()}-${seq}`
}

function makeVoucherCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const block = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `GL-${block()}-${block()}`
}

// Helper: apply an updater to the currently-active account.
function updateActive(state, updater) {
  const current = state.accounts[state.accountType]
  return {
    ...state,
    accounts: {
      ...state.accounts,
      [state.accountType]: updater(current),
    },
  }
}

export function reducer(state, action) {
  // Migrate older persisted shapes that lack `accounts`.
  if (!state.accounts) state = { ...initialState(), ...(state.accountType ? { accountType: state.accountType } : {}) }

  switch (action.type) {
    case 'DROP_OFF': {
      const result = computeDropoff(action.itemId, action.quantity)
      if (result.quantity <= 0) return state
      const hubId = action.hubId || HOME_HUB_ID
      const tx = { id: uid('tx'), timestamp: action.timestamp || Date.now(), hubId, ...result }
      // Credit the active persona's GP + history.
      const next = updateActive(state, (a) => ({
        ...a,
        tokenBalance: a.tokenBalance + result.tokensAwarded,
        transactions: [tx, ...a.transactions],
      }))
      // Also feed township operations + the local hub bin.
      const hubLoads = { ...next.hubLoads }
      hubLoads[hubId] = (hubLoads[hubId] || 0) + result.totalWeight
      return { ...next, opsTransactions: [tx, ...next.opsTransactions], hubLoads }
    }

    case 'REDEEM_VOUCHER': {
      const voucher = VOUCHERS.find((v) => v.id === action.voucherId)
      if (!voucher) return state
      const a = state.accounts[state.accountType]
      if (a.tokenBalance < voucher.costTokens) return state // cannot afford
      return updateActive(state, (acc) => ({
        ...acc,
        tokenBalance: acc.tokenBalance - voucher.costTokens,
        redeemedVouchers: [
          {
            id: uid('rv'),
            voucherId: voucher.id,
            name: voucher.name,
            value: voucher.value,
            costTokens: voucher.costTokens,
            emoji: voucher.emoji,
            code: action.code || makeVoucherCode(),
            used: false,
            timestamp: action.timestamp || Date.now(),
          },
          ...acc.redeemedVouchers,
        ],
      }))
    }

    case 'MARK_VOUCHER_USED': {
      return updateActive(state, (a) => ({
        ...a,
        redeemedVouchers: a.redeemedVouchers.map((r) =>
          r.id === action.id ? { ...r, used: true, usedAt: action.timestamp || Date.now() } : r
        ),
      }))
    }

    case 'OFFSET_FEE': {
      const a = state.accounts[state.accountType]
      const tokens = Math.min(action.tokens, a.tokenBalance)
      if (tokens <= 0) return state
      const rm = tokens * action.rmPerToken
      const remainingFee = a.maintenanceFee - a.feeOffsetRm
      const applied = Math.min(rm, remainingFee)
      if (applied <= 0) return state
      const tokensUsed = Math.ceil(applied / action.rmPerToken)
      return updateActive(state, (acc) => ({
        ...acc,
        tokenBalance: acc.tokenBalance - tokensUsed,
        feeOffsetRm: Math.min(acc.maintenanceFee, acc.feeOffsetRm + applied),
        feeOffsets: [
          {
            id: uid('fo'),
            rm: Math.round(applied * 100) / 100,
            tokensUsed,
            timestamp: action.timestamp || Date.now(),
          },
          ...acc.feeOffsets,
        ],
      }))
    }

    case 'SET_ACCOUNT': {
      if (!ACCOUNT_TYPES[action.accountType] || action.accountType === state.accountType) return state
      return { ...state, accountType: action.accountType }
    }

    case 'UPDATE_PROFILE': {
      const persona = action.persona || state.accountType
      if (!state.profiles?.[persona]) return state
      return {
        ...state,
        profiles: { ...state.profiles, [persona]: { ...state.profiles[persona], ...action.patch } },
      }
    }

    case 'SEED': {
      // Township operations throughput (ledger/metrics) + a modest per-account
      // starting balance/history so both personas look populated.
      const txs = action.transactions
      const base = initialState()
      return {
        ...base,
        accountType: state.accountType,
        profiles: state.profiles,
        opsTransactions: txs,
        accounts: {
          residence: seedAccount('residence', action.residenceTx || []),
          tenant: seedAccount('tenant', action.tenantTx || []),
        },
      }
    }

    case 'RESET':
      return { ...initialState(), accountType: state.accountType, profiles: state.profiles }

    case 'HYDRATE':
      return { ...initialState(), ...action.state }

    default:
      return state
  }
}

// Build a seeded account from a list of drop-off results.
function seedAccount(accountType, txs) {
  const a = emptyAccount(accountType)
  const withIds = txs.map((t, i) => ({ id: `seed-${accountType}-${i}`, timestamp: Date.now() - i * 86400000, ...t }))
  return {
    ...a,
    transactions: withIds,
    tokenBalance: withIds.reduce((s, t) => s + t.tokensAwarded, 0),
  }
}
