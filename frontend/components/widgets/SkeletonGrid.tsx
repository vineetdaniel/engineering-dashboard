import { cn } from "@/lib/utils";

interface SkeletonGridProps {
  cols?: number;
  rows?: number;
  className?: string;
}

export function SkeletonGrid({ cols = 4, rows = 1, className }: SkeletonGridProps) {
  return (
    <div
      className={cn("grid gap-4", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl bg-muted"
        />
      ))}
    </div>
  );
}

export function SkeletonWidget({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-80 animate-pulse rounded-2xl bg-muted", className)}
    />
  );
}
