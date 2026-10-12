import type { ParsedTrade } from '@/lib/csv'
import { supabase } from '@/lib/supabase'
import type { Platform } from '@/types/domain'

const CHUNK_SIZE = 500

export interface ImportRequest {
  accountId: string
  platform: Platform
  filename: string
  trades: ParsedTrade[]
}

export interface ImportOutcome {
  inserted: number
  // Trades already present on the account from an earlier import.
  skipped: number
}

// Records an import batch and inserts its trades, ignoring any the account
// already has. A failure part-way removes the batch and everything it added.
export async function importTrades({ accountId, platform, filename, trades }: ImportRequest): Promise<ImportOutcome> {
  const client = supabase!
  const batch = await client.from('import_batches').insert({ account_id: accountId, platform, filename, row_count: 0 }).select('id').single()
  if (batch.error) throw batch.error
  const batchId = batch.data.id as string

  let inserted = 0
  try {
    for (let start = 0; start < trades.length; start += CHUNK_SIZE) {
      const rows = trades.slice(start, start + CHUNK_SIZE).map((trade) => ({ ...trade, account_id: accountId, batch_id: batchId }))
      const { data, error } = await client.from('trades').upsert(rows, { onConflict: 'account_id,dedupe_key', ignoreDuplicates: true }).select('id')
      if (error) throw error
      inserted += data.length
    }
    const finish =
      inserted > 0
        ? await client.from('import_batches').update({ row_count: inserted }).eq('id', batchId)
        : await client.from('import_batches').delete().eq('id', batchId)
    if (finish.error) throw finish.error
  } catch (error) {
    await client.from('import_batches').delete().eq('id', batchId)
    throw error
  }
  return { inserted, skipped: trades.length - inserted }
}
