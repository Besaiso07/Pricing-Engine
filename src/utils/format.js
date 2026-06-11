export const fmtLYD = (n) =>
  `${Number(n || 0).toFixed(3)} LYD`

export const fmtCurrency = (amount, currency) => {
  const sym = { USD: '$', EUR: '€', LYD: 'LD' }[currency] || ''
  return `${sym}${Number(amount || 0).toFixed(2)}`
}

export const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`

export const marginPct = (cost, price) => {
  if (!price || price === 0) return 0
  return ((price - cost) / price) * 100
}

// Manual price set for a specific billing cycle.
// Falls back to the legacy single `current_price` (treated as the monthly price).
export const planCyclePrice = (plan, cycleKey) => {
  if (plan?.current_prices && plan.current_prices[cycleKey] != null) return plan.current_prices[cycleKey]
  if (cycleKey === 'monthly' && plan?.current_price != null) return plan.current_price
  return null
}

export const sellingPrice = (cost, markupPct) =>
  cost * (1 + markupPct / 100)

// Color palette for editable categories
export const PALETTE = {
  primary: 'text-primary bg-primary/10 border-primary/30',
  warning: 'text-warning bg-warning/10 border-warning/30',
  success: 'text-success bg-success/10 border-success/30',
  purple: 'text-purple bg-purple/10 border-purple/30',
  danger: 'text-danger bg-danger/10 border-danger/30',
  muted: 'text-muted bg-muted/10 border-muted/30',
}

export const PALETTE_KEYS = Object.keys(PALETTE)

export const colorClass = (color) => PALETTE[color] || PALETTE.muted

export const PALETTE_DOT = {
  primary: 'bg-primary',
  warning: 'bg-warning',
  success: 'bg-success',
  purple: 'bg-purple',
  danger: 'bg-danger',
  muted: 'bg-muted',
}

export const categoryColor = {
  license: 'text-primary bg-primary/10 border-primary/30',
  infrastructure: 'text-warning bg-warning/10 border-warning/30',
  labor: 'text-success bg-success/10 border-success/30',
  other: 'text-purple bg-purple/10 border-purple/30',
}

export const categoryDot = {
  license: 'bg-primary',
  infrastructure: 'bg-warning',
  labor: 'bg-success',
  other: 'bg-purple',
}

export const planCategoryColor = {
  shared_hosting: 'text-primary bg-primary/10 border-primary/30',
  vps: 'text-warning bg-warning/10 border-warning/30',
  dedicated: 'text-danger bg-danger/10 border-danger/30',
  domain: 'text-success bg-success/10 border-success/30',
  ssl: 'text-purple bg-purple/10 border-purple/30',
  other: 'text-muted bg-muted/10 border-muted/30',
}

export const statusColor = {
  active: 'text-success bg-success/10 border-success/30',
  draft: 'text-warning bg-warning/10 border-warning/30',
  archived: 'text-muted bg-muted/10 border-muted/30',
}
