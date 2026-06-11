import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  initialSettings, initialComponents, initialPlans,
  initialAllocations, initialCostCenters,
  initialCostCenterComponents, initialCostCenterPlans,
  initialComponentCategories, initialPlanCategories,
  SETTING_DEFAULTS,
} from '../data/mockData'

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// Settings keys whose changes are recorded in the rate history
const FX_RATE_KEYS = ['usd_to_lyd', 'eur_to_lyd', 'usd_to_lyd_parallel', 'eur_to_lyd_parallel']
const HISTORY_KEYS = [...FX_RATE_KEYS, 'fx_mode', 'fx_buffer_pct']

const DEFAULT_AMORTIZE_MONTHS = 24

// Convert a component's LYD cost to a monthly figure by billing cycle:
// yearly ÷ 12, one_time ÷ amortize_months (default 24), monthly as-is.
const cycleToMonthly = (comp, lyd) => {
  if (comp.billing_cycle === 'yearly') return lyd / 12
  if (comp.billing_cycle === 'one_time') return lyd / (parseInt(comp.amortize_months) || DEFAULT_AMORTIZE_MONTHS)
  return lyd
}

// Compound-inflation multiplier for inflation-indexed components.
const inflationFactor = (comp, monthlyInflPct) => {
  if (!comp.inflation_indexed) return 1
  const infl = monthlyInflPct / 100
  if (infl <= 0) return 1
  const base = new Date(comp.cost_base_date || comp.created_at || Date.now())
  const months = Math.max(0, (Date.now() - base.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  return Math.pow(1 + infl, months)
}

const useAppStore = create(
  persist(
    (set, get) => ({
      // ── State ───────────────────────────────────────────────────
      settings: initialSettings,
      components: initialComponents,
      plans: initialPlans,
      allocations: initialAllocations,
      costCenters: initialCostCenters,
      costCenterComponents: initialCostCenterComponents,
      costCenterPlans: initialCostCenterPlans,
      componentCategories: initialComponentCategories,
      planCategories: initialPlanCategories,
      activityLog: [],
      rateHistory: [], // { id, at, key, from, to } — every FX rate/mode/buffer change
      lang: 'en', // 'en' | 'ar'

      // ── Activity Log ────────────────────────────────────────────
      log: (action, entity, name, details = '') => set(s => ({
        activityLog: [
          { id: uid(), at: now(), action, entity, name, details },
          ...s.activityLog,
        ].slice(0, 1000),
      })),
      clearLog: () => set({ activityLog: [] }),

      // ── Helpers ─────────────────────────────────────────────────
      // Raw string value (falls back to defaults for missing keys)
      getSettingRaw: (key) => {
        const s = get().settings.find(s => s.key === key)
        if (s != null) return s.value
        return SETTING_DEFAULTS[key] != null ? SETTING_DEFAULTS[key] : ''
      },
      getSetting: (key) => {
        const v = parseFloat(get().getSettingRaw(key))
        return isNaN(v) ? 0 : v
      },

      // FX rate for a currency, honouring official/parallel mode.
      fxRate: (currency, overrideMode) => {
        const { getSetting, getSettingRaw } = get()
        const mode = overrideMode || getSettingRaw('fx_mode') || 'official'
        if (currency === 'USD') {
          const r = mode === 'parallel' ? getSetting('usd_to_lyd_parallel') : getSetting('usd_to_lyd')
          return r || getSetting('usd_to_lyd')
        }
        if (currency === 'EUR') {
          const r = mode === 'parallel' ? getSetting('eur_to_lyd_parallel') : getSetting('eur_to_lyd')
          return r || getSetting('eur_to_lyd')
        }
        return 1
      },

      // Convert to LYD with FX mode + risk buffer (buffer only on foreign currency)
      toLYD: (amount, currency, opts = {}) => {
        const { fxRate, getSetting } = get()
        if (currency === 'LYD') return amount
        const rate = opts.rate != null ? opts.rate : fxRate(currency, opts.mode)
        const buffer = opts.buffer != null ? opts.buffer : getSetting('fx_buffer_pct')
        return amount * rate * (1 + buffer / 100)
      },

      // Monthly cost of a component in LYD (FX + buffer + cycle conversion + inflation index)
      monthlyComponentCost: (comp, opts = {}) => {
        const { toLYD, getSetting } = get()
        const lyd = toLYD(comp.cost_amount, comp.currency, opts)
        return cycleToMonthly(comp, lyd) * inflationFactor(comp, getSetting('monthly_inflation_pct'))
      },

      // Same calculation at hypothetical USD/EUR rates (used by the FX Simulator)
      // so what-if figures stay consistent with real costing (one_time, inflation, buffer).
      monthlyComponentCostAtRates: (comp, usdRate, eurRate) => {
        const { getSetting } = get()
        const buffer = getSetting('fx_buffer_pct')
        const rate = comp.currency === 'USD' ? usdRate : comp.currency === 'EUR' ? eurRate : 1
        const lyd = comp.currency === 'LYD'
          ? comp.cost_amount
          : comp.cost_amount * rate * (1 + buffer / 100)
        return cycleToMonthly(comp, lyd) * inflationFactor(comp, getSetting('monthly_inflation_pct'))
      },

      // ── Category helpers ────────────────────────────────────────
      getComponentCat: (key) => get().componentCategories.find(c => c.key === key),
      getPlanCat: (key) => get().planCategories.find(c => c.key === key),
      // count how many records use a category key
      componentCatUsage: (key) => get().components.filter(c => c.category === key).length,
      planCatUsage: (key) =>
        get().plans.filter(p => p.category === key).length +
        get().costCenters.filter(cc => cc.category === key).length,

      // ── Component Categories CRUD ───────────────────────────────
      addComponentCategory: ({ label, color }) => {
        const key = slug(label)
        if (!key || get().componentCategories.some(c => c.key === key)) return false
        set(s => ({ componentCategories: [...s.componentCategories, { id: uid(), key, label: label.trim(), color }] }))
        get().log('create', 'category', label, 'component category')
        return true
      },
      updateComponentCategory: (id, data) => {
        const old = get().componentCategories.find(c => c.id === id)
        set(s => ({ componentCategories: s.componentCategories.map(c => c.id === id ? { ...c, ...data } : c) }))
        get().log('update', 'category', data.label || old?.label, 'component category')
      },
      deleteComponentCategory: (id) => {
        const cat = get().componentCategories.find(c => c.id === id)
        if (!cat || get().componentCatUsage(cat.key) > 0) return false
        set(s => ({ componentCategories: s.componentCategories.filter(c => c.id !== id) }))
        get().log('delete', 'category', cat.label, 'component category')
        return true
      },

      // ── Plan Categories CRUD ────────────────────────────────────
      addPlanCategory: ({ label, color }) => {
        const key = slug(label)
        if (!key || get().planCategories.some(c => c.key === key)) return false
        set(s => ({ planCategories: [...s.planCategories, { id: uid(), key, label: label.trim(), color }] }))
        get().log('create', 'category', label, 'plan category')
        return true
      },
      updatePlanCategory: (id, data) => {
        const old = get().planCategories.find(c => c.id === id)
        set(s => ({ planCategories: s.planCategories.map(c => c.id === id ? { ...c, ...data } : c) }))
        get().log('update', 'category', data.label || old?.label, 'plan category')
      },
      deletePlanCategory: (id) => {
        const cat = get().planCategories.find(c => c.id === id)
        if (!cat || get().planCatUsage(cat.key) > 0) return false
        set(s => ({ planCategories: s.planCategories.filter(c => c.id !== id) }))
        get().log('delete', 'category', cat.label, 'plan category')
        return true
      },

      // ── Settings CRUD ───────────────────────────────────────────
      updateSetting: (key, value) => {
        const old = get().settings.find(s => s.key === key)
        // skip no-op saves (also keeps activity log and rate history clean)
        if (old) {
          const same = old.value === String(value) ||
            (!isNaN(parseFloat(value)) && parseFloat(old.value) === parseFloat(value))
          if (same) return
        }
        if (old) {
          set(s => ({
            settings: s.settings.map(st =>
              st.key === key ? { ...st, value: String(value), updated_at: now() } : st
            ),
          }))
        } else {
          // upsert — create the setting if it doesn't exist yet (older saved data)
          set(s => ({
            settings: [...s.settings, { id: uid(), key, value: String(value), label: key, updated_at: now() }],
          }))
        }
        // record FX rate / mode / buffer changes in the rate history
        if (HISTORY_KEYS.includes(key)) {
          set(s => ({
            rateHistory: [
              { id: uid(), at: now(), key, from: old?.value ?? null, to: String(value) },
              ...s.rateHistory,
            ].slice(0, 500),
          }))
        }
        get().log('update', 'setting', old?.label || key, `${old?.value ?? '—'} → ${value}`)
      },

      // ── Components CRUD ─────────────────────────────────────────
      addComponent: (data) => {
        set(s => ({
          components: [...s.components, { ...data, id: uid(), is_active: true, created_at: now() }],
        }))
        get().log('create', 'component', data.name, `${data.currency} ${data.cost_amount} / ${data.billing_cycle}`)
      },
      updateComponent: (id, data) => {
        const old = get().components.find(c => c.id === id)
        set(s => ({ components: s.components.map(c => c.id === id ? { ...c, ...data } : c) }))
        get().log('update', 'component', data.name || old?.name, '')
      },
      deleteComponent: (id) => {
        const old = get().components.find(c => c.id === id)
        set(s => ({
          components: s.components.filter(c => c.id !== id),
          allocations: s.allocations.filter(a => a.component_id !== id),
          costCenterComponents: s.costCenterComponents.filter(cc => cc.component_id !== id),
        }))
        get().log('delete', 'component', old?.name || id, '')
      },

      // ── Plans CRUD ───────────────────────────────────────────────
      addPlan: (data) => {
        set(s => ({
          plans: [...s.plans, {
            ...data,
            id: uid(),
            billing_cycles: data.billing_cycles?.length ? data.billing_cycles : ['monthly'],
            status: data.status || 'draft',
            created_at: now(),
          }],
        }))
        get().log('create', 'plan', data.name, data.category)
      },
      updatePlan: (id, data) => {
        const old = get().plans.find(p => p.id === id)
        set(s => ({ plans: s.plans.map(p => p.id === id ? { ...p, ...data } : p) }))
        const changed = Object.keys(data).join(', ')
        get().log('update', 'plan', old?.name || id, `changed: ${changed}`)
      },
      // Set the manual selling price for a specific billing cycle
      setPlanCyclePrice: (planId, cycleKey, value) => {
        const plan = get().plans.find(p => p.id === planId)
        if (!plan) return
        const cp = { ...(plan.current_prices || {}) }
        // migrate legacy monthly price into the map so it isn't lost
        if (plan.current_price != null && cp.monthly == null) cp.monthly = plan.current_price
        const num = parseFloat(value)
        if (value === '' || value == null || isNaN(num)) delete cp[cycleKey]
        else cp[cycleKey] = num
        set(s => ({ plans: s.plans.map(p => p.id === planId ? { ...p, current_prices: cp } : p) }))
        get().log('update', 'plan', plan.name, `set ${cycleKey} price = ${value === '' ? 'cleared' : value}`)
      },

      deletePlan: (id) => {
        const old = get().plans.find(p => p.id === id)
        set(s => ({
          plans: s.plans.filter(p => p.id !== id),
          allocations: s.allocations.filter(a => a.plan_id !== id),
          costCenterPlans: s.costCenterPlans.filter(cp => cp.plan_id !== id),
        }))
        get().log('delete', 'plan', old?.name || id, '')
      },

      // ── Plan Cost Allocations (direct/legacy) ────────────────────
      addAllocation: (data) => {
        const comp = get().components.find(c => c.id === data.component_id)
        const plan = get().plans.find(p => p.id === data.plan_id)
        set(s => ({ allocations: [...s.allocations, { ...data, id: uid(), created_at: now() }] }))
        get().log('create', 'allocation', `${comp?.name} → ${plan?.name}`, `weight ${data.allocation_weight}`)
      },
      updateAllocation: (id, data) => set(s => ({
        allocations: s.allocations.map(a => a.id === id ? { ...a, ...data } : a),
      })),
      removeAllocation: (id) => {
        const old = get().allocations.find(a => a.id === id)
        const comp = get().components.find(c => c.id === old?.component_id)
        set(s => ({ allocations: s.allocations.filter(a => a.id !== id) }))
        get().log('delete', 'allocation', comp?.name || id, '')
      },

      // ── Cost Centers CRUD ────────────────────────────────────────
      addCostCenter: (data) => {
        set(s => ({ costCenters: [...s.costCenters, { ...data, id: uid(), created_at: now() }] }))
        get().log('create', 'cost center', data.name, data.category)
      },
      updateCostCenter: (id, data) => {
        const old = get().costCenters.find(cc => cc.id === id)
        set(s => ({ costCenters: s.costCenters.map(cc => cc.id === id ? { ...cc, ...data } : cc) }))
        get().log('update', 'cost center', data.name || old?.name, '')
      },
      deleteCostCenter: (id) => {
        const old = get().costCenters.find(cc => cc.id === id)
        set(s => ({
          costCenters: s.costCenters.filter(cc => cc.id !== id),
          costCenterComponents: s.costCenterComponents.filter(c => c.cost_center_id !== id),
          costCenterPlans: s.costCenterPlans.filter(p => p.cost_center_id !== id),
        }))
        get().log('delete', 'cost center', old?.name || id, '')
      },

      // Cost Center Component links
      addCostCenterComponent: (data) => {
        const comp = get().components.find(c => c.id === data.component_id)
        const cc = get().costCenters.find(c => c.id === data.cost_center_id)
        set(s => ({ costCenterComponents: [...s.costCenterComponents, { ...data, id: uid(), created_at: now() }] }))
        get().log('create', 'cc-component', `${comp?.name} → ${cc?.name}`, data.is_dedicated ? 'dedicated' : 'shared')
      },
      updateCostCenterComponent: (id, data) => set(s => ({
        costCenterComponents: s.costCenterComponents.map(c => c.id === id ? { ...c, ...data } : c),
      })),
      removeCostCenterComponent: (id) => {
        const old = get().costCenterComponents.find(c => c.id === id)
        const comp = get().components.find(c => c.id === old?.component_id)
        set(s => ({ costCenterComponents: s.costCenterComponents.filter(c => c.id !== id) }))
        get().log('delete', 'cc-component', comp?.name || id, '')
      },

      // Cost Center Plan capacity links
      addCostCenterPlan: (data) => {
        const plan = get().plans.find(p => p.id === data.plan_id)
        const cc = get().costCenters.find(c => c.id === data.cost_center_id)
        set(s => ({ costCenterPlans: [...s.costCenterPlans, { ...data, id: uid(), created_at: now() }] }))
        get().log('create', 'cc-plan', `${plan?.name} → ${cc?.name}`, `${data.max_clients} clients`)
      },
      updateCostCenterPlan: (id, data) => set(s => ({
        costCenterPlans: s.costCenterPlans.map(p => p.id === id ? { ...p, ...data } : p),
      })),
      removeCostCenterPlan: (id) => {
        const old = get().costCenterPlans.find(p => p.id === id)
        const plan = get().plans.find(p => p.id === old?.plan_id)
        set(s => ({ costCenterPlans: s.costCenterPlans.filter(p => p.id !== id) }))
        get().log('delete', 'cc-plan', plan?.name || id, '')
      },

      // ── Bulk CSV imports ─────────────────────────────────────────
      importComponents: (rows) => {
        const valid = rows.map(r => ({
          id: uid(),
          name: (r.name || '').trim(),
          category: ['license', 'infrastructure', 'labor', 'other'].includes(r.category) ? r.category : 'other',
          billing_cycle: ['monthly', 'yearly', 'one_time'].includes(r.billing_cycle) ? r.billing_cycle : 'monthly',
          amortize_months: parseInt(r.amortize_months) || (r.billing_cycle === 'one_time' ? DEFAULT_AMORTIZE_MONTHS : null),
          cost_amount: parseFloat(r.cost_amount) || 0,
          currency: ['USD', 'EUR', 'LYD'].includes(r.currency) ? r.currency : 'USD',
          vendor: r.vendor || '',
          notes: r.notes || '',
          is_active: true,
          created_at: now(),
        })).filter(r => r.name)
        set(s => ({ components: [...s.components, ...valid] }))
        get().log('import', 'component', `${valid.length} components`, 'CSV import')
        return valid.length
      },

      importPlans: (rows) => {
        const valid = rows.map(r => {
          let specs = {}
          try { specs = r.specs ? JSON.parse(r.specs) : {} } catch { specs = {} }
          return {
            id: uid(),
            name: (r.name || '').trim(),
            category: ['shared_hosting', 'vps', 'dedicated', 'domain', 'ssl', 'other'].includes(r.category) ? r.category : 'other',
            description: r.description || '',
            specs,
            markup_override_pct: r.markup_override_pct ? parseFloat(r.markup_override_pct) : null,
            current_price: r.current_price ? parseFloat(r.current_price) : null,
            status: ['draft', 'active', 'archived'].includes(r.status) ? r.status : 'draft',
            created_at: now(),
          }
        }).filter(r => r.name)
        set(s => ({ plans: [...s.plans, ...valid] }))
        get().log('import', 'plan', `${valid.length} plans`, 'CSV import')
        return valid.length
      },

      // ── Computed: plan break-even from cost center ───────────────
      getCostCenterPlanCost: (costCenterId, planId) => {
        const { costCenterComponents, costCenterPlans, components, monthlyComponentCost } = get()

        const ccPlans = costCenterPlans.filter(p => p.cost_center_id === costCenterId)
        const totalClients = ccPlans.reduce((sum, p) => sum + (p.max_clients || 0), 0)
        const thisPlan = ccPlans.find(p => p.plan_id === planId)
        const planClients = thisPlan?.max_clients || 0
        const actualClients = thisPlan?.actual_clients || 0
        const weight = totalClients > 0 ? planClients / totalClients : 0
        const occupancy = planClients > 0 ? actualClients / planClients : 0

        const ccComps = costCenterComponents.filter(c => c.cost_center_id === costCenterId)
        const breakdown = []
        let sharedTotal = 0
        let dedicatedTotal = 0

        for (const link of ccComps) {
          const comp = components.find(c => c.id === link.component_id)
          if (!comp) continue
          const monthlyCostLYD = monthlyComponentCost(comp)

          if (link.is_dedicated && link.dedicated_plan_id === planId) {
            breakdown.push({ component: comp, link, type: 'dedicated', monthlyCostLYD, allocatedLYD: monthlyCostLYD, weight: 1 })
            dedicatedTotal += monthlyCostLYD
          } else if (!link.is_dedicated) {
            const allocated = monthlyCostLYD * weight
            breakdown.push({ component: comp, link, type: 'shared', monthlyCostLYD, allocatedLYD: allocated, weight })
            sharedTotal += allocated
          }
        }

        const totalLYD = sharedTotal + dedicatedTotal
        return {
          breakdown, sharedTotal, dedicatedTotal,
          totalLYD,
          planClients, totalClients, weight,
          actualClients, occupancy,
          // cost per client at full capacity vs at actual occupancy
          costPerCapacityClient: planClients > 0 ? totalLYD / planClients : 0,
          costPerActualClient: actualClients > 0 ? totalLYD / actualClients : 0,
        }
      },

      // ── Computed: full plan cost ─────────────────────────────────
      getPlanTotalCost: (planId) => {
        const { allocations, components, monthlyComponentCost, costCenters, costCenterPlans, getCostCenterPlanCost } = get()

        const planAllocs = allocations.filter(a => a.plan_id === planId)
        let directTotal = 0
        const directBreakdown = []
        for (const alloc of planAllocs) {
          const comp = components.find(c => c.id === alloc.component_id)
          if (!comp) continue
          const monthly = monthlyComponentCost(comp)
          const allocated = monthly * (alloc.allocation_weight || 0)
          directBreakdown.push({ component: comp, alloc, monthlyCostLYD: monthly, allocatedLYD: allocated })
          directTotal += allocated
        }

        const involvedCCs = costCenterPlans
          .filter(cp => cp.plan_id === planId)
          .map(cp => cp.cost_center_id)
          .filter((v, i, a) => a.indexOf(v) === i)

        let ccTotal = 0
        const ccContributions = []
        for (const ccId of involvedCCs) {
          const cc = costCenters.find(c => c.id === ccId)
          if (!cc) continue
          const result = getCostCenterPlanCost(ccId, planId)
          ccContributions.push({ costCenter: cc, ...result })
          ccTotal += result.totalLYD
        }

        const totalLYD = directTotal + ccTotal

        // Client counts across the cost centers this plan belongs to.
        // A shared plan's cost is for ALL its clients → per-client cost = total ÷ clients.
        const myLinks = costCenterPlans.filter(cp => cp.plan_id === planId)
        const clientCapacity = myLinks.reduce((s, cp) => s + (cp.max_clients || 0), 0)
        const clientActual = myLinks.reduce((s, cp) => s + (cp.actual_clients || 0), 0)

        // per-client monthly cost (capacity basis); falls back to whole-plan when no cost center
        const perClientCapacity = clientCapacity > 0 ? totalLYD / clientCapacity : totalLYD
        const perClientActual = clientActual > 0 ? totalLYD / clientActual : null

        // The figure to price against: per-client when the plan is sold per client, else whole-plan.
        const unitLYD = clientCapacity > 0 ? perClientCapacity : totalLYD

        return {
          directTotal, ccTotal,
          totalLYD,                 // whole plan (all clients)
          unitLYD,                  // per client (or whole-plan if not a shared plan)
          clientCapacity, clientActual,
          perClientCapacity, perClientActual,
          isPerClient: clientCapacity > 0,
          directBreakdown, ccContributions,
        }
      },

      // ── Backup / Restore ────────────────────────────────────────
      // Full snapshot of all user data for export to a file.
      exportData: () => {
        const s = get()
        return {
          app: 'pricing-engine',
          schema: 1,
          exportedAt: now(),
          data: {
            settings: s.settings,
            components: s.components,
            plans: s.plans,
            allocations: s.allocations,
            costCenters: s.costCenters,
            costCenterComponents: s.costCenterComponents,
            costCenterPlans: s.costCenterPlans,
            componentCategories: s.componentCategories,
            planCategories: s.planCategories,
            activityLog: s.activityLog,
            rateHistory: s.rateHistory,
          },
        }
      },

      // Restore a backup. mode: 'replace' (default) or 'merge' (append by new ids).
      // silent: skip writing an activity-log entry (used by cloud hydration).
      importData: (payload, mode = 'replace', silent = false) => {
        const d = payload?.data || payload
        if (!d || !Array.isArray(d.plans)) return false
        const keys = [
          'settings', 'components', 'plans', 'allocations',
          'costCenters', 'costCenterComponents', 'costCenterPlans',
          'componentCategories', 'planCategories', 'activityLog', 'rateHistory',
        ]
        if (mode === 'merge') {
          set(s => {
            const out = {}
            keys.forEach(k => {
              const cur = s[k] || []
              const incoming = d[k] || []
              const seen = new Set(cur.map(x => x.id))
              out[k] = [...cur, ...incoming.filter(x => !seen.has(x.id))]
            })
            return out
          })
        } else {
          const out = {}
          keys.forEach(k => { if (d[k]) out[k] = d[k] })
          set(out)
        }
        if (!silent) get().log('import', 'system', 'Backup restored', `${d.plans.length} plans · mode: ${mode}`)
        return true
      },

      // ── Cloud sync status (set by lib/cloudSync) ─────────────────
      cloudStatus: 'idle', // 'idle'|'connecting'|'synced'|'saving'|'error'|'disabled'
      cloudLastSync: null,
      cloudError: null,
      setCloud: (patch) => set(patch),

      // ── Data reset ───────────────────────────────────────────────
      resetData: () => {
        set({
          settings: initialSettings,
          components: initialComponents,
          plans: initialPlans,
          allocations: initialAllocations,
          costCenters: initialCostCenters,
          costCenterComponents: initialCostCenterComponents,
          costCenterPlans: initialCostCenterPlans,
          componentCategories: initialComponentCategories,
          planCategories: initialPlanCategories,
          rateHistory: [],
        })
        get().log('reset', 'system', 'All data', 'Reset to seed data')
      },

      // ── Toggle language ───────────────────────────────────────────
      toggleLang: () => set(s => ({ lang: s.lang === 'en' ? 'ar' : 'en' })),
    }),
    {
      name: 'pricing-engine-store',
      version: 1,
      partialize: (state) => ({
        settings: state.settings,
        components: state.components,
        plans: state.plans,
        allocations: state.allocations,
        costCenters: state.costCenters,
        costCenterComponents: state.costCenterComponents,
        costCenterPlans: state.costCenterPlans,
        componentCategories: state.componentCategories,
        planCategories: state.planCategories,
        activityLog: state.activityLog,
        rateHistory: state.rateHistory,
        lang: state.lang,
      }),
    }
  )
)

export default useAppStore
