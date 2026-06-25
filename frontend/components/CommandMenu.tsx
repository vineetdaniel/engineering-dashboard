"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Command, LayoutDashboard, GitBranch, CheckCircle2, Activity, ShieldAlert, Wallet, Users, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type CommandAction = {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ElementType;
  action: () => void;
};

interface CommandMenuProps {
  sections: { value: string; label: string; icon: React.ElementType }[];
  active: string;
  onSelect: (value: string) => void;
  onRefresh: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandMenu({ sections, active, onSelect, onRefresh, open, onOpenChange }: CommandMenuProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const navActions: CommandAction[] = useMemo(
    () =>
      sections.map((section) => ({
        id: `nav-${section.value}`,
        label: `Go to ${section.label}`,
        icon: section.icon,
        action: () => {
          onSelect(section.value);
          onOpenChange(false);
        },
      })),
    [sections, onSelect, onOpenChange]
  );

  const utilityActions: CommandAction[] = useMemo(
    () => [
      {
        id: "refresh",
        label: "Refresh dashboard data",
        icon: RefreshCw,
        action: () => {
          onRefresh();
          onOpenChange(false);
        },
      },
    ],
    [onRefresh, onOpenChange]
  );

  const allActions = useMemo(() => [...navActions, ...utilityActions], [navActions, utilityActions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allActions;
    return allActions.filter((a) => a.label.toLowerCase().includes(q));
  }, [allActions, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <DialogDescription className="sr-only">
          Search sections and actions. Press Escape to close.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={18} className="text-muted-foreground" />
          <Input
            placeholder="Search sections or actions…"
            className="h-8 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="hidden items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground sm:flex">
            <Command size={12} />
            <span>K</span>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No results found.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={action.action}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                      active === action.id.replace("nav-", "")
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon size={16} className="text-muted-foreground" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
