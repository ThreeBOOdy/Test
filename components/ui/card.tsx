import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "receiver" | "flat" | "danger" }) {
  return <div className={cn("rounded-3xl border", variant === "default" && "radio-card border-[var(--border)] bg-[linear-gradient(145deg,var(--surface-elevated),var(--surface))] shadow-[var(--shadow-card)]", variant === "receiver" && "receiver-panel instrument-grid", variant === "flat" && "border-[var(--border)] bg-[var(--surface-soft)]", variant === "danger" && "border-rose-300/25 bg-[linear-gradient(145deg,rgba(73,23,32,.62),rgba(20,10,15,.92))]", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("flex flex-col gap-2 p-5 pb-0 sm:p-6 sm:pb-0", className)} {...props} />; }
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h3 className={cn("text-lg font-bold tracking-[-0.02em] text-[var(--foreground)]", className)} {...props} />; }
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) { return <p className={cn("text-sm leading-6 text-[var(--muted-foreground)]", className)} {...props} />; }
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("p-5 sm:p-6", className)} {...props} />; }
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("flex items-center gap-3 p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />; }
