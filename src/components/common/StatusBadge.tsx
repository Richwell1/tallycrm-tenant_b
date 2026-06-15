import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type StatusTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

const toneStyles: Record<StatusTone, string> = {
  neutral: "bg-muted text-text-secondary border-border",
  primary: "bg-primary-light text-primary border-primary/20",
  success: "bg-success-light text-success border-success/20",
  warning: "bg-warning-light text-warning border-warning/20",
  danger: "bg-danger-light text-danger border-danger/20",
  info: "bg-info-light text-info border-info/20",
  accent: "bg-accent-light text-accent-dark border-accent/30",
};

interface StatusBadgeProps {
  tone?: StatusTone;
  icon?: ReactNode;
  children: ReactNode;
  outline?: boolean;
  className?: string;
}

export function StatusBadge({
  tone = "neutral",
  icon,
  children,
  outline = false,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-xs font-semibold",
        outline ? "bg-transparent" : toneStyles[tone],
        outline && `border-current text-${tone}`,
        !outline && toneStyles[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
