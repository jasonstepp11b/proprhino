import type { Tag, Trade, TradeTag } from '@/types/domain'

export interface TagSummary {
  tag: Tag
  tradeCount: number
  netPnl: number
  // Null when the tag is on no trades.
  winRatePct: number | null
}

// Net result of the trades carrying each tag. A trade with several tags
// counts toward each of them.
export function summarizeTags(tags: Tag[], tradeTags: TradeTag[], trades: Pick<Trade, 'id' | 'net_pnl'>[]): TagSummary[] {
  const pnlByTrade = new Map(trades.map((trade) => [trade.id, trade.net_pnl]))
  const pnlsByTag = new Map<string, number[]>()
  for (const { trade_id, tag_id } of tradeTags) {
    const pnl = pnlByTrade.get(trade_id)
    if (pnl !== undefined) pnlsByTag.set(tag_id, [...(pnlsByTag.get(tag_id) ?? []), pnl])
  }
  return tags.map((tag) => {
    const pnls = pnlsByTag.get(tag.id) ?? []
    return {
      tag,
      tradeCount: pnls.length,
      netPnl: pnls.reduce((total, pnl) => total + pnl, 0),
      winRatePct: pnls.length ? (pnls.filter((pnl) => pnl > 0).length / pnls.length) * 100 : null,
    }
  })
}
