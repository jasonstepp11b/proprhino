import { FunctionsHttpError } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { importTrades } from '@/lib/importTrades'
import type { buildReviewStats, Review } from '@/lib/review'
import type { Account, Expense, ImportBatch, Payout, Tag, Trade, TradeTag } from '@/types/domain'

type TableName = 'accounts' | 'expenses' | 'payouts' | 'trades' | 'import_batches' | 'tags' | 'trade_tags' | 'ai_reviews'

const PAGE_SIZE = 1000

// PostgREST caps a response at 1000 rows, so large tables are read in pages.
// `tiebreak` must make the ordering unique so pages never overlap.
async function fetchAll<T>(table: TableName, orderBy: string, tiebreak = 'id'): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase!
      .from(table)
      .select('*')
      .order(orderBy, { ascending: false })
      .order(tiebreak)
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data as T[]))
    if (data.length < PAGE_SIZE) return rows
  }
}

export const useAccounts = () => useQuery({ queryKey: ['accounts'], queryFn: () => fetchAll<Account>('accounts', 'created_at') })
export const useExpenses = () => useQuery({ queryKey: ['expenses'], queryFn: () => fetchAll<Expense>('expenses', 'incurred_on') })
export const usePayouts = () => useQuery({ queryKey: ['payouts'], queryFn: () => fetchAll<Payout>('payouts', 'paid_on') })
export const useTrades = () => useQuery({ queryKey: ['trades'], queryFn: () => fetchAll<Trade>('trades', 'exit_time') })
export const useImportBatches = () => useQuery({ queryKey: ['import_batches'], queryFn: () => fetchAll<ImportBatch>('import_batches', 'created_at') })
export const useTags = () => useQuery({ queryKey: ['tags'], queryFn: () => fetchAll<Tag>('tags', 'name') })
export const useTradeTags = () => useQuery({ queryKey: ['trade_tags'], queryFn: () => fetchAll<TradeTag>('trade_tags', 'trade_id', 'tag_id') })
export const useReviews = () => useQuery({ queryKey: ['ai_reviews'], queryFn: () => fetchAll<Review>('ai_reviews', 'created_at') })

// Inserts when `id` is absent, otherwise updates that row.
export function useSaveRow<T>(table: TableName) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Partial<T> }) => {
      const query = supabase!.from(table)
      const row = values as Record<string, unknown>
      const { error } = id ? await query.update(row).eq('id', id) : await query.insert(row)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  })
}

export function useDeleteRow(table: TableName) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase!.from(table).delete().eq('id', id)
      if (error) throw error
    },
    // Deleting a tag also removes it from its trades.
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: [table] }), queryClient.invalidateQueries({ queryKey: ['trade_tags'] })]),
  })
}

export function useImportTrades() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importTrades,
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['trades'] }), queryClient.invalidateQueries({ queryKey: ['import_batches'] })]),
  })
}

// Deleting a batch cascades to the trades it brought in.
export function useDeleteBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase!.from('import_batches').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['trades'] }), queryClient.invalidateQueries({ queryKey: ['import_batches'] })]),
  })
}

const TAG_CHUNK_SIZE = 100

// Adds a tag to, or removes it from, a set of trades.
export function useTagTrades() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ tagId, tradeIds, action }: { tagId: string; tradeIds: string[]; action: 'add' | 'remove' }) => {
      for (let start = 0; start < tradeIds.length; start += TAG_CHUNK_SIZE) {
        const chunk = tradeIds.slice(start, start + TAG_CHUNK_SIZE)
        const query = supabase!.from('trade_tags')
        const { error } =
          action === 'add'
            ? await query.upsert(
                chunk.map((tradeId) => ({ trade_id: tradeId, tag_id: tagId })),
                { onConflict: 'trade_id,tag_id', ignoreDuplicates: true },
              )
            : await query.delete().eq('tag_id', tagId).in('trade_id', chunk)
        if (error) throw error
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['trade_tags'] }),
  })
}

// Permanently removes an account and everything recorded against it. Payouts
// and expenses go first; the account delete then cascades to its imports,
// trades and their tags.
export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      for (const table of ['payouts', 'expenses'] as const) {
        const { error } = await supabase!.from(table).delete().eq('account_id', id)
        if (error) throw error
      }
      const { error } = await supabase!.from('accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries(),
  })
}

// Calls an edge function and turns its failures into readable errors.
async function invokeFunction<T>(name: string, options: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown } = {}): Promise<T> {
  const { data, error } = await supabase!.functions.invoke(name, options as Parameters<NonNullable<typeof supabase>['functions']['invoke']>[1])
  if (!error) return data as T
  if (error instanceof FunctionsHttpError) {
    if (error.context.status === 404) throw new Error(`The "${name}" function is not deployed yet.`)
    const body = (await error.context.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `The "${name}" function failed (${error.context.status}).`)
  }
  // An undeployed function fails the browser's preflight, which surfaces here
  // rather than as a 404.
  throw new Error(`Could not reach the "${name}" function. It may not be deployed yet: run "npx supabase functions deploy".`)
}

// Asks the `review` edge function for an AI review of the given statistics.
// The function stores the result, so success just refreshes the list.
export function useGenerateReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: { accountId: string | null; stats: ReturnType<typeof buildReviewStats> }) => invokeFunction<Review>('review', { body: request }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai_reviews'] }),
  })
}

// What the browser is allowed to know about the saved Anthropic key.
export interface ApiKeyStatus {
  configured: boolean
  // Last four characters of the saved key.
  hint?: string
  updatedAt?: string
}

export const useApiKeyStatus = () => useQuery({ queryKey: ['api_key'], queryFn: () => invokeFunction<ApiKeyStatus>('api-key', { method: 'GET' }), retry: false })

// Saves a new key (`apiKey` set) or removes the saved one (`apiKey` null).
export function useUpdateApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (apiKey: string | null) => invokeFunction<ApiKeyStatus>('api-key', apiKey === null ? { method: 'DELETE' } : { method: 'POST', body: { apiKey } }),
    onSuccess: (status) => queryClient.setQueryData(['api_key'], status),
  })
}
