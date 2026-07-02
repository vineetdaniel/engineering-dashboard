"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  className?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  resetKey: number;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  retry = () => {
    this.setState((prev) => ({ hasError: false, error: undefined, resetKey: prev.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            "rounded-xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950",
            this.props.className
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-rose-600" size={18} />
            <div className="flex-1">
              <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
                Widget failed to load
              </p>
              <p className="mt-1 max-w-md text-xs text-rose-700 dark:text-rose-300">
                {this.state.error?.message || "Unknown error"}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 gap-2 border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900"
                onClick={this.retry}
              >
                <RefreshCw size={14} /> Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={this.state.resetKey} className={this.props.className}>
        {this.props.children}
      </div>
    );
  }
}
