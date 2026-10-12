import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// Null until .env.local is filled in; App renders a setup notice in that case.
export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null
