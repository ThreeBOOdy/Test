import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-[var(--primary)] text-white shadow-[0_10px_24px_rgba(17,94,89,.18)] hover:bg-[var(--primary-strong)]",
        variant === "secondary" && "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary-strong)]",
        variant === "outline" && "border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--muted)]",
        variant === "ghost" && "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        variant === "danger" && "bg-[var(--danger)] text-white hover:brightness-95",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-13 px-6 text-base",
        className,
      )}
      {...props}
    />
  );
}
