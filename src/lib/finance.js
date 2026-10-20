import { ECONOMICS, CO2_PER_KG, MALAYSIA_SEASONALITY } from '../data/catalog.js'
import { aggregate } from './engine.js'

// Small deterministic pseudo-random wobble so months look organic but stable
// across re-renders (seeded by the month offset).
function wobble(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x) - 0.5) * 0.06 // ±3%
}

function round(n, dp = 2) {
  const f = 10 ** dp
  return Math.round((n + Number.EPSILON) * f) / f
}

/**
 * Compute the ROI snapshot for the recycling hub from current transactions.
 * This represents the economics "to date" (the diverted volume collected so
 * far), treated as roughly one operating month for the dashboard.
 */
export function computeRoi(transactions) {
  const agg = aggregate(transactions)
  const kg = agg.totalWeight
  const tonnes = kg / 1000

  // Benefits
  const avoidedHaulage = round(tonnes * ECONOMICS.avoidedHaulageRmPerTonne)
  const commoditySales = round(agg.totalBulkValue)
  const carbonValue = round((agg.totalCo2 / 1000) * ECONOMICS.carbonRmPerTonneCo2)
  const totalBenefit = round(avoidedHaulage + commoditySales + carbonValue)

  // Costs
  const opex = ECONOMICS.hubOpexPerMonth
  // Only the GP residents actually redeem is a real cash cost.
  const gpIssuedRm = agg.tokenPayoutRm
  const gpRedeemedRm = round(gpIssuedRm * ECONOMICS.gpRedemptionRate)
  const totalCost = round(opex + gpRedeemedRm)

  const netSurplus = round(totalBenefit - totalCost)
  const roiPct = totalCost > 0 ? round((netSurplus / totalCost) * 100, 0) : 0

  // Outstanding GP liability (issued but not yet redeemed).
  const gpLiabilityRm = round(gpIssuedRm - gpRedeemedRm)

  // Payback: how many months of this surplus to cover the one-time CapEx.
  const paybackMonths = netSurplus > 0 ? round(ECONOMICS.hubCapex / netSurplus, 1) : null

  return {
    kg,
    tonnes: round(tonnes, 2),
    avoidedHaulage,
    commoditySales,
    carbonValue,
    totalBenefit,
    opex,
    gpIssuedRm,
    gpRedeemedRm,
    gpLiabilityRm,
    totalCost,
    netSurplus,
    roiPct,
    capex: ECONOMICS.hubCapex,
    paybackMonths,
  }
}

/**
 * Project monthly benefit, cost, surplus and cumulative ROI over `months`,
 * growing volume by the assumed monthly engagement growth rate.
 * Month 0 is the current snapshot; subsequent months compound.
 *
 * The forecast is explicitly a forward projection, so future months are
 * expected here. To avoid a dead-straight 8% line we layer the calendar's
 * Malaysian seasonality and a small deterministic wobble on top of the growth
 * trend, so volume genuinely rises and falls month to month.
 */
export function forecast(transactions, months = 12) {
  const base = computeRoi(transactions)
  const g = 1 + ECONOMICS.monthlyGrowthRate
  const { year: ny, month: nm } = nowParts()
  const rows = []
  let cumulativeNet = -ECONOMICS.hubCapex // start in the hole by the setup cost

  for (let m = 1; m <= months; m++) {
    // Calendar month this projection step lands on.
    const calMonth = (nm + m) % 12
    const season = MALAYSIA_SEASONALITY[calMonth] / MALAYSIA_SEASONALITY[nm]
    const trend = g ** (m - 1)
    const scale = trend * season * (1 + wobble(ny * 12 + nm + m))
    const benefit = round(base.totalBenefit * scale)
    // Opex is fixed; GP redemption scales with volume.
    const cost = round(base.opex + base.gpRedeemedRm * scale)
    const net = round(benefit - cost)
    cumulativeNet = round(cumulativeNet + net)
    rows.push({
      month: m,
      label: `M${m}`,
      benefit,
      cost,
      net,
      cumulative: cumulativeNet,
    })
  }

  // First month where cumulative turns positive = payback point.
  const paybackMonth = rows.find((r) => r.cumulative >= 0)?.month ?? null

  return {
    rows,
    paybackMonth,
    endCumulative: rows.length ? rows[rows.length - 1].cumulative : -ECONOMICS.hubCapex,
    totalBenefit: round(rows.reduce((s, r) => s + r.benefit, 0)),
  }
}

// Current date anchor (recomputed per call; the sim treats "today" as now).
// `day` is the day-of-month (1-based) and `dayFraction` is how far through the
// current month we are, so the current month can be shown as PARTIAL (only the
// days elapsed so far), not a full month of data.
function nowParts() {
  const d = new Date()
  const year = d.getFullYear()
  const month = d.getMonth() // 0-11
  const day = d.getDate() // 1-based
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { year, month, day, daysInMonth, dayFraction: day / daysInMonth }
}

// Whole-month offset from the current month to the given year/month.
function offsetTo(year, month) {
  const { year: ny, month: nm } = nowParts()
  return (year - ny) * 12 + (month - nm)
}

/**
 * The modelled diversion for one calendar month = live run-rate × growth-trend
 * (relative to now) × Malaysian seasonality × deterministic wobble.
 *
 * Time semantics (so the dashboards never fabricate the future):
 *   - PAST months (off < 0): full month, with seasonality + organic wobble so
 *     the line genuinely rises and falls — not a smooth 8% ramp.
 *   - CURRENT month (off === 0): PARTIAL — scaled to the fraction of the month
 *     elapsed so far (e.g. on the 20th of a 31-day month ≈ 65%).
 *   - FUTURE months (off > 0): EMPTY. Returns `empty: true` with zeroed values
 *     so charts render nothing beyond today.
 */
export function monthValue(base, year, month) {
  const g = 1 + ECONOMICS.monthlyGrowthRate
  const { month: nm, dayFraction } = nowParts()
  const off = offsetTo(year, month)

  // Future months carry no data — nothing has been collected yet.
  if (off > 0) {
    return {
      offset: off,
      projected: true,
      empty: true,
      scale: 0,
      kg: null,
      rm: null,
      gp: null,
      co2: null,
      tokensAwarded: 0,
      totalWeight: 0,
      totalBulkValue: 0,
      totalCo2: 0,
      totalTokens: 0,
      tokenPayoutRm: 0,
    }
  }

  const trend = g ** off
  const seasonFactor = MALAYSIA_SEASONALITY[month] / MALAYSIA_SEASONALITY[nm]
  // Every past month gets an organic wobble; the current month is partial.
  const noise = off < 0 ? 1 + wobble(off) : 1
  const partial = off === 0 ? dayFraction : 1
  const scale = trend * seasonFactor * noise * partial
  return {
    offset: off,
    projected: false,
    empty: false,
    partial: off === 0,
    scale,
    kg: round(base.kg * scale, 1),
    rm: round(base.commoditySales * scale),
    gp: Math.round(base.gpIssuedRm * scale * 10),
    co2: round(base.kg * scale * CO2_PER_KG, 1),
    tokensAwarded: Math.round(base.gpIssuedRm * scale * 10),
    totalWeight: round(base.kg * scale, 1),
    totalBulkValue: round(base.commoditySales * scale),
    totalCo2: round(base.kg * scale * CO2_PER_KG, 1),
    totalTokens: Math.round(base.gpIssuedRm * scale * 10),
    tokenPayoutRm: round(base.gpIssuedRm * scale),
  }
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Projected FULL-month diversion for a future (or current) calendar month,
// using the growth trend × seasonality × deterministic wobble. Unlike
// `monthValue`, this deliberately models the future so a dashed forecast line
// can be drawn — it is never mixed into the "actual" series.
function projectedMonthKg(base, year, month) {
  const g = 1 + ECONOMICS.monthlyGrowthRate
  const { month: nm } = nowParts()
  const off = offsetTo(year, month)
  const trend = g ** off
  const season = MALAYSIA_SEASONALITY[month] / MALAYSIA_SEASONALITY[nm]
  const noise = 1 + wobble(off)
  return round(base.kg * trend * season * noise, 1)
}

/**
 * All 12 months of a given year as per-month diversion (kg).
 *   - `actual`   solid line, real data up to today (null in the future).
 *   - `forecast` dashed line, only populated when `withForecast` is true: it
 *     covers the current month onward so the projection visibly continues
 *     past where the actual data stops. Past months leave it null.
 * Used for the Monthly-view chart.
 */
export function monthlySeries(transactions, year, withForecast = false) {
  const base = computeRoi(transactions)
  const rows = []
  for (let m = 0; m < 12; m++) {
    const v = monthValue(base, year, m)
    let forecast = null
    if (withForecast) {
      if (v.offset === 0) {
        // Current month: anchor the projection to the ACTUAL (partial) value so
        // the dashed line continues from exactly where the solid line ends,
        // instead of jumping up to a full-month estimate.
        forecast = v.kg
      } else if (v.offset > 0) {
        // Future months: the projected full-month diversion.
        forecast = projectedMonthKg(base, year, m)
      }
    }
    rows.push({
      key: `${year}-${m}`,
      label: `${MONTH_ABBR[m]} ${String(year).slice(2)}`,
      month: m,
      year,
      empty: v.empty,
      isNow: v.offset === 0,
      partial: v.partial,
      actual: v.empty ? null : v.kg,
      kg: v.empty ? null : v.kg,
      forecast,
    })
  }
  // Bridge: if the current month isn't in this year (viewing a past year), let
  // the last actual month carry a forecast point so the lines still connect.
  if (withForecast && !rows.some((r) => r.isNow)) {
    const lastActual = [...rows].reverse().find((r) => r.actual != null)
    if (lastActual && lastActual.forecast == null) lastActual.forecast = lastActual.actual
  }
  return rows
}

/** Sum a whole year's diversion. */
export function yearTotal(transactions, year) {
  const base = computeRoi(transactions)
  let kg = 0,
    rm = 0,
    gp = 0,
    co2 = 0
  let anyData = false
  let anyPartial = false
  for (let m = 0; m < 12; m++) {
    const v = monthValue(base, year, m)
    if (v.empty) continue // future months contribute nothing
    anyData = true
    if (v.partial) anyPartial = true
    kg += v.kg
    rm += v.rm
    gp += v.gp
    co2 += v.co2
  }
  return {
    year,
    kg: round(kg, 1),
    rm: round(rm),
    gp: Math.round(gp),
    co2: round(co2, 1),
    empty: !anyData, // whole year is in the future
    partial: anyPartial, // year-to-date (current year, not yet complete)
    projected: false,
  }
}

// Projected FULL-year diversion (sum of all 12 projected months) for the annual
// forecast line.
function projectedYearKg(base, year) {
  let kg = 0
  for (let m = 0; m < 12; m++) kg += projectedMonthKg(base, year, m)
  return round(kg, 1)
}

/** Year totals across a span of years, for the Annual-view chart. */
export function annualSeries(transactions, years, withForecast = false) {
  const base = computeRoi(transactions)
  const { year: ny } = nowParts()
  const rows = years.map((y) => {
    const t = yearTotal(transactions, y)
    const future = y > ny
    let forecast = null
    if (withForecast) {
      if (y === ny) {
        // Current year: anchor the projection to the year-to-date actual so the
        // dashed line continues from where the solid line ends.
        forecast = t.kg
      } else if (future) {
        forecast = projectedYearKg(base, y)
      }
    }
    return {
      key: String(y),
      label: String(y),
      year: y,
      // Future years are empty; the current year is year-to-date (partial).
      actual: future ? null : t.kg,
      kg: future ? null : t.kg,
      empty: future,
      partial: y === ny,
      forecast,
    }
  })
  if (withForecast && !rows.some((r) => r.year === ny)) {
    const lastActual = [...rows].reverse().find((r) => r.actual != null)
    if (lastActual && lastActual.forecast == null) lastActual.forecast = lastActual.actual
  }
  return rows
}

// Figures for a single month (stat cards + material scaling in Monthly view).
export function monthFigures(transactions, year, month) {
  const base = computeRoi(transactions)
  return monthValue(base, year, month)
}

export function currentYearMonth() {
  return nowParts()
}

/**
 * Scale factor to turn the current month's figures into a given year's total.
 * Used to scale the material breakdown to a selected year/month.
 */
export function scaleForYear(transactions, year) {
  const base = computeRoi(transactions)
  if (!base.kg) return 0
  return yearTotal(transactions, year).kg / base.kg
}

export function scaleForMonth(transactions, year, month) {
  const base = computeRoi(transactions)
  if (!base.kg) return 0
  return monthValue(base, year, month).kg / base.kg
}

// Real period-over-period change comparing this month's run-rate to last
// month's — at FULL scale for both (so the current partial month isn't unfairly
// penalised). Because seasonality + wobble vary month to month, the arrow can
// point up OR down, not a fixed +8%.
export function monthTrend(transactions) {
  const base = computeRoi(transactions)
  if (!base.kg) return { pct: 0, up: true }
  const { year, month } = nowParts()
  // Full-month equivalent of the current month (strip the partial factor by
  // asking for the month value and dividing out dayFraction via season+trend).
  const g = 1 + ECONOMICS.monthlyGrowthRate
  const { month: nm } = nowParts()
  const curFull = base.kg * (MALAYSIA_SEASONALITY[month] / MALAYSIA_SEASONALITY[nm]) * (1 + wobble(0))
  const prevMonth = (month + 11) % 12
  const prevYear = month === 0 ? year - 1 : year
  const prevOff = (prevYear - year) * 12 + (prevMonth - nm)
  const prev =
    base.kg * (g ** prevOff) * (MALAYSIA_SEASONALITY[prevMonth] / MALAYSIA_SEASONALITY[nm]) * (1 + wobble(prevOff))
  if (prev <= 0) return { pct: 0, up: true }
  const pct = Math.round(((curFull - prev) / prev) * 100)
  return { pct, up: pct >= 0 }
}

// Projected growth over the next N months vs now, as a signed %.
export function projectedChange(months) {
  const g = 1 + ECONOMICS.monthlyGrowthRate
  const factor = g ** months
  return Math.round((factor - 1) * 100)
}

export { round as _round }
