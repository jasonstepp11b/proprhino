// Supabase Edge Function: writes an AI review of the caller's trading
// statistics with Claude and stores it in ai_reviews.
//
// The browser computes the statistics and sends them here. The Anthropic key
// is the one the caller saved on the Settings page (see ../api-key), falling
// back to an ANTHROPIC_API_KEY function secret if one is set.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { adminClient, authenticate, CORS, json } from '../_shared/http.ts'

const MODEL = 'claude-opus-5-5'
// Guards against the endpoint being used as a general-purpose proxy.
const MAX_BODY_CHARS = 120_000
const DAILY_REVIEW_LIMIT = 20

const SYSTEM = `You are an experienced trading performance coach reviewing the execution record of a retail futures trader who trades prop firm accounts (evaluation and funded accounts with firm-imposed rules). The trader will read your review inside their trading journal app to decide what to change in how they trade.

The user message is a JSON document of statistics the app computed from the trader's imported Tradovate fills. Some context for reading it:
- Every figure is net of commissions unless it says gross. Treat the numbers as correct; do not recompute them.
- A "trade" is one row of the Tradovate export, which pairs a buy fill with a sell fill. A position closed in pieces appears as several trades, so trade counts and win rates overstate how many separate decisions were made.
- Times are US Eastern. A trading day follows the futures session, which rolls at 6 PM ET, so Sunday-evening trades belong to Monday.
- A consistency rule limits the best single day to a percentage of total profit; breaching it blocks a payout until further profit dilutes that day. A minimum-trading-days rule requires that many days traded before a payout.
- Setups and mistakes are tags the trader applied themselves. Untagged trades are common.

Review the trader's behaviour: timing, hold times, sizing, how wins and losses are distributed, how they trade after losses, tagged setups and mistakes, and how their pattern of results interacts with the firm rules. Stay on execution and discipline. Do not predict markets, recommend instruments or directions, or comment on what the accounts cost.

Tie every observation to specific numbers from the data, and say how many trades or days it rests on. Much of this data is thin: when a pattern comes from a handful of trades or is driven by one outlier, say so plainly and rate it low confidence rather than presenting it as a finding. A few well-supported observations are worth more than a long list, so leave a section empty when the data does not support anything worth saying.

Make each suggested action concrete enough to follow in the next session and to check against the next import, for example a specific time window, hold-time threshold or daily stop. Write plainly and directly, as you would to a trader you respect: no hype, no hedging boilerplate, no disclaimers.`

const item = (extra: Record<string, unknown> = {}, required: string[] = []) => ({
  type: 'array',
  items: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short headline, under ten words.' },
      detail: { type: 'string', description: 'One to three sentences citing the numbers behind it.' },
      ...extra,
    },
    required: ['title', 'detail', ...required],
    additionalProperties: false,
  },
})

const confidence = {
  confidence: { type: 'string', enum: ['low', 'medium', 'high'], description: 'How well the sample size supports this.' },
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Two or three sentences: the overall picture of how this trader is trading.' },
    strengths: { ...item(confidence, ['confidence']), description: 'Behaviours that are making money or protecting capital.' },
    leaks: { ...item(confidence, ['confidence']), description: 'Behaviours that are costing money.' },
    rule_risks: { ...item(), description: 'Ways the current pattern threatens the firm rules, per account where relevant.' },
    actions: { ...item(), description: 'Two or three specific things to do differently, most valuable first.' },
    caveats: { type: 'string', description: 'What the data cannot yet show, in one or two sentences.' },
  },
  required: ['summary', 'strengths', 'leaks', 'rule_risks', 'actions', 'caveats'],
  additionalProperties: false,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const session = await authenticate(req)
    if (!session) return json({ error: 'Not signed in.' }, 401)
    const { supabase, user } = session

    const raw = await req.text()
    if (raw.length > MAX_BODY_CHARS) return json({ error: 'Too much data to review at once.' }, 413)
    const { accountId, stats } = JSON.parse(raw) as { accountId: string | null; stats: { summary?: { tradeCount?: number } } }
    const tradeCount = stats?.summary?.tradeCount
    if (typeof tradeCount !== 'number' || tradeCount < 1) return json({ error: 'There are no trades to review.' }, 400)

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const recent = await supabase.from('ai_reviews').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo)
    if (recent.error) throw recent.error
    if ((recent.count ?? 0) >= DAILY_REVIEW_LIMIT) return json({ error: `Limit of ${DAILY_REVIEW_LIMIT} reviews per day reached.` }, 429)

    const keyRow = await adminClient().from('user_secrets').select('anthropic_api_key').eq('user_id', user.id).maybeSingle()
    if (keyRow.error) throw keyRow.error
    const apiKey = keyRow.data?.anthropic_api_key ?? Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'Add your Anthropic API key on the Settings page first.' }, 400)
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Re-runs the request on Anthropic's recommended model if a safety
      // classifier declines it.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: { type: 'json_schema', schema: REVIEW_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(stats) }],
    })

    if (response.stop_reason === 'refusal') return json({ error: 'The model declined to review this data.' }, 422)
    if (response.stop_reason === 'max_tokens') return json({ error: 'The review was cut off before it finished. Try again.' }, 502)
    const text = response.content.find((block) => block.type === 'text')
    if (!text || text.type !== 'text') return json({ error: 'The model returned no review.' }, 502)

    const saved = await supabase
      .from('ai_reviews')
      .insert({ account_id: accountId, model: response.model, trade_count: tradeCount, content: JSON.parse(text.text) })
      .select()
      .single()
    if (saved.error) throw saved.error
    return json(saved.data)
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json({ error: 'Anthropic rejected your API key. Update it on the Settings page.' }, 400)
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'Anthropic rate limit reached. Try again in a minute.' }, 429)
    if (error instanceof Anthropic.APIError) return json({ error: `Anthropic API error ${error.status}: ${error.message}` }, 502)
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
