import { computeDropoff } from './engine.js'
import { COLLECTION_HUBS } from '../data/catalog.js'

// A realistic MONTHLY township-wide throughput so the dashboards and ROI look
// credible on first load. These totals represent everything collected across
// the month (bins are emptied repeatedly), not what sits in a bin at once —
// hub bin levels are tracked separately as a live snapshot.
//
// Rough scale: a few thousand residents recycling weekly -> several tonnes/mo.
//
// [itemId, quantity, hubId]
const SEED_PLAN = [
  // PET bottles — high count, township-wide (~0.03 kg each)
  ['pet-bottle', 42000, 'hub-elmina-west'],
  ['pet-bottle', 31000, 'hub-bukit-raja'],
  ['pet-bottle', 24000, 'hub-denai-alam'],
  // Aluminium cans (~0.015 kg each) — the high-value stream
  ['aluminum-can', 28000, 'hub-elmina-west'],
  ['aluminum-can', 15000, 'hub-lakeside-mall'],
  ['aluminum-can', 9000, 'hub-bukit-subang'],
  // Paper cartons
  ['paper-carton', 14000, 'hub-elmina-west'],
  ['paper-carton', 9000, 'hub-lakeside-mall'],
  // Cardboard (mall tenants + households, ~0.4 kg each)
  ['cardboard-box', 4200, 'hub-elmina-east'],
  ['cardboard-box', 5200, 'hub-lakeside-mall'],
  // E-waste (~0.25 kg each) — high value per kg
  ['ewaste-small', 1100, 'hub-denai-alam'],
  ['ewaste-small', 1400, 'hub-bukit-raja'],
  // Appliances (bulky, ~12 kg each)
  ['appliance-microwave', 140, 'hub-bukit-raja'],
]

const HUB_IDS = new Set(COLLECTION_HUBS.map((h) => h.id))

// Modest personal drop-off history so each persona looks populated on load.
// Residence = household-scale; Tenant = commercial bulk.
const RESIDENCE_HISTORY = [
  ['pet-bottle', 24],
  ['aluminum-can', 18],
  ['paper-carton', 12],
  ['cardboard-box', 3],
  ['pet-bottle', 20],
  ['aluminum-can', 25],
  ['ewaste-small', 2],
]
const TENANT_HISTORY = [
  ['cardboard-box', 120],
  ['pet-bottle', 480],
  ['aluminum-can', 650],
  ['paper-carton', 240],
  ['cardboard-box', 90],
  ['ewaste-small', 18],
]

export function buildAccountHistory(kind) {
  const plan = kind === 'tenant' ? TENANT_HISTORY : RESIDENCE_HISTORY
  return plan.map(([itemId, quantity]) => computeDropoff(itemId, quantity))
}

export function buildSeedTransactions() {
  const now = Date.now()
  return SEED_PLAN.filter(([, , hubId]) => HUB_IDS.has(hubId)).map(
    ([itemId, quantity, hubId], idx) => {
      const result = computeDropoff(itemId, quantity)
      return {
        id: `seed-${itemId}-${hubId}`,
        timestamp: now - idx * 1800_000,
        hubId,
        ...result,
      }
    }
  )
}
