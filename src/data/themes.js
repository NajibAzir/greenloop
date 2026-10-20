export const THEME_STORAGE_KEY = 'greenloop-theme'
export const DEFAULT_THEME_ID = 'simedarby'

export const GREEN_THEMES = [
  {
    id: 'emerald',
    label: 'Emerald Forest',
    short: 'Emerald',
    swatch: '#059669',
    swatchSecondary: '#064e3b',
    bannerGradient: 'linear-gradient(135deg, #064e3b 0%, #059669 55%, #10b981 100%)',
    progressGradient: 'linear-gradient(90deg, #059669 0%, #34d399 100%)',
    chartStroke: '#059669',
    chartFill: '#a7f3d0',
    chartSecondary: '#0d9488',
  },
  {
    id: 'classic',
    label: 'Classic Leaf',
    short: 'Classic',
    swatch: '#16a34a',
    swatchSecondary: '#bbf7d0',
    bannerGradient: 'linear-gradient(135deg, #15803d 0%, #16a34a 55%, #22c55e 100%)',
    progressGradient: 'linear-gradient(90deg, #16a34a 0%, #4ade80 100%)',
    chartStroke: '#16a34a',
    chartFill: '#bbf7d0',
    chartSecondary: '#0ea5e9',
  },
  {
    id: 'mint',
    label: 'Mint & Sage',
    short: 'Mint',
    swatch: '#0d9488',
    swatchSecondary: '#99f6e4',
    bannerGradient: 'linear-gradient(135deg, #115e59 0%, #0d9488 55%, #2dd4bf 100%)',
    progressGradient: 'linear-gradient(90deg, #0d9488 0%, #2dd4bf 100%)',
    chartStroke: '#0d9488',
    chartFill: '#99f6e4',
    chartSecondary: '#059669',
  },
  {
    id: 'lime',
    label: 'Lime Canopy',
    short: 'Lime',
    swatch: '#65a30d',
    swatchSecondary: '#d9f99d',
    bannerGradient: 'linear-gradient(135deg, #365314 0%, #65a30d 55%, #84cc16 100%)',
    progressGradient: 'linear-gradient(90deg, #65a30d 0%, #a3e635 100%)',
    chartStroke: '#65a30d',
    chartFill: '#d9f99d',
    chartSecondary: '#16a34a',
  },
  {
    id: 'pine',
    label: 'Pine Forest',
    short: 'Pine',
    swatch: '#064e3b',
    swatchSecondary: '#6ee7b7',
    bannerGradient: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #059669 100%)',
    progressGradient: 'linear-gradient(90deg, #064e3b 0%, #10b981 100%)',
    chartStroke: '#064e3b',
    chartFill: '#a7f3d0',
    chartSecondary: '#047857',
  },
  {
    id: 'simedarby',
    label: 'Sime Darby Property',
    short: 'SD Property',
    swatch: '#d31245',
    swatchSecondary: '#f59e0b',
    bannerGradient: 'linear-gradient(135deg, #8a0c2c 0%, #d31245 55%, #f43f5e 100%)',
    progressGradient: 'linear-gradient(90deg, #d31245 0%, #f59e0b 100%)',
    chartStroke: '#d31245',
    chartFill: '#fee2e8',
    chartSecondary: '#f59e0b',
  },
]

export function getTheme(id) {
  if (id === 'pine-light') id = 'pine'
  return GREEN_THEMES.find((t) => t.id === id) || GREEN_THEMES[0]
}
