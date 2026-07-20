import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; };

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return <button className={cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[.98]",
    variant === "primary" && "bg-[linear-gradient(135deg,var(--primary),#0aa6b3)] text-white shadow-[0_12px_26px_rgba(7,139,152,.22)] hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(7,139,152,.28)]",
    variant === "secondary" && "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary-strong)]",
    variant === "outline" && "border border-[var(--border)] bg-white text-[var(--foreground)] shadow-sm hover:border-cyan-300 hover:bg-cyan-50/50",
    variant === "ghost" && "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
    variant === "danger" && "bg-[var(--danger)] text-white hover:brightness-95",
    size === "sm" && "h-9 px-3 text-sm", size === "md" && "h-11 px-5 text-sm", size === "lg" && "h-13 px-6 text-base", className,
  )} {...props} />;
}
