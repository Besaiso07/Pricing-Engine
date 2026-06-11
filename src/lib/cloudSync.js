import { supabase, isCloudEnabled, STATE_TABLE, STATE_ROW_ID } from './supabase'
import useAppStore from '../store/appStore'

let hydrating = false      // true while applying cloud data → suppress save loop
let pushTimer = null
let started = false

const setCloud = (patch) => useAppStore.getState().setCloud(patch)

// Push the full app snapshot up to Supabase (debounced via schedulePush).
export async function pushNow() {
  if (!isCloudEnabled) return
  setCloud({ cloudStatus: 'saving' })
  try {
    const payload = useAppStore.getState().exportData()
    const { error } = await supabase
      .from(STATE_TABLE)
      .upsert({ id: STATE_ROW_ID, data: payload, updated_at: new Date().toISOString() })
    if (error) throw error
    setCloud({ cloudStatus: 'synced', cloudLastSync: new Date().toISOString(), cloudError: null })
  } catch (e) {
    setCloud({ cloudStatus: 'error', cloudError: e.message })
  }
}

function schedulePush() {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(pushNow, 1500)
}

// Pull the cloud snapshot down and replace local state.
export async function pullNow() {
  if (!isCloudEnabled) return false
  setCloud({ cloudStatus: 'connecting' })
  try {
    const { data, error } = await supabase
      .from(STATE_TABLE)
      .select('data, updated_at')
      .eq('id', STATE_ROW_ID)
      .maybeSingle()
    if (error) throw error
    if (data?.data) {
      hydrating = true
      useAppStore.getState().importData(data.data, 'replace', true)
      hydrating = false
      setCloud({ cloudStatus: 'synced', cloudLastSync: data.updated_at || new Date().toISOString(), cloudError: null })
      return true
    }
    setCloud({ cloudStatus: 'synced', cloudError: null })
    return false // no cloud row yet
  } catch (e) {
    hydrating = false
    setCloud({ cloudStatus: 'error', cloudError: e.message })
    return false
  }
}

// Called once on app start. Pulls cloud → local if a row exists; otherwise
// seeds the cloud from the current (localStorage-restored) state. Then keeps
// the cloud in sync with every change.
export async function initCloudSync() {
  if (started) return
  started = true

  if (!isCloudEnabled) {
    setCloud({ cloudStatus: 'disabled' })
    return
  }

  const hadCloud = await pullNow()
  if (!hadCloud && useAppStore.getState().cloudStatus !== 'error') {
    // first-time setup — push whatever is currently loaded up to the cloud
    await pushNow()
  }

  // keep cloud updated when actual DATA changes (debounced).
  // We compare data slices only, so cloud-status updates don't trigger a save loop.
  useAppStore.subscribe((state, prev) => {
    if (hydrating) return
    const changed = DATA_KEYS.some(k => state[k] !== prev[k])
    if (changed) schedulePush()
  })
}

// Persisted data slices worth syncing (cloudStatus/lastSync are intentionally excluded).
const DATA_KEYS = [
  'settings', 'components', 'plans', 'allocations',
  'costCenters', 'costCenterComponents', 'costCenterPlans',
  'componentCategories', 'planCategories', 'activityLog', 'rateHistory', 'lang',
]
