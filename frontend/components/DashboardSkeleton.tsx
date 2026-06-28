export function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar placeholder */}
      <aside className="sticky top-0 hidden h-screen w-16 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center justify-center border-b border-border">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-3 py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header placeholder */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          </div>
        </header>

        {/* Mobile nav placeholder */}
        <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2 md:hidden">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
        </div>

        {/* Main content skeleton */}
        <main className="flex-1 p-4 pb-20 md:pb-4 lg:p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="h-8 w-56 animate-pulse rounded bg-muted" />
            <div className="h-4 w-80 animate-pulse rounded bg-muted" />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="h-64 animate-pulse rounded-xl bg-muted" />
              <div className="h-64 animate-pulse rounded-xl bg-muted" />
            </div>

            <div className="h-96 animate-pulse rounded-xl bg-muted" />
          </div>
        </main>
      </div>
    </div>
  );
}
