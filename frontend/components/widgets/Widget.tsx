import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const widgetVariants = cva(
  "relative overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-card transition hover:shadow-card-hover dark:border-border/80 dark:bg-card/95",
  {
    variants: {
      padding: {
        default: "p-5",
        sm: "p-4",
        none: "p-0",
      },
    },
    defaultVariants: {
      padding: "default",
    },
  }
);

export interface WidgetProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof widgetVariants> {
  dataSource?: "live" | "seed" | "mixed" | "dummy";
}

export function Widget({ className, padding, dataSource, children, ...props }: WidgetProps) {
  return (
    <div
      className={cn(
        widgetVariants({ padding }),
        dataSource === "dummy" && "border-dashed opacity-90",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
