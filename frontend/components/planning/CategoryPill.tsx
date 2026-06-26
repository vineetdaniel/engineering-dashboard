"use client";

import { Badge } from "@/components/ui/badge";
import type { TaskCategory } from "@/lib/actions/sprints";

const variantMap: Record<TaskCategory, "default" | "warning" | "secondary"> = {
  product: "default",
  integration: "warning",
  other: "secondary",
};

const labelMap: Record<TaskCategory, string> = {
  product: "Product",
  integration: "Integration",
  other: "Other",
};

interface CategoryPillProps {
  category: TaskCategory;
  onChange?: (category: TaskCategory) => void;
}

export function CategoryPill({ category, onChange }: CategoryPillProps) {
  if (!onChange) {
    return <Badge variant={variantMap[category]}>{labelMap[category]}</Badge>;
  }

  return (
    <select
      value={category}
      onChange={(e) => onChange(e.target.value as TaskCategory)}
      className={`rounded-full border-0 px-2 py-0.5 text-xs font-semibold ${
        category === "product"
          ? "bg-primary text-primary-foreground"
          : category === "integration"
          ? "bg-warning text-warning-foreground"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      <option value="product">Product</option>
      <option value="integration">Integration</option>
      <option value="other">Other</option>
    </select>
  );
}
