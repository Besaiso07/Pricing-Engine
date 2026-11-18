const uid = () => crypto.randomUUID()

export const initialSettings = [
  { id: uid(), key: 'usd_to_lyd', value: '4.85', label: 'USD → LYD (Official / CBL)', updated_at: new Date().toISOString() },
  { id: uid(), key: 'eur_to_lyd', value: '5.25', label: 'EUR → LYD (Official / CBL)', updated_at: new Date().toISOString() },
  { id: uid(), key: 'usd_to_lyd_parallel', value: '7.00', label: 'USD → LYD (Parallel / Market)', updated_at: new Date().toISOString() },
  { id: uid(), key: 'eur_to_lyd_parallel', value: '7.60', label: 'EUR → LYD (Parallel / Market)', updated_at: new Date().toISOString() },
  { id: uid(), key: 'fx_mode', value: 'parallel', label: 'Rate used for costing', updated_at: new Date().toISOString() },
  { id: uid(), key: 'fx_buffer_pct', value: '5', label: 'FX Risk Buffer %', updated_at: new Date().toISOString() },
  { id: uid(), key: 'monthly_inflation_pct', value: '2', label: 'Monthly Inflation % (LYD costs)', updated_at: new Date().toISOString() },
  { id: uid(), key: 'default_markup_pct', value: '35', label: 'Default Markup %', updated_at: new Date().toISOString() },
  { id: uid(), key: 'target_margin_pct', value: '25', label: 'Target Margin % (alerts)', updated_at: new Date().toISOString() },
]

// Defaults used when a setting key is missing (e.g. older saved data)
export const SETTING_DEFAULTS = {
  usd_to_lyd: '4.85', eur_to_lyd: '5.25',
  usd_to_lyd_parallel: '7.00', eur_to_lyd_parallel: '7.60',
  fx_mode: 'official', fx_buffer_pct: '0',
  monthly_inflation_pct: '0', default_markup_pct: '35', target_margin_pct: '25',
}

export const initialComponents = [
  {
    id: uid(), name: 'cPanel License', category: 'license',
    billing_cycle: 'monthly', cost_amount: 20, currency: 'USD',
    vendor: 'cPanel LLC', notes: 'Per-server license', is_active: true, created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Plesk Web Pro', category: 'license',
    billing_cycle: 'monthly', cost_amount: 35, currency: 'USD',
    vendor: 'Plesk International', notes: 'Web Pro tier', is_active: true, created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Dell PowerEdge R750', category: 'infrastructure',
    billing_cycle: 'monthly', cost_amount: 250, currency: 'EUR',
    vendor: 'Dell Technologies', notes: 'Shared hosting server rack unit', is_active: true, created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Bandwidth – 10TB', category: 'infrastructure',
    billing_cycle: 'monthly', cost_amount: 80, currency: 'USD',
    vendor: 'Upstream Provider', notes: 'Monthly transit', is_active: true, created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'SSD Storage Pool – 5TB', category: 'infrastructure',
    billing_cycle: 'monthly', cost_amount: 60, currency: 'USD',
    vendor: 'Internal', notes: 'NVMe SSD array', is_active: true, created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Support Labor (Tier-1)', category: 'labor',
    billing_cycle: 'monthly', cost_amount: 400, currency: 'USD',
    vendor: '', notes: 'Shared across all plans', is_active: true, created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Comodo SSL Wildcard', category: 'license',
    billing_cycle: 'yearly', cost_amount: 120, currency: 'USD',
    vendor: 'Comodo', notes: 'Per domain wildcard cert', is_active: true, created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: '.com Domain Registration', category: 'other',
    billing_cycle: 'yearly', cost_amount: 10, currency: 'USD',
    vendor: 'Registrar', notes: 'Wholesale cost per domain', is_active: true, created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'KVM VPS Node (32 vCPU)', category: 'infrastructure',
    billing_cycle: 'monthly', cost_amount: 180, currency: 'EUR',
    vendor: 'Hetzner', notes: 'Dedicated VPS hypervisor node', is_active: true, created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Dedicated Server – Xeon Gold', category: 'infrastructure',
    billing_cycle: 'monthly', cost_amount: 350, currency: 'EUR',
    vendor: 'OVHcloud', notes: 'Bare metal server', is_active: true, created_at: new Date().toISOString(),
  },
]

export const initialPlans = [
  {
    id: uid(), name: 'Shared Hosting – Starter', category: 'shared_hosting',
    description: 'Entry-level shared hosting for small sites',
    specs: { disk: '5 GB', bandwidth: '50 GB', email: '5', domains: '1' },
    markup_override_pct: null, current_price: 25, billing_cycles: ['monthly', 'quarterly', 'annually'], status: 'active', created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Shared Hosting – Business', category: 'shared_hosting',
    description: 'Business shared hosting with more resources',
    specs: { disk: '20 GB', bandwidth: '200 GB', email: 'Unlimited', domains: '5' },
    markup_override_pct: null, current_price: 55, billing_cycles: ['monthly', 'quarterly', 'semi_annually', 'annually'], status: 'active', created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Shared Hosting – Pro', category: 'shared_hosting',
    description: 'High-performance shared hosting',
    specs: { disk: '50 GB', bandwidth: '500 GB', email: 'Unlimited', domains: 'Unlimited' },
    markup_override_pct: 40, current_price: 95, billing_cycles: ['monthly', 'annually', 'biennially'], status: 'active', created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'VPS – Basic', category: 'vps',
    description: '1 vCPU, 1 GB RAM starter VPS',
    specs: { cpu: '1 vCPU', ram: '1 GB', disk: '20 GB SSD', bandwidth: '1 TB' },
    markup_override_pct: null, current_price: 120, billing_cycles: ['monthly', 'annually'], status: 'active', created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'VPS – Standard', category: 'vps',
    description: '2 vCPU, 4 GB RAM VPS',
    specs: { cpu: '2 vCPU', ram: '4 GB', disk: '60 GB SSD', bandwidth: '2 TB' },
    markup_override_pct: null, current_price: 240, billing_cycles: ['monthly', 'quarterly', 'annually'], status: 'active', created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Dedicated – Entry', category: 'dedicated',
    description: 'Entry-level bare-metal dedicated server',
    specs: { cpu: 'Xeon E-2234', ram: '32 GB', disk: '2×480 GB SSD', bandwidth: '10 TB' },
    markup_override_pct: 30, current_price: null, billing_cycles: ['monthly', 'annually', 'triennially'], status: 'draft', created_at: new Date().toISOString(),
  },
  {
    id: uid(), name: 'SSL – Domain Validated', category: 'ssl',
    description: 'Standard DV SSL certificate',
    specs: { type: 'DV', wildcard: 'No', validity: '1 Year' },
    markup_override_pct: null, current_price: 8, billing_cycles: ['annually', 'biennially'], status: 'active', created_at: new Date().toISOString(),
  },
]

// Cost Centers – shared resource pools
export const initialCostCenters = []
export const initialCostCenterComponents = []
export const initialCostCenterPlans = []

// Legacy plan_cost_allocations (for dedicated-cost plans)
export const initialAllocations = []

// ── Billing cycles a plan can be sold in (months multiplier) ──────────
export const BILLING_CYCLES = [
  { key: 'monthly', label: 'Monthly', months: 1 },
  { key: 'quarterly', label: 'Quarterly', months: 3 },
  { key: 'semi_annually', label: 'Semi-Annually', months: 6 },
  { key: 'annually', label: 'Annually', months: 12 },
  { key: 'biennially', label: 'Biennially', months: 24 },
  { key: 'triennially', label: 'Triennially', months: 36 },
]

export const getCycle = (key) =>
  BILLING_CYCLES.find(c => c.key === key) || BILLING_CYCLES[0]

// Foreign currencies a plan can carry its own manual selling prices in (besides LYD)
export const SELL_CURRENCIES = ['USD', 'EUR']

// A plan's cycles in standard order (monthly → triennially), whatever order they were ticked in.
export const sortCycles = (keys) => {
  const list = keys?.length ? keys : ['monthly']
  return BILLING_CYCLES.filter(c => list.includes(c.key)).map(c => c.key)
}

// Cycle a plan opens in: monthly if sold, else annually if sold, else its shortest cycle.
export const defaultCycle = (keys) => {
  const s = sortCycles(keys)
  if (s.includes('monthly')) return 'monthly'
  if (s.includes('annually')) return 'annually'
  return s[0] || 'monthly'
}

// ── Editable category catalogs ────────────────────────────────────────
export const initialComponentCategories = [
  { id: uid(), key: 'license', label: 'License', color: 'primary' },
  { id: uid(), key: 'infrastructure', label: 'Infrastructure', color: 'warning' },
  { id: uid(), key: 'labor', label: 'Labor', color: 'success' },
  { id: uid(), key: 'other', label: 'Other', color: 'purple' },
]

export const initialPlanCategories = [
  { id: uid(), key: 'shared_hosting', label: 'Shared Hosting', color: 'primary' },
  { id: uid(), key: 'vps', label: 'VPS', color: 'warning' },
  { id: uid(), key: 'dedicated', label: 'Dedicated', color: 'danger' },
  { id: uid(), key: 'domain', label: 'Domain', color: 'success' },
  { id: uid(), key: 'ssl', label: 'SSL', color: 'purple' },
  { id: uid(), key: 'other', label: 'Other', color: 'muted' },
]
