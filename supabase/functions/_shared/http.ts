// Helpers shared by the edge functions.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// A client acting as the caller (subject to RLS) and the caller's user, or
// null when the request carries no valid session.
export async function authenticate(req: Request): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data } = await supabase.auth.getUser()
  return data.user ? { supabase, user: data.user } : null
}

// Service-role client for the tables the browser is locked out of. Always
// filter by the authenticated user's id when using it.
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}
