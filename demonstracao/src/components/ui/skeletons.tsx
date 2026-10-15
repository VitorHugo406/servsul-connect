import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/** Grid of skeleton cards, mimicking card-based lists (team members, war rooms, announcements, etc). */
export function CardGridSkeleton({
  count = 6,
  columns = 'md:grid-cols-2 lg:grid-cols-3',
  cardHeight = 'h-28',
  className,
}: {
  count?: number;
  columns?: string;
  cardHeight?: string;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-3', columns, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className={cn('p-4 flex items-center gap-3', cardHeight)}>
            <Skeleton className="glass-shimmer h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="glass-shimmer h-4 w-3/5 rounded-md" />
              <Skeleton className="glass-shimmer h-3 w-2/5 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Vertical list of skeleton rows, mimicking sidebar / table lists (notes, users, tasks). */
export function ListSkeleton({
  rows = 5,
  showAvatar = true,
  className,
}: {
  rows?: number;
  showAvatar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl glass-shimmer">
          {showAvatar && <Skeleton className="h-9 w-9 rounded-full bg-transparent" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3 rounded-md bg-transparent" />
            <Skeleton className="h-3 w-1/3 rounded-md bg-transparent" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Row of small stat/metric card skeletons (dashboards, headers with counters). */
export function StatsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-3', count <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-5', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-shimmer rounded-2xl h-20 w-full flex flex-col justify-center px-4 gap-2">
          <Skeleton className="h-3 w-1/2 rounded bg-transparent" />
          <Skeleton className="h-5 w-1/3 rounded bg-transparent" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for chart/graph widgets. */
export function ChartSkeleton({ height = 'h-40', className }: { height?: string; className?: string }) {
  return (
    <div className={cn('glass-shimmer rounded-2xl w-full flex items-end justify-around gap-2 p-4', height, className)}>
      {[40, 70, 55, 90, 60, 35].map((h, i) => (
        <div key={i} className="w-full rounded-md bg-foreground/10" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/** Full-section skeleton: header + stats + card grid. Useful for whole-page loading states. */
export function SectionSkeleton({
  withStats = true,
  cardCount = 6,
  className,
}: {
  withStats?: boolean;
  cardCount?: number;
  className?: string;
}) {
  return (
    <div className={cn('p-4 md:p-6 space-y-6', className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-3.5 w-64 rounded-md" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      {withStats && <StatsSkeleton />}
      <CardGridSkeleton count={cardCount} />
    </div>
  );
}
