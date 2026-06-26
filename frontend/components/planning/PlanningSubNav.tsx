"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface PlanningSubNavProps {
  active: "sprints" | "resources" | "productivity";
}

export function PlanningSubNav({ active }: PlanningSubNavProps) {
  const items = [
    { id: "sprints", label: "Sprints", href: "/sprints" },
    { id: "resources", label: "Resources", href: "/resources" },
    { id: "productivity", label: "Productivity", href: "/productivity" },
  ];

  return (
    <nav className="flex items-center gap-1 rounded-lg border bg-muted p-1 w-fit">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === item.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
