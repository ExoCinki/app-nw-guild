"use client";

import { ReactNode } from "react";

interface LoadingButtonProps {
  isLoading?: boolean;
  loadingText?: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  title?: string;
  "aria-label"?: string;
}

export function LoadingButton({
  isLoading = false,
  loadingText = "Loading...",
  children,
  className = "",
  disabled = false,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`${className} disabled:opacity-50 transition-all inline-flex items-center gap-2 justify-center`}
    >
      {isLoading ? (
        <>
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"
            aria-hidden="true"
          />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
