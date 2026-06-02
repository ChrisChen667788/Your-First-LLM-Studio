import type { ReactNode } from "react";

type FineTuneSectionCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FineTuneSectionCard({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = "",
}: FineTuneSectionCardProps) {
  return (
    <section
      className={`rounded-[2rem] border border-white/10 bg-slate-950/45 p-5 shadow-[0_24px_80px_rgba(8,13,28,0.28)] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
