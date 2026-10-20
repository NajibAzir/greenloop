import { describe, it, expect } from 'vitest'
import { reducer, initialState } from './reducer.js'
import { TOKEN_TO_RM, VOUCHERS } from '../data/catalog.js'

// Helper: the active persona account.
const acc = (s) => s.accounts[s.accountType]

// Build a state whose active account has a given GP balance.
function withBalance(gp, accountType = 'residence') {
  const s = initialState()
  s.accountType = accountType
  s.accounts[accountType].tokenBalance = gp
  return s
}

describe('reducer', () => {
  it('DROP_OFF credits the active account and feeds ops', () => {
    const s = reducer(initialState(), { type: 'DROP_OFF', itemId: 'pet-bottle', quantity: 100 })
    expect(acc(s).transactions).toHaveLength(1)
    expect(acc(s).tokenBalance).toBe(acc(s).transactions[0].tokensAwarded)
    expect(acc(s).tokenBalance).toBeGreaterThan(0)
    expect(s.opsTransactions).toHaveLength(1) // township metrics fed too
  })

  it('DROP_OFF ignores zero quantity', () => {
    const s = reducer(initialState(), { type: 'DROP_OFF', itemId: 'pet-bottle', quantity: 0 })
    expect(acc(s).transactions).toHaveLength(0)
    expect(acc(s).tokenBalance).toBe(0)
  })

  it('residence and tenant balances are independent', () => {
    let s = reducer(initialState(), { type: 'DROP_OFF', itemId: 'pet-bottle', quantity: 100 })
    const resBal = s.accounts.residence.tokenBalance
    expect(resBal).toBeGreaterThan(0)
    expect(s.accounts.tenant.tokenBalance).toBe(0) // tenant untouched
    // Switch persona and drop again — residence stays put.
    s = reducer(s, { type: 'SET_ACCOUNT', accountType: 'tenant' })
    s = reducer(s, { type: 'DROP_OFF', itemId: 'pet-bottle', quantity: 100 })
    expect(s.accounts.residence.tokenBalance).toBe(resBal)
    expect(s.accounts.tenant.tokenBalance).toBeGreaterThan(0)
  })

  it('REDEEM_VOUCHER deducts tokens from the active account when affordable', () => {
    const v = VOUCHERS[0]
    let s = withBalance(v.costTokens + 50)
    s = reducer(s, { type: 'REDEEM_VOUCHER', voucherId: v.id })
    expect(acc(s).tokenBalance).toBe(50)
    expect(acc(s).redeemedVouchers).toHaveLength(1)
  })

  it('REDEEM_VOUCHER is a no-op when the user cannot afford it', () => {
    const v = VOUCHERS[0]
    const start = withBalance(v.costTokens - 1)
    const s = reducer(start, { type: 'REDEEM_VOUCHER', voucherId: v.id })
    expect(s).toEqual(start)
  })

  it('REDEEM_VOUCHER attaches a code and an unused flag', () => {
    const v = VOUCHERS[0]
    const s = reducer(withBalance(v.costTokens), { type: 'REDEEM_VOUCHER', voucherId: v.id })
    const rv = acc(s).redeemedVouchers[0]
    expect(rv.used).toBe(false)
    expect(rv.code).toMatch(/^GL-/)
  })

  it('MARK_VOUCHER_USED flips the used flag', () => {
    const v = VOUCHERS[0]
    let s = reducer(withBalance(v.costTokens), { type: 'REDEEM_VOUCHER', voucherId: v.id })
    const id = acc(s).redeemedVouchers[0].id
    s = reducer(s, { type: 'MARK_VOUCHER_USED', id })
    expect(acc(s).redeemedVouchers[0].used).toBe(true)
  })

  it('OFFSET_FEE applies GP value to the maintenance fee and logs it', () => {
    let s = withBalance(1000) // 1000 GP = RM 100
    s = reducer(s, { type: 'OFFSET_FEE', tokens: 1000, rmPerToken: TOKEN_TO_RM })
    expect(acc(s).feeOffsetRm).toBe(100)
    expect(acc(s).tokenBalance).toBe(0)
    expect(acc(s).feeOffsets).toHaveLength(1)
    expect(acc(s).feeOffsets[0].rm).toBe(100)
  })

  it('OFFSET_FEE never offsets more than the fee', () => {
    let s = withBalance(100000) // way more than fee
    s = reducer(s, { type: 'OFFSET_FEE', tokens: 100000, rmPerToken: TOKEN_TO_RM })
    expect(acc(s).feeOffsetRm).toBe(acc(s).maintenanceFee)
  })

  it('DROP_OFF adds the item weight to the home hub load', () => {
    const start = initialState()
    const baseA = start.hubLoads['hub-a']
    const s = reducer(start, { type: 'DROP_OFF', itemId: 'cardboard-box', quantity: 5 })
    // 5 boxes * 0.4 kg = 2 kg added to hub-a
    expect(s.hubLoads['hub-a']).toBeCloseTo(baseA + 2, 5)
  })

  it('SET_ACCOUNT switches the active persona', () => {
    const s = reducer(initialState(), { type: 'SET_ACCOUNT', accountType: 'tenant' })
    expect(s.accountType).toBe('tenant')
    expect(acc(s).maintenanceFee).toBe(980) // tenant service charge
  })

  it('RESET keeps the chosen account type but clears balances', () => {
    let dirty = withBalance(999, 'tenant')
    const s = reducer(dirty, { type: 'RESET' })
    expect(s.accountType).toBe('tenant')
    expect(acc(s).tokenBalance).toBe(0)
  })

  it('LOGIN with a demo credential logs into the right role', () => {
    const s = reducer(initialState(), { type: 'LOGIN', id: 'fath', password: 'greenloop' })
    expect(s.auth.loggedIn).toBe(true)
    expect(s.auth.role).toBe('residence')
    expect(s.accountType).toBe('residence')
  })

  it('LOGIN with operation id selects the operation role', () => {
    const s = reducer(initialState(), { type: 'LOGIN', id: 'Synkosys Operations', password: 'synkosys123' })
    expect(s.auth.role).toBe('operation')
  })

  it('LOGIN rejects bad credentials', () => {
    const s = reducer(initialState(), { type: 'LOGIN', id: 'fath', password: 'wrong' })
    expect(s.auth.loggedIn).toBe(false)
    expect(s.auth.error).toBeTruthy()
  })

  it('LOGOUT clears the session', () => {
    let s = reducer(initialState(), { type: 'LOGIN', role: 'tenant' })
    s = reducer(s, { type: 'LOGOUT' })
    expect(s.auth.loggedIn).toBe(false)
    expect(s.auth.role).toBe(null)
  })

  it('UPDATE_PROFILE edits the role profile', () => {
    let s = reducer(initialState(), { type: 'LOGIN', role: 'residence' })
    s = reducer(s, { type: 'UPDATE_PROFILE', patch: { name: 'New Name' } })
    expect(s.profiles.residence.name).toBe('New Name')
  })

  it('SEED keeps the user logged in', () => {
    let s = reducer(initialState(), { type: 'LOGIN', role: 'operation' })
    s = reducer(s, { type: 'SEED', transactions: [], residenceTx: [], tenantTx: [] })
    expect(s.auth.loggedIn).toBe(true)
    expect(s.auth.role).toBe('operation')
  })
})
