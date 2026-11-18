import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  initialSettings, initialComponents, initialPlans,
  initialAllocations, initialCostCenters,
  initialCostCenterComponents, initialCostCenterPlans,
  initialComponentCategories, initialPlanCategories,
  SETTING_DEFAULTS, getCycle, SELL_CURRENCIES, sortCycles, defaultCycle,
} from '../data/mockData'
import { planCyclePrice, marginPct, fmtLYD, fmtCurrency } from '../utils/format'

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// Settings keys whose changes are recorded in the rate history
const FX_RATE_KEYS = ['usd_to_lyd', 'eur_to_lyd', 'usd_to_lyd_parallel', 'eur_to_lyd_parallel']
const HISTORY_KEYS = [...FX_RATE_KEYS, 'fx_mode', 'fx_buffer_pct']

const DEFAULT_AMORTIZE_MONTHS = 24

// Display helpers for history entries
const BILL_TXT = { monthly: '/ mo', yearly: '/ yr', one_time: 'one-time' }
const vendorCostTxt = (c) => c ? `${fmtCurrency(c.cost_amount, c.currency)} ${BILL_TXT[c.billing_cycle] || ''}`.trim() : '—'
const priceTxt = (v, cur) => v == null ? '—' : cur === 'LYD' ? fmtLYD(v) : fmtCurrency(v, cur)
const valTxt = (v) => v == null || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)
const PLAN_FIELD_LABEL = {
  name: 'Name', category: 'Category', description: 'Description', specs: 'Specs', status: 'Status',
  markup_override_pct: 'Markup override %', billing_cycles: 'Billing cycles',
}

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
      planHistory: [], // per-plan change history with before → after and cost impact (see _recordPlanImpact)
      rateHistory: [], // { id, at, key, from, to } — every FX rate/mode/buffer change
      lang: 'en', // 'en' | 'ar'
      theme: 'light', // 'light' (bright, default) | 'dark'
      // Guided tour (components/Tour.jsx). tourSeen is persisted so it auto-opens only once.
      tourSeen: false,
      tourOpen: false,
      tourStep: 0,
      startTour: () => set({ tourOpen: true, tourStep: 0 }),
      setTourStep: (n) => set({ tourStep: n }),
      endTour: () => set({ tourOpen: false, tourStep: 0, tourSeen: true }),

      // ── Activity Log ────────────────────────────────────────────
      log: (action, entity, name, details = '') => set(s => ({
        activityLog: [
          { id: uid(), at: now(), action, entity, name, details },
          ...s.activityLog,
        ].slice(0, 1000),
      })),
      clearLog: () => set({ activityLog: [] }),

      // ── Per-plan history ────────────────────────────────────────
      // Snapshot of every plan's monthly cost per client and suggested price (LYD), taken before a change.
      _planSnap: () => {
        const { plans, getPlanTotalCost, getSetting } = get()
        const def = getSetting('default_markup_pct')
        const out = {}
        for (const p of plans) {
          const { unitLYD } = getPlanTotalCost(p.id)
          out[p.id] = { cost: unitLYD, suggested: unitLYD * (1 + (p.markup_override_pct ?? def) / 100) }
        }
        return out
      },
      // After a change: add one history entry per plan that is named in `planIds` OR whose cost /
      // suggested price moved. `changes` = [{ label, from, to }] (display strings).
      // `mergeKey`: rapid repeat edits of the same field (typing) within 2 min merge into one entry.
      _recordPlanImpact: (before, { kind, title, changes = [], planIds = [], mergeKey = null }) => {
        const after = get()._planSnap()
        const moved = (b, a) => b && a && (Math.abs(a.cost - b.cost) > 0.0005 || Math.abs(a.suggested - b.suggested) > 0.0005)
        const ids = new Set(planIds.filter(id => after[id]))
        Object.keys(after).forEach(id => { if (moved(before[id], after[id])) ids.add(id) })
        if (!ids.size) return
        const at = now()
        set(st => {
          let hist = [...st.planHistory]
          for (const planId of ids) {
            const b = before[planId], a = after[planId]
            const entry = {
              id: uid(), at, planId, kind, title, changes, mergeKey,
              cost: b && a ? { from: b.cost, to: a.cost } : null,
              suggested: b && a ? { from: b.suggested, to: a.suggested } : null,
            }
            const idx = mergeKey ? hist.findIndex(h => h.planId === planId) : -1
            if (idx >= 0 && hist[idx].mergeKey === mergeKey && Date.now() - new Date(hist[idx].at).getTime() < 120000) {
              const prev = hist[idx]
              const merged = {
                ...entry, id: prev.id,
                changes: changes.map((c, i) => ({ ...c, from: prev.changes[i]?.from ?? c.from })),
                cost: prev.cost && entry.cost ? { from: prev.cost.from, to: entry.cost.to } : entry.cost,
                suggested: prev.suggested && entry.suggested ? { from: prev.suggested.from, to: entry.suggested.to } : entry.suggested,
              }
              const noop = merged.changes.every(c => c.from === c.to) && !moved(
                merged.cost && { cost: merged.cost.from, suggested: merged.suggested.from },
                merged.cost && { cost: merged.cost.to, suggested: merged.suggested.to })
              if (noop) hist.splice(idx, 1)   // typed back to the original value
              else hist[idx] = merged
              continue
            }
            hist.unshift(entry)
          }
          return { planHistory: hist.slice(0, 5000) }
        })
      },
      getPlanHistory: (planId) => get().planHistory.filter(h => h.planId === planId),

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

      // Step-by-step working of a component's monthly LYD cost, for display/printing:
      // vendor amount × FX rate × (1 + buffer) = LYD per bill, ÷ cycle months, × inflation.
      componentCostSteps: (comp) => {
        const { fxRate, getSetting, getSettingRaw, monthlyComponentCost } = get()
        const isForeign = comp.currency !== 'LYD'
        const rate = isForeign ? fxRate(comp.currency) : 1
        const bufferPct = isForeign ? getSetting('fx_buffer_pct') : 0
        const lydPerBill = comp.cost_amount * rate * (1 + bufferPct / 100)
        const divisor = comp.billing_cycle === 'yearly' ? 12
          : comp.billing_cycle === 'one_time' ? (parseInt(comp.amortize_months) || DEFAULT_AMORTIZE_MONTHS)
          : 1
        return {
          amount: comp.cost_amount, currency: comp.currency, isForeign,
          rate, rateMode: getSettingRaw('fx_mode') || 'official', bufferPct,
          billing: comp.billing_cycle, lydPerBill, divisor,
          inflation: inflationFactor(comp, getSetting('monthly_inflation_pct')),
          monthlyLYD: monthlyComponentCost(comp),
        }
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
        const before = get()._planSnap()
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
        // only settings that move a plan's cost/suggested price create plan-history entries
        get()._recordPlanImpact(before, {
          kind: HISTORY_KEYS.includes(key) ? 'rate' : 'setting',
          title: `Setting changed: ${old?.label || key}`,
          changes: [{ label: old?.label || key, from: valTxt(old?.value), to: valTxt(String(value)) }],
          mergeKey: `setting:${key}`,
        })
      },

      // ── Components CRUD ─────────────────────────────────────────
      addComponent: (data) => {
        set(s => ({
          components: [...s.components, { ...data, id: uid(), is_active: true, created_at: now() }],
        }))
        get().log('create', 'component', data.name, `${data.currency} ${data.cost_amount} / ${data.billing_cycle}`)
      },
      updateComponent: (id, data) => {
        const before = get()._planSnap()
        const old = get().components.find(c => c.id === id)
        set(s => ({ components: s.components.map(c => c.id === id ? { ...c, ...data } : c) }))
        const neu = get().components.find(c => c.id === id)
        const changes = []
        if (vendorCostTxt(old) !== vendorCostTxt(neu)) changes.push({ label: 'Vendor cost', from: vendorCostTxt(old), to: vendorCostTxt(neu) })
        if ((old?.amortize_months ?? 24) !== (neu?.amortize_months ?? 24) && neu?.billing_cycle === 'one_time')
          changes.push({ label: 'Amortize months', from: valTxt(old?.amortize_months), to: valTxt(neu?.amortize_months) })
        if (!!old?.inflation_indexed !== !!neu?.inflation_indexed)
          changes.push({ label: 'Inflation indexed', from: old?.inflation_indexed ? 'yes' : 'no', to: neu?.inflation_indexed ? 'yes' : 'no' })
        get().log('update', 'component', data.name || old?.name, changes.map(c => `${c.label}: ${c.from} → ${c.to}`).join('; '))
        get()._recordPlanImpact(before, { kind: 'cost', title: `Vendor cost: ${neu?.name || old?.name}`, changes })
      },
      deleteComponent: (id) => {
        const before = get()._planSnap()
        const old = get().components.find(c => c.id === id)
        set(s => ({
          components: s.components.filter(c => c.id !== id),
          allocations: s.allocations.filter(a => a.component_id !== id),
          costCenterComponents: s.costCenterComponents.filter(cc => cc.component_id !== id),
        }))
        get().log('delete', 'component', old?.name || id, '')
        get()._recordPlanImpact(before, { kind: 'cost', title: `Cost component deleted: ${old?.name || id}`,
          changes: [{ label: old?.name || 'Component', from: vendorCostTxt(old), to: 'removed' }] })
      },

      // ── Plans CRUD ───────────────────────────────────────────────
      addPlan: (data) => {
        const before = get()._planSnap()
        const newId = uid()
        set(s => ({
          plans: [...s.plans, {
            ...data,
            id: newId,
            billing_cycles: data.billing_cycles?.length ? data.billing_cycles : ['monthly'],
            status: data.status || 'draft',
            created_at: now(),
          }],
        }))
        get().log('create', 'plan', data.name, data.category)
        get()._recordPlanImpact(before, { kind: 'plan', title: 'Plan created', planIds: [newId] })
      },
      updatePlan: (id, data) => {
        const before = get()._planSnap()
        const old = get().plans.find(p => p.id === id)
        set(s => ({ plans: s.plans.map(p => p.id === id ? { ...p, ...data } : p) }))
        const changes = Object.keys(data)
          .filter(k => JSON.stringify(old?.[k] ?? null) !== JSON.stringify(data[k] ?? null))
          .map(k => ({
            label: PLAN_FIELD_LABEL[k] || k,
            from: k === 'billing_cycles' ? valTxt(sortCycles(old?.[k]).map(c => getCycle(c).label)) : k === 'markup_override_pct' ? (old?.[k] == null ? 'default' : `${old[k]}%`) : valTxt(old?.[k]),
            to: k === 'billing_cycles' ? valTxt(sortCycles(data[k]).map(c => getCycle(c).label)) : k === 'markup_override_pct' ? (data[k] == null ? 'default' : `${data[k]}%`) : valTxt(data[k]),
          }))
        get().log('update', 'plan', old?.name || id, changes.map(c => `${c.label}: ${c.from} → ${c.to}`).join('; ') || 'no change')
        if (changes.length) get()._recordPlanImpact(before, { kind: 'plan', title: 'Plan details edited', changes, planIds: [id] })
      },
      // Set the manual selling price for a specific billing cycle
      setPlanCyclePrice: (planId, cycleKey, value) => {
        const before = get()._planSnap()
        const plan = get().plans.find(p => p.id === planId)
        if (!plan) return
        const oldPrice = planCyclePrice(plan, cycleKey)
        const cp = { ...(plan.current_prices || {}) }
        // migrate legacy monthly price into the map so it isn't lost
        if (plan.current_price != null && cp.monthly == null) cp.monthly = plan.current_price
        const num = parseFloat(value)
        if (value === '' || value == null || isNaN(num)) delete cp[cycleKey]
        else cp[cycleKey] = num
        set(s => ({ plans: s.plans.map(p => p.id === planId ? { ...p, current_prices: cp } : p) }))
        get().log('update', 'plan', plan.name, `${cycleKey} price: ${priceTxt(oldPrice, 'LYD')} → ${priceTxt(cp[cycleKey], 'LYD')}`)
        if (oldPrice !== (cp[cycleKey] ?? null)) get()._recordPlanImpact(before, {
          kind: 'price', title: `Selling price: ${getCycle(cycleKey).label} (LYD)`, planIds: [planId],
          changes: [{ label: `${getCycle(cycleKey).label} price`, from: priceTxt(oldPrice, 'LYD'), to: priceTxt(cp[cycleKey], 'LYD') }],
        })
      },

      // Manual selling price in a foreign currency for one cycle: plan.current_prices_fx[currency][cycleKey]
      setPlanCyclePriceFx: (planId, cycleKey, currency, value) => {
        const before = get()._planSnap()
        const plan = get().plans.find(p => p.id === planId)
        if (!plan) return
        const oldPrice = plan.current_prices_fx?.[currency]?.[cycleKey] ?? null
        const fx = { ...(plan.current_prices_fx || {}) }
        const cur = { ...(fx[currency] || {}) }
        const num = parseFloat(value)
        if (value === '' || value == null || isNaN(num)) delete cur[cycleKey]
        else cur[cycleKey] = num
        fx[currency] = cur
        set(s => ({ plans: s.plans.map(p => p.id === planId ? { ...p, current_prices_fx: fx } : p) }))
        get().log('update', 'plan', plan.name, `${cycleKey} ${currency} price: ${priceTxt(oldPrice, currency)} → ${priceTxt(cur[cycleKey], currency)}`)
        if (oldPrice !== (cur[cycleKey] ?? null)) get()._recordPlanImpact(before, {
          kind: 'price', title: `Selling price: ${getCycle(cycleKey).label} (${currency})`, planIds: [planId],
          changes: [{ label: `${getCycle(cycleKey).label} price`, from: priceTxt(oldPrice, currency), to: priceTxt(cur[cycleKey], currency) }],
        })
      },

      deletePlan: (id) => {
        const old = get().plans.find(p => p.id === id)
        set(s => ({
          plans: s.plans.filter(p => p.id !== id),
          allocations: s.allocations.filter(a => a.plan_id !== id),
          costCenterPlans: s.costCenterPlans.filter(cp => cp.plan_id !== id),
          costCenterComponents: s.costCenterComponents.filter(l => l.dedicated_plan_id !== id),
          planHistory: s.planHistory.filter(h => h.planId !== id),
        }))
        get().log('delete', 'plan', old?.name || id, '')
      },

      // ── Plan Cost Allocations (direct/legacy) ────────────────────
      addAllocation: (data) => {
        const before = get()._planSnap()
        const comp = get().components.find(c => c.id === data.component_id)
        const plan = get().plans.find(p => p.id === data.plan_id)
        set(s => ({ allocations: [...s.allocations, { ...data, id: uid(), created_at: now() }] }))
        get().log('create', 'allocation', `${comp?.name} → ${plan?.name}`, `weight ${data.allocation_weight}`)
        get()._recordPlanImpact(before, { kind: 'cost', title: `Direct cost added: ${comp?.name}`, planIds: [data.plan_id],
          changes: [{ label: comp?.name || 'Component', from: '—', to: `${vendorCostTxt(comp)} × ${Math.round((data.allocation_weight || 0) * 100)}%` }] })
      },
      updateAllocation: (id, data) => {
        const before = get()._planSnap()
        const old = get().allocations.find(a => a.id === id)
        set(s => ({ allocations: s.allocations.map(a => a.id === id ? { ...a, ...data } : a) }))
        if (old && data.allocation_weight != null && data.allocation_weight !== old.allocation_weight) {
          const comp = get().components.find(c => c.id === old.component_id)
          get()._recordPlanImpact(before, { kind: 'cost', title: `Allocation weight: ${comp?.name}`, planIds: [old.plan_id],
            changes: [{ label: 'Weight', from: `${Math.round((old.allocation_weight || 0) * 100)}%`, to: `${Math.round((data.allocation_weight || 0) * 100)}%` }],
            mergeKey: `alloc:${id}` })
        }
      },
      removeAllocation: (id) => {
        const before = get()._planSnap()
        const old = get().allocations.find(a => a.id === id)
        const comp = get().components.find(c => c.id === old?.component_id)
        set(s => ({ allocations: s.allocations.filter(a => a.id !== id) }))
        get().log('delete', 'allocation', comp?.name || id, '')
        get()._recordPlanImpact(before, { kind: 'cost', title: `Direct cost removed: ${comp?.name || id}`, planIds: old ? [old.plan_id] : [],
          changes: [{ label: comp?.name || 'Component', from: `${vendorCostTxt(comp)} × ${Math.round((old?.allocation_weight || 0) * 100)}%`, to: 'removed' }] })
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
        const before = get()._planSnap()
        const old = get().costCenters.find(cc => cc.id === id)
        set(s => ({
          costCenters: s.costCenters.filter(cc => cc.id !== id),
          costCenterComponents: s.costCenterComponents.filter(c => c.cost_center_id !== id),
          costCenterPlans: s.costCenterPlans.filter(p => p.cost_center_id !== id),
        }))
        get().log('delete', 'cost center', old?.name || id, '')
        get()._recordPlanImpact(before, { kind: 'cost', title: `Cost center deleted: ${old?.name || id}` })
      },

      // Cost Center Component links
      addCostCenterComponent: (data) => {
        const before = get()._planSnap()
        const comp = get().components.find(c => c.id === data.component_id)
        const cc = get().costCenters.find(c => c.id === data.cost_center_id)
        set(s => ({ costCenterComponents: [...s.costCenterComponents, { ...data, id: uid(), created_at: now() }] }))
        get().log('create', 'cc-component', `${comp?.name} → ${cc?.name}`, data.is_dedicated ? 'dedicated' : 'shared')
        get()._recordPlanImpact(before, { kind: 'cost', title: `Cost added to ${cc?.name}: ${comp?.name}`,
          changes: [{ label: comp?.name || 'Component', from: '—', to: `${vendorCostTxt(comp)} (${data.is_dedicated ? 'dedicated' : 'shared'})` }] })
      },
      updateCostCenterComponent: (id, data) => {
        const before = get()._planSnap()
        const old = get().costCenterComponents.find(c => c.id === id)
        set(s => ({ costCenterComponents: s.costCenterComponents.map(c => c.id === id ? { ...c, ...data } : c) }))
        const comp = get().components.find(c => c.id === old?.component_id)
        const kindTxt = (l) => l?.is_dedicated ? `dedicated to ${get().plans.find(p => p.id === l.dedicated_plan_id)?.name || 'a plan'}` : 'shared'
        get()._recordPlanImpact(before, { kind: 'cost', title: `Cost split changed: ${comp?.name}`,
          changes: [{ label: comp?.name || 'Component', from: kindTxt(old), to: kindTxt({ ...old, ...data }) }] })
      },
      removeCostCenterComponent: (id) => {
        const before = get()._planSnap()
        const old = get().costCenterComponents.find(c => c.id === id)
        const comp = get().components.find(c => c.id === old?.component_id)
        const cc = get().costCenters.find(c => c.id === old?.cost_center_id)
        set(s => ({ costCenterComponents: s.costCenterComponents.filter(c => c.id !== id) }))
        get().log('delete', 'cc-component', comp?.name || id, '')
        get()._recordPlanImpact(before, { kind: 'cost', title: `Cost removed from ${cc?.name || 'cost center'}: ${comp?.name || id}`,
          changes: [{ label: comp?.name || 'Component', from: vendorCostTxt(comp), to: 'removed' }] })
      },

      // Cost Center Plan capacity links
      addCostCenterPlan: (data) => {
        const before = get()._planSnap()
        const plan = get().plans.find(p => p.id === data.plan_id)
        const cc = get().costCenters.find(c => c.id === data.cost_center_id)
        set(s => ({ costCenterPlans: [...s.costCenterPlans, { ...data, id: uid(), created_at: now() }] }))
        get().log('create', 'cc-plan', `${plan?.name} → ${cc?.name}`, `${data.max_clients} clients`)
        get()._recordPlanImpact(before, { kind: 'capacity', title: `${plan?.name} added to ${cc?.name}`, planIds: [data.plan_id],
          changes: [{ label: 'Client capacity', from: '—', to: valTxt(data.max_clients) }] })
      },
      updateCostCenterPlan: (id, data) => {
        const before = get()._planSnap()
        const old = get().costCenterPlans.find(p => p.id === id)
        set(s => ({ costCenterPlans: s.costCenterPlans.map(p => p.id === id ? { ...p, ...data } : p) }))
        if (!old) return
        const plan = get().plans.find(p => p.id === old.plan_id)
        const cc = get().costCenters.find(c => c.id === old.cost_center_id)
        const LABEL = { max_clients: 'Client capacity', actual_clients: 'Actual clients' }
        const changes = Object.keys(data).filter(k => LABEL[k] && old[k] !== data[k])
          .map(k => ({ label: `${LABEL[k]}${plan ? ` (${plan.name})` : ''}`, from: valTxt(old[k] ?? 0), to: valTxt(data[k]) }))
        if (changes.length) get()._recordPlanImpact(before, { kind: 'capacity', title: `Capacity in ${cc?.name || 'cost center'}`,
          changes, planIds: [old.plan_id], mergeKey: `ccplan:${id}:${Object.keys(data).join(',')}` })
      },
      removeCostCenterPlan: (id) => {
        const before = get()._planSnap()
        const old = get().costCenterPlans.find(p => p.id === id)
        const plan = get().plans.find(p => p.id === old?.plan_id)
        const cc = get().costCenters.find(c => c.id === old?.cost_center_id)
        set(s => ({ costCenterPlans: s.costCenterPlans.filter(p => p.id !== id) }))
        get().log('delete', 'cc-plan', plan?.name || id, '')
        get()._recordPlanImpact(before, { kind: 'capacity', title: `${plan?.name || 'Plan'} removed from ${cc?.name || 'cost center'}`,
          planIds: old ? [old.plan_id] : [], changes: [{ label: 'Client capacity', from: valTxt(old?.max_clients), to: 'removed' }] })
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

      // ── Foreign-currency selling prices ─────────────────────────
      // Selling currencies besides LYD. Converted at the COSTING rate (official/parallel per fx_mode),
      // without the FX buffer: the buffer is already inside the LYD cost.
      fromLYD: (lyd, currency) => {
        if (currency === 'LYD') return lyd
        const r = get().fxRate(currency)
        return r > 0 ? lyd / r : 0
      },
      priceToLYD: (amount, currency) => currency === 'LYD' ? amount : amount * get().fxRate(currency),

      // Manual price in a currency for a cycle (LYD uses planCyclePrice incl. the legacy fallback).
      planCyclePriceIn: (plan, cycleKey, currency) => {
        if (currency === 'LYD') return planCyclePrice(plan, cycleKey)
        const v = plan?.current_prices_fx?.[currency]?.[cycleKey]
        return v == null ? null : v
      },

      // Margin of a manual price in any currency for a cycle; the price is converted to LYD at the costing rate.
      // null when uncosted or no price set (never a fake 100%).
      planCycleMarginIn: (plan, cycleKey, currency) => {
        const { getPlanTotalCost, planCyclePriceIn, priceToLYD } = get()
        const { unitLYD, isCosted } = getPlanTotalCost(plan.id)
        const price = planCyclePriceIn(plan, cycleKey, currency)
        if (!isCosted || price == null) return null
        return marginPct(unitLYD * getCycle(cycleKey).months, priceToLYD(price, currency))
      },

      // Every manual price on a plan (all cycles × LYD/USD/EUR) with its margin, for alerts.
      planPriceMargins: (plan) => {
        const { planCycleMarginIn } = get()
        const cycles = plan.billing_cycles?.length ? plan.billing_cycles : ['monthly']
        const out = []
        for (const key of cycles) {
          for (const currency of ['LYD', ...SELL_CURRENCIES]) {
            const margin = planCycleMarginIn(plan, key, currency)
            if (margin != null) out.push({ key, currency, margin })
          }
        }
        return out
      },

      // Margin of a plan's manual price at the given cycle, vs its per-client break-even.
      // null when the plan is uncosted or has no price for that cycle (never a fake 100%).
      planCycleMargin: (plan, cycleKey) => {
        const { unitLYD, isCosted } = get().getPlanTotalCost(plan.id)
        const price = planCyclePrice(plan, cycleKey)
        if (!isCosted || price == null) return null
        return marginPct(unitLYD * getCycle(cycleKey).months, price)
      },

      // ── Computed: plan break-even from cost center ───────────────
      // `rates` (optional) = { USD, EUR }: cost at those rates instead of the live settings (reports, what-ifs).
      getCostCenterPlanCost: (costCenterId, planId, rates) => {
        const { costCenterComponents, costCenterPlans, components, monthlyComponentCost, monthlyComponentCostAtRates } = get()
        const costOf = (comp) => rates ? monthlyComponentCostAtRates(comp, rates.USD, rates.EUR) : monthlyComponentCost(comp)

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
          const monthlyCostLYD = costOf(comp)

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
        const costPerCapacityClient = planClients > 0 ? totalLYD / planClients : 0
        return {
          breakdown, sharedTotal, dedicatedTotal,
          totalLYD,
          planClients, totalClients, weight,
          actualClients, occupancy,
          // cost per client at full capacity vs at actual occupancy
          costPerCapacityClient,
          costPerActualClient: actualClients > 0 ? totalLYD / actualClients : 0,
          // monthly cost of the unsold slots (not covered by current clients at the capacity rate)
          idleCostLYD: Math.max(0, totalLYD - costPerCapacityClient * actualClients),
        }
      },

      // ── Computed: full plan cost ─────────────────────────────────
      getPlanTotalCost: (planId, rates) => {
        const { allocations, components, monthlyComponentCost, monthlyComponentCostAtRates, costCenters, costCenterPlans, getCostCenterPlanCost } = get()
        const costOf = (comp) => rates ? monthlyComponentCostAtRates(comp, rates.USD, rates.EUR) : monthlyComponentCost(comp)

        const planAllocs = allocations.filter(a => a.plan_id === planId)
        let directTotal = 0
        const directBreakdown = []
        for (const alloc of planAllocs) {
          const comp = components.find(c => c.id === alloc.component_id)
          if (!comp) continue
          const monthly = costOf(comp)
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
          const result = getCostCenterPlanCost(ccId, planId, rates)
          ccContributions.push({ costCenter: cc, ...result })
          ccTotal += result.totalLYD
        }

        const totalLYD = directTotal + ccTotal

        // Client counts across the cost centers this plan belongs to.
        // A shared plan's cost is for ALL its clients → per-client cost = total ÷ clients.
        const myLinks = costCenterPlans.filter(cp => cp.plan_id === planId)
        const clientCapacity = myLinks.reduce((s, cp) => s + (cp.max_clients || 0), 0)
        const clientActual = myLinks.reduce((s, cp) => s + (cp.actual_clients || 0), 0)

        // per-client monthly cost on each basis; falls back to whole-plan when no cost center
        const perClientCapacity = clientCapacity > 0 ? totalLYD / clientCapacity : totalLYD
        const perClientActual = clientActual > 0 ? totalLYD / clientActual : null

        // The figure to price against: per client (÷ full capacity) when sold per client, else whole-plan.
        const isPerClient = clientCapacity > 0
        const unitLYD = isPerClient ? perClientCapacity : totalLYD

        // Monthly cost of the unsold slots: not covered by current clients at the per-client cost.
        const idleCostLYD = isPerClient ? Math.max(0, totalLYD - perClientCapacity * clientActual) : 0

        return {
          directTotal, ccTotal,
          totalLYD,                 // whole plan (all clients)
          unitLYD,                  // per client at full capacity (or whole-plan if not a shared plan)
          clientCapacity, clientActual,
          perClientCapacity, perClientActual,
          idleCostLYD,
          isPerClient,
          // A plan with no costs linked must never show a margin — it's uncosted, not 100% profitable.
          isCosted: totalLYD > 0,
          directBreakdown, ccContributions,
        }
      },

      // ── Management report ───────────────────────────────────────
      // Builds the rows + summary of a management report for the chosen plans, at the REPORT's
      // exchange rates (never mutates settings). cycleMode: 'main' (each plan's main cycle) | a cycle key.
      // currency: 'LYD' | 'USD' | 'EUR' — the currency amounts are shown in (converted at the report rate).
      buildPlanReport: ({ planIds, rates, cycleMode = 'main', currency = 'LYD' }) => {
        const { plans, getPlanTotalCost, getSetting, getPlanCat, planCyclePriceIn } = get()
        const toCur = (lyd) => currency === 'LYD' ? lyd : (rates[currency] > 0 ? lyd / rates[currency] : 0)
        const toLYDAt = (amount, cur) => cur === 'LYD' ? amount : amount * (rates[cur] || 0)
        const defaultMarkup = getSetting('default_markup_pct')
        const target = getSetting('target_margin_pct')

        const rows = planIds.map(id => plans.find(p => p.id === id)).filter(Boolean).map(plan => {
          const cycles = sortCycles(plan.billing_cycles)
          const cycleKey = cycleMode === 'main' ? defaultCycle(cycles) : cycleMode
          const months = getCycle(cycleKey).months
          const { unitLYD, isCosted, isPerClient, clientCapacity } = getPlanTotalCost(plan.id, rates)
          const markup = plan.markup_override_pct ?? defaultMarkup
          const costLYD = unitLYD * months
          const suggestedLYD = costLYD * (1 + markup / 100)

          // The plan's own price for this cycle: in the report currency if set, else LYD, else another currency.
          const order = [currency, 'LYD', ...SELL_CURRENCIES].filter((c, i, a) => a.indexOf(c) === i)
          let price = null, priceCur = null
          for (const c of order) {
            const v = planCyclePriceIn(plan, cycleKey, c)
            if (v != null) { price = v; priceCur = c; break }
          }
          const priceLYD = price != null ? toLYDAt(price, priceCur) : null
          const margin = isCosted && priceLYD ? marginPct(costLYD, priceLYD) : null

          let flag = 'ok'
          if (!isCosted) flag = 'uncosted'
          else if (price == null) flag = 'no-price'
          else if (margin < 0) flag = 'loss'
          else if (margin < target) flag = 'below'

          return {
            plan, category: getPlanCat(plan.category)?.label || plan.category,
            cycleKey, cycleLabel: getCycle(cycleKey).label, soldInCycle: cycles.includes(cycleKey),
            isPerClient, clientCapacity, markup,
            cost: toCur(costLYD), suggested: toCur(suggestedLYD),
            // shown in the report currency; `priceExact` = entered in that currency (not converted)
            price: price == null ? null : (priceCur === currency ? price : toCur(priceLYD)),
            priceExact: priceCur === currency, priceCur,
            margin, flag,
          }
        })

        const priced = rows.filter(r => r.margin != null)
        const count = (f) => rows.filter(r => r.flag === f).length
        return {
          rows, target,
          summary: {
            plans: rows.length,
            ok: count('ok'), below: count('below'), loss: count('loss'),
            noPrice: count('no-price'), uncosted: count('uncosted'),
            avgMargin: priced.length ? priced.reduce((s, r) => s + r.margin, 0) / priced.length : null,
          },
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
            planHistory: s.planHistory,
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
          'componentCategories', 'planCategories', 'activityLog', 'rateHistory', 'planHistory',
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
          planHistory: [],
        })
        get().log('reset', 'system', 'All data', 'Reset to seed data')
      },

      // ── Toggle language ───────────────────────────────────────────
      toggleLang: () => set(s => ({ lang: s.lang === 'en' ? 'ar' : 'en' })),
      toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
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
        planHistory: state.planHistory,
        lang: state.lang,
        theme: state.theme,
        tourSeen: state.tourSeen,
      }),
    }
  )
)

export default useAppStore
