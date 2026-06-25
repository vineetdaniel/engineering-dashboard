"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-6 text-red-400">
            <h2 className="text-xl font-bold">Dashboard Error</h2>
            <pre className="mt-2 text-sm whitespace-pre-wrap">
              {this.state.error?.message}
            </pre>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
