import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  homeHref?: string;
  compact?: boolean;
};

export function ErrorState({
  title = "Could not load this page",
  message = "Something interrupted this request. Please refresh the page or return to your workspace.",
  actionLabel = "Try again",
  onAction,
  homeHref = "/",
  compact = false,
}: ErrorStateProps) {
  return (
    <div className={cn("flex items-center justify-center px-4", compact ? "min-h-64 py-4" : "min-h-[70vh] py-10")}>
      <section className="premium-panel w-full max-w-xl overflow-hidden rounded-xl border border-[#d7e3e7] bg-surface text-center shadow-xl shadow-slate-950/10">
        <div className={cn("border-b border-border bg-[#f8fbfc] px-6", compact ? "py-5" : "py-6")}>
          <div className={cn("mx-auto flex items-center justify-center rounded-full bg-[#e4f3f5] text-primary", compact ? "h-11 w-11" : "h-14 w-14")}>
            <AlertTriangle className={compact ? "h-5 w-5" : "h-7 w-7"} />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Maintolio</p>
          <h1 className={cn("mt-2 font-semibold tracking-tight", compact ? "text-lg" : "text-2xl")}>{title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{message}</p>
        </div>
        <div className="flex flex-col justify-center gap-3 px-6 py-5 sm:flex-row">
          {onAction ? (
            <Button type="button" onClick={onAction}>
              <RefreshCw className="h-4 w-4" />
              {actionLabel}
            </Button>
          ) : null}
          <Link
            href={homeHref}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold shadow-sm transition hover:border-[#b8c8ce] hover:bg-[#f7fafb]"
          >
            <Home className="h-4 w-4" />
            Go to workspace
          </Link>
        </div>
      </section>
    </div>
  );
}

export function NotFoundState() {
  return (
    <ErrorState
      title="Page not found"
      message="The page may have moved, or the link may no longer be available in this workspace."
      actionLabel="Refresh"
    />
  );
}
