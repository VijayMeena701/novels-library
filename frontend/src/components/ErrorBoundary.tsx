"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || "Unexpected component error." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Component error${this.props.name ? ` in ${this.props.name}` : ""}:`, error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="mx-auto my-8 w-full max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950 shadow-sm" role="alert">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">{this.props.name || "Component"} unavailable</p>
        <h2 className="mt-2 text-xl font-black">This section could not be displayed.</h2>
        <p className="mt-2 break-words text-sm text-rose-800">{this.state.message}</p>
        <button type="button" onClick={this.reset} className="mt-5 rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800">
          Try again
        </button>
      </section>
    );
  }
}
