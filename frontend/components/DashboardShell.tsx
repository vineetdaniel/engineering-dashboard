"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, MobileNav, MobileBottomNav, navSections } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { CommandMenu } from "@/components/CommandMenu";
import { type FilterState } from "@/components/GlobalFilters";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: React.ReactNode;
  activeSection?: string;
  className?: string;
}

const DEFAULT_FILTERS: FilterState = {
  dateRange: "7d",
  squad: "all",
  environment: "all",
};

export function DashboardShell({
  children,
  activeSection = "overview",
  className,
}: DashboardShellProps) {
  const router = useRouter();
  const [active, setActiveState] = useState(activeSection);
  const [commandOpen, setCommandOpen] = useState(false);

  // Keep shell highlight in sync when the URL-driven activeSection prop changes.
  useEffect(() => {
    setActiveState(activeSection);
  }, [activeSection]);
  const [filters] = useState<FilterState>(DEFAULT_FILTERS);
  const [lastUpdated] = useState<Date | null>(new Date());

  const setActive = (value: string) => {
    setActiveState(value);
    const section = navSections.find((n) => n.value === value);
    if (section?.href) {
      router.push(section.href);
    } else if (value !== "planning") {
      router.push(`/?section=${value}`);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar active={active} onSelect={setActive} />

      <div className="flex flex-1 flex-col min-w-0">
        <Header
          onRefresh={() => router.refresh()}
          onOpenCommand={() => setCommandOpen(true)}
          filters={filters}
          onFiltersChange={() => {}}
          lastUpdated={lastUpdated}
          backendOk={true}
        />
        <MobileNav active={active} onSelect={setActive} />

        <CommandMenu
          sections={navSections}
          active={active}
          onSelect={setActive}
          onRefresh={() => router.refresh()}
          open={commandOpen}
          onOpenChange={setCommandOpen}
        />

        <main className={cn("flex-1 p-4 pb-20 md:pb-4 lg:p-6", className)}>
          {children}
        </main>

        <MobileBottomNav active={active} onSelect={setActive} />
      </div>
    </div>
  );
}
