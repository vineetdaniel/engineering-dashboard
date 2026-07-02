"use client";

export function PageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      {/* Animated logo mark */}
      <div className="relative mb-8 flex h-16 w-16 items-center justify-center">
        {/* Spinning ring */}
        <svg className="absolute inset-0 h-full w-full animate-spin" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3"
            strokeDasharray="80 96" strokeLinecap="round"
            className="text-primary/30" />
          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3"
            strokeDasharray="40 136" strokeLinecap="round"
            className="text-primary" />
        </svg>
        {/* Inner logo */}
        <div className="z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg">
          <span className="text-lg font-bold">C</span>
        </div>
      </div>

      {/* Animated bars */}
      <div className="mb-6 flex items-end gap-1.5">
        {[0.6, 1, 0.8, 1.2, 0.7, 1.1, 0.9].map((h, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-primary/40"
            style={{
              height: `${h * 20}px`,
              animation: `pulse 1.2s ease-in-out ${i * 0.1}s infinite alternate`,
            }}
          />
        ))}
      </div>

      <p className="text-sm font-medium text-muted-foreground animate-pulse">
        Loading dashboard…
      </p>

      <style>{`
        @keyframes pulse {
          from { opacity: 0.3; transform: scaleY(0.6); }
          to   { opacity: 1;   transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
