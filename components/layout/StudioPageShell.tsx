import type { ReactNode } from "react";

type StudioAccent = "cyan" | "emerald" | "amber" | "orange";

const surfaceBackgrounds: Record<StudioAccent, string> = {
  cyan: "bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]",
  emerald:
    "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.14),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]",
  amber:
    "bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.13),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]",
  orange:
    "bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.14),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]",
};

const accentText: Record<StudioAccent, string> = {
  cyan: "text-cyan-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  orange: "text-orange-300",
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function StudioSurface({
  accent = "cyan",
  children,
  className,
}: {
  accent?: StudioAccent;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={classes(
        "min-h-[calc(100vh-4rem)] px-3 py-4 text-slate-100 sm:px-5 xl:px-6 2xl:px-8",
        surfaceBackgrounds[accent],
      )}
    >
      <div
        className={classes("mx-auto w-full max-w-[1960px]", className)}
      >
        {children}
      </div>
    </main>
  );
}

export function StudioIdentityBand({
  accent = "cyan",
  eyebrow,
  title,
  description,
  side,
  className,
}: {
  accent?: StudioAccent;
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  side?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={classes(
        "mb-5 flex flex-col gap-3 rounded-[28px] border border-white/10 bg-slate-950/70 px-5 py-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur 2xl:flex-row 2xl:items-end 2xl:justify-between",
        className,
      )}
    >
      <div>
        <p
          className={classes(
            "text-xs font-semibold uppercase tracking-[0.28em]",
            accentText[accent],
          )}
        >
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      {side ? <div>{side}</div> : null}
    </header>
  );
}

export function StudioSegmentedChips({
  labels,
  className,
  wide = true,
}: {
  labels: ReactNode[];
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={classes(
        "grid gap-2 text-xs text-slate-300 sm:grid-cols-3",
        wide && "2xl:min-w-[520px]",
        className,
      )}
    >
      {labels.map((label, index) => (
        <span
          key={index}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center font-semibold"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
