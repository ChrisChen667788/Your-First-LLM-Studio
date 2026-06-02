import type { ReactNode } from "react";

type FineTuneFieldShellProps = {
  label: string;
  helper: string;
  children: ReactNode;
  className?: string;
};

export function FineTuneFieldShell({
  label,
  helper,
  children,
  className = "",
}: FineTuneFieldShellProps) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      <span className="mt-1 block text-[11px] leading-5 text-slate-500">
        {helper}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
