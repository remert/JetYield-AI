import clsx from "clsx";
import { AlertOctagon, AlertTriangle, Info } from "lucide-react";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  right,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
          {icon && <span className="text-accent">{icon}</span>}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "good" | "warning" | "critical" | "amber";
  className?: string;
}) {
  const tones = {
    neutral: "border-border-strong text-text-2 bg-surface-2",
    accent: "border-accent/30 text-accent bg-accent/10",
    good: "border-good/40 text-[#4ad44a] bg-good/10",
    warning: "border-warning/40 text-warning bg-warning/10",
    critical: "border-critical/50 text-[#ff8080] bg-critical/10",
    amber: "border-amber/40 text-amber bg-amber/10",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: "critical" | "warning" | "info" }) {
  if (severity === "critical")
    return (
      <Badge tone="critical">
        <AlertOctagon size={12} aria-hidden /> Critical
      </Badge>
    );
  if (severity === "warning")
    return (
      <Badge tone="warning">
        <AlertTriangle size={12} aria-hidden /> Due soon
      </Badge>
    );
  return (
    <Badge>
      <Info size={12} aria-hidden /> Planned
    </Badge>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse-soft rounded-md bg-surface-3", className)} />;
}

export function Button({
  variant = "primary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const variants = {
    primary: "bg-accent text-[#04121f] hover:bg-[#7cc6ff] font-semibold",
    secondary: "border border-border-strong bg-surface-2 text-text hover:bg-surface-3",
    ghost: "text-text-2 hover:text-text hover:bg-surface-2",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
