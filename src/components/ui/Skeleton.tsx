import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-sunken', className)} />;
}

export function TreeSkeleton() {
  return (
    <div role="status" aria-label="Loading workspace" className="space-y-2 px-3 py-2">
      {['w-3/4', 'w-1/2', 'w-2/3', 'w-2/5', 'w-3/5', 'w-1/3', 'w-4/6'].map((width, i) => (
        <div key={i} className={cn('flex items-center gap-2', i % 3 !== 0 && 'pl-4')}>
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className={cn('h-3.5', width)} />
        </div>
      ))}
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div role="status" aria-label="Loading board" className="flex gap-4 overflow-hidden p-6">
      {[3, 2, 4, 1].map((n, col) => (
        <div key={col} className="w-72 shrink-0 space-y-3 rounded-panel bg-surface-muted p-3">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: n }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-card bg-surface p-3 shadow-card">
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-2/3" />
              <div className="flex justify-between pt-1">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading tasks" className="p-6">
      <div className="overflow-hidden rounded-panel bg-surface shadow-card">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className={cn('h-3.5', i % 2 ? 'w-1/3' : 'w-2/5')} />
            <div className="flex-1" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
