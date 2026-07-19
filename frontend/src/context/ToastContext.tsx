"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../lib/utils";

export type ToastVariant = "error" | "success" | "info";

export interface ToastInput {
  title?: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface Toast extends Required<ToastInput> {
  id: number;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function iconForVariant(variant: ToastVariant) {
  if (variant === "success") return <CheckCircle2 className="size-5 shrink-0" />;
  if (variant === "info") return <Info className="size-5 shrink-0" />;
  return <AlertCircle className="size-5 shrink-0" />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const toast: Toast = {
      id: Date.now() + Math.random(),
      title: input.title || (input.variant === "success" ? "Success" : input.variant === "info" ? "Notice" : "Something went wrong"),
      message: input.message,
      variant: input.variant || "error",
      duration: input.duration ?? 5000,
    };
    setToasts((current) => [...current.slice(-3), toast]);
    if (toast.duration > 0) window.setTimeout(() => dismissToast(toast.id), toast.duration);
  }, [dismissToast]);

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const detail = (event as CustomEvent<ToastInput>).detail;
      if (detail?.message) showToast(detail);
    };
    window.addEventListener("novels-library:api-error", handleApiError);
    return () => window.removeEventListener("novels-library:api-error", handleApiError);
  }, [showToast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-3 sm:left-auto sm:w-[min(100%-2rem,24rem)]" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={cn(
              "pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-sm shadow-xl",
              toast.variant === "success" && "border-emerald-200 text-emerald-800",
              toast.variant === "info" && "border-sky-200 text-sky-800",
              toast.variant === "error" && "border-rose-200 text-rose-800",
            )}
          >
            {iconForVariant(toast.variant)}
            <div className="min-w-0 flex-1">
              <p className="font-bold">{toast.title}</p>
              <p className="mt-1 break-words text-xs opacity-90">{toast.message}</p>
            </div>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification" className="rounded-md p-1 opacity-70 hover:bg-black/5 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
