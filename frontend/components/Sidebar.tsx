"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  GitBranch,
  CheckCircle2,
  Activity,
  ShieldAlert,
  Wallet,
  Users,
  Settings,
  CreditCard,
  Menu,
  X,
  FileCheck,
  FileText,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const navSections = [
  { label: "Overview", icon: LayoutDashboard, value: "overview" },
  { label: "Engineering", icon: GitBranch, value: "engineering" },
  { label: "Product Delivery", icon: CheckCircle2, value: "product" },
  { label: "Operations", icon: Activity, value: "operations" },
  { label: "Payments", icon: CreditCard, value: "payments" },
  { label: "Security", icon: ShieldAlert, value: "security" },
  { label: "Compliance", icon: FileCheck, value: "compliance" },
  { label: "Cost", icon: Wallet, value: "cost" },
  { label: "Reports", icon: FileText, value: "reports" },
  { label: "Team", icon: Users, value: "team" },
  { label: "Settings", icon: Settings, value: "settings" },
];

interface SidebarProps {
  active: string;
  onSelect: (v: string) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <aside className="sticky top-0 z-20 hidden h-screen w-16 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center justify-center border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow">
            <span className="text-lg font-bold">C</span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col items-center gap-1 py-3">
          {navSections.map((item) => (
            <NavButton
              key={item.value}
              item={item}
              active={active === item.value}
              onClick={() => onSelect(item.value)}
            />
          ))}
        </nav>

        <div className="border-t border-border py-3">
          <NavButton
            item={{ label: "Settings", icon: Settings, value: "settings" }}
            active={active === "settings"}
            onClick={() => onSelect("settings")}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: { label: string; icon: React.ElementType; value: string };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl transition",
            active
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-label={item.label}
        >
          <Icon size={20} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{item.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function MobileNav({ active, onSelect }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <span className="text-sm font-semibold text-foreground">
          {navSections.find((n) => n.value === active)?.label || "CTO Dash"}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      {open && (
        <nav className="border-b border-border bg-card p-2">
          {navSections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                onClick={() => {
                  onSelect(item.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active === item.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function MobileBottomNav({ active, onSelect }: SidebarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t border-border bg-card px-2 py-1 md:hidden">
      {navSections.slice(0, 5).map((item) => {
        const Icon = item.icon;
        const isActive = active === item.value;
        return (
          <button
            key={item.value}
            onClick={() => onSelect(item.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-label={item.label}
          >
            <Icon size={18} />
            <span className="truncate max-w-[4.5rem]">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
