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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "border border-cyan-100/20 bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_10px_30px_rgba(92,225,230,.12)] hover:bg-[var(--primary-strong)] hover:shadow-[0_14px_38px_rgba(92,225,230,.2)] active:translate-y-px",
        variant === "secondary" && "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary-strong)]",
        variant === "outline" && "border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--secondary)]",
        variant === "ghost" && "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
        variant === "danger" && "border border-rose-200/15 bg-rose-500/75 text-white hover:bg-rose-400/90",
        size === "sm" && "h-9 min-h-9 px-3 text-sm",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-13 px-6 text-base",
        className,
      )}
      {...props}
    />
  );
}
