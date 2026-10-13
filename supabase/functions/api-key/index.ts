// Supabase Edge Function: stores the caller's Anthropic API key. The key is
// write-only from the browser's point of view; GET reports only whether one
// is saved and its last four characters.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { adminClient, authenticate, CORS, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const session = await authenticate(req)
    if (!session) return json({ error: 'Not signed in.' }, 401)
    const secrets = adminClient().from('user_secrets')
    const userId = session.user.id

    if (req.method === 'GET') {
      const { data, error } = await secrets.select('anthropic_api_key, updated_at').eq('user_id', userId).maybeSingle()
      if (error) throw error
      return json(data ? { configured: true, hint: data.anthropic_api_key.slice(-4), updatedAt: data.updated_at } : { configured: false })
    }

    if (req.method === 'DELETE') {
      const { error } = await secrets.delete().eq('user_id', userId)
      if (error) throw error
      return json({ configured: false })
    }

    if (req.method === 'POST') {
      const { apiKey } = (await req.json()) as { apiKey?: unknown }
      const key = typeof apiKey === 'string' ? apiKey.trim() : ''
      if (!key.startsWith('sk-ant-') || key.length > 300) return json({ error: 'That does not look like an Anthropic API key (it should start with "sk-ant-").' }, 400)

      // A free call that confirms the key works before it is saved.
      try {
        await new Anthropic({ apiKey: key }).models.list({ limit: 1 })
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          return json({ error: 'Anthropic rejected this key. Check that it was copied in full and is still active.' }, 400)
        }
        throw error
      }

      const updatedAt = new Date().toISOString()
      const { error } = await secrets.upsert({ user_id: userId, anthropic_api_key: key, updated_at: updatedAt })
      if (error) throw error
      return json({ configured: true, hint: key.slice(-4), updatedAt })
    }

    return json({ error: 'Method not allowed.' }, 405)
  } catch (error) {
    if (error instanceof Anthropic.APIError) return json({ error: `Could not verify the key with Anthropic (${error.status ?? 'network error'}).` }, 502)
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
