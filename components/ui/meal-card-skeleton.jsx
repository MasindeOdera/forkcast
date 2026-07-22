import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * <MealCardSkeleton /> — pulsing placeholder that matches the real
 * <MealCard /> footprint so the layout doesn't jump when data arrives.
 *
 * Use <MealCardGrid count={6} /> to render a full loading grid; the count
 * defaults to 6 which matches ~2 rows on desktop / 6 rows on mobile.
 */
export function MealCardSkeleton() {
  return (
    <Card className="overflow-hidden" aria-hidden="true">
      {/* Image area — matches MealCard's aspect-video image slot */}
      <Skeleton className="aspect-video w-full rounded-none" />

      <CardHeader className="space-y-2 pb-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function MealCardGrid({ count = 6 }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      role="status"
      aria-label="Loading meals"
    >
      {Array.from({ length: count }).map((_, i) => (
        <MealCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading meals…</span>
    </div>
  );
}

export default MealCardSkeleton;
