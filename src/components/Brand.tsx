import { cn } from '@/lib/utils'

// PropRhino mark and wordmark. `size` sets the mark's edge in pixels.
export function Brand({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5 font-semibold tracking-tight text-foreground', className)}>
      <img src="/logo-mark.png" alt="" width={size} height={size} className="rounded-lg" />
      <span>
        Prop<span className="text-primary">Rhino</span>
      </span>
    </div>
  )
}
