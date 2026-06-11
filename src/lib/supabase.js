import { createClient } from '@supabase/supabase-js'

// Credentials come from a local .env file (Vite exposes VITE_* vars).
// If they're missing, the app runs exactly as before (localStorage only).
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isCloudEnabled = !!(url && key)

export const supabase = isCloudEnabled ? createClient(url, key) : null

// The single row that holds the whole app snapshot (document-store approach).
export const STATE_TABLE = 'app_state'
export const STATE_ROW_ID = 'main'
