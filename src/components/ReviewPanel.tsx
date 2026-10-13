import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { NativeSelect } from '@/components/FormDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGenerateReview, usePayouts, useReviews, useTags, useTradeTags } from '@/lib/queries'
import { buildReviewStats, type ReviewItem } from '@/lib/review'
import { cn } from '@/lib/utils'
import type { Account, Trade } from '@/types/domain'

function Section({ title, items }: { title: string; items: ReviewItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="grid content-start gap-3">
      <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{title}</h3>
      {items.map((item) => (
        <div key={item.title} className="grid gap-1">
          <div className="flex items-center gap-2 font-medium">
            {item.title}
            {item.confidence && <Badge variant="outline">{item.confidence} confidence</Badge>}
          </div>
          <p className="text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

const HIDDEN_KEY = 'proprhino.reviewHidden'

// Whether the review body is hidden, remembered in this browser.
function useHidden(): [boolean, (hidden: boolean) => void] {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDDEN_KEY) === '1'
    } catch {
      return false
    }
  })
  return [
    hidden,
    (next) => {
      setHidden(next)
      try {
        localStorage.setItem(HIDDEN_KEY, next ? '1' : '0')
      } catch {
        // Storage can be unavailable (private windows); the toggle still works for this visit.
      }
    },
  ]
}

interface ReviewPanelProps {
  // The account under review, or null for all accounts.
  account: Account | null
  // Accounts and trades already narrowed to that scope.
  accounts: Account[]
  trades: Trade[]
}

// AI-written review of trading behaviour for the current Performance scope.
export function ReviewPanel({ account, accounts, trades }: ReviewPanelProps) {
  const { data: reviews = [] } = useReviews()
  const { data: payouts = [] } = usePayouts()
  const { data: tags = [] } = useTags()
  const { data: tradeTags = [] } = useTradeTags()
  const generate = useGenerateReview()
  const [selectedId, setSelectedId] = useState('')
  const [hidden, setHidden] = useHidden()

  const scope = account?.label ?? 'All accounts'
  const scoped = reviews.filter((review) => review.account_id === (account?.id ?? null))
  const review = scoped.find((item) => item.id === selectedId) ?? scoped[0]
  const when = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

  function handleGenerate() {
    generate.mutate(
      { accountId: account?.id ?? null, stats: buildReviewStats({ scope, accounts, trades, payouts, tags, tradeTags }) },
      {
        onSuccess: () => {
          setSelectedId('')
          setHidden(false)
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" />
          AI review, {scope}
          {review && hidden && <span className="font-normal text-muted-foreground">written {when(review.created_at)}</span>}
        </CardTitle>
        {scoped.length > 1 && !hidden && (
          <NativeSelect aria-label="Past reviews" className="ml-auto w-56" value={review?.id} onChange={(event) => setSelectedId(event.target.value)}>
            {scoped.map((item) => (
              <option key={item.id} value={item.id}>
                {when(item.created_at)}
              </option>
            ))}
          </NativeSelect>
        )}
        <div className={scoped.length > 1 && !hidden ? 'flex gap-2' : 'ml-auto flex gap-2'}>
          {review && (
            <Button variant="ghost" aria-expanded={!hidden} onClick={() => setHidden(!hidden)}>
              {hidden ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
              {hidden ? 'Show' : 'Hide'}
            </Button>
          )}
          <Button disabled={generate.isPending} onClick={handleGenerate}>
            {generate.isPending ? 'Reviewing…' : review ? 'New review' : 'Generate review'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn('grid gap-5', review && hidden && !generate.isPending && !generate.error && 'hidden')}>
        {generate.isPending && <p className="text-muted-foreground">Claude is reading your {trades.length} trades. This can take up to a minute.</p>}
        {generate.error && <p className="text-destructive">Review failed: {generate.error.message}</p>}
        {!review && !generate.isPending && (
          <p className="text-muted-foreground">
            Get written feedback on your trading behaviour for {scope === 'All accounts' ? 'all accounts' : scope}: what is working, what is costing you, and what to try
            next. Your statistics and recent trades are sent to Anthropic to write it.
          </p>
        )}
        {review && !hidden && (
          <>
            <p className="text-base">{review.content.summary}</p>
            <div className="grid gap-6 lg:grid-cols-2">
              <Section title="What's working" items={review.content.strengths} />
              <Section title="What's costing you" items={review.content.leaks} />
              <Section title="Rule risk" items={review.content.rule_risks} />
              <Section title="Try next" items={review.content.actions} />
            </div>
            <p className="text-xs text-muted-foreground">
              {review.content.caveats} Written {when(review.created_at)} from {review.trade_count} trades by {review.model}.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
