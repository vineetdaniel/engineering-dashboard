"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Bell, RefreshCw, ShieldAlert, Zap, Search, SlidersHorizontal, WifiOff } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { GlobalFilters, type FilterState } from "./GlobalFilters";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onRefresh: () => void;
  onOpenCommand: () => void;
  criticalCount?: number;
  incidentCount?: number;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  lastUpdated?: Date | null;
  backendOk?: boolean;
}

export function Header({
  onRefresh,
  onOpenCommand,
  criticalCount = 0,
  incidentCount = 0,
  filters,
  onFiltersChange,
  lastUpdated,
  backendOk = true,
}: HeaderProps) {
  const [spinning, setSpinning] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    onRefresh();
    setTimeout(() => setSpinning(false), 800);
  }

  return (
    <header className="glass-strong sticky top-0 z-30 flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow md:hidden">
          <span className="text-lg font-bold">C</span>
        </div>
        <div className="hidden md:block">
          <h1 className="text-lg font-bold text-gradient">Engineering Command Center</h1>
          <p className="text-xs text-muted-foreground">Fintech CTO Dashboard</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
        <div className="hidden lg:block">
          <GlobalFilters filters={filters} onChange={onFiltersChange} />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal size={14} className="mr-1.5" />
          Filters
        </Button>

        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>
              Adjust the date range, squad, and environment shown across the dashboard.
            </DialogDescription>
            <div className="pt-2">
              <GlobalFilters
                filters={filters}
                onChange={(next) => {
                  onFiltersChange(next);
                  setFiltersOpen(false);
                }}
                className="w-full flex-col items-stretch"
              />
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-1">
          {lastUpdated && (
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              </span>
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          )}

          {!backendOk && (
            <Badge variant="warning" className="gap-1">
              <WifiOff size={12} /> Offline
            </Badge>
          )}

          {incidentCount > 0 && (
            <Badge variant="danger" className="gap-1">
              <Zap size={12} />
              {incidentCount} Incident{incidentCount > 1 ? "s" : ""}
            </Badge>
          )}
          {criticalCount > 0 && (
            <Badge variant="warning" className="gap-1">
              <ShieldAlert size={12} />
              {criticalCount} CVE{criticalCount > 1 ? "s" : ""}
            </Badge>
          )}

          <Button variant="ghost" size="icon" aria-label="Search" onClick={onOpenCommand}>
            <Search size={18} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Refresh" onClick={handleRefresh}>
            <RefreshCw size={18} className={cn("transition", spinning && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell size={18} />
            {(criticalCount > 0 || incidentCount > 0) && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
            )}
          </Button>

          <ThemeToggle />

          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback className="bg-muted text-xs font-semibold">VD</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
