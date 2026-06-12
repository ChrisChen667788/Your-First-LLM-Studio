"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_LOCALES, LOCALE_LABELS, useLocale } from "@/components/layout/LocaleProvider";

const links = [
  { href: "/agent", key: "agent" },
  { href: "/compare", key: "compare" },
  { href: "/fine-tune", key: "fineTune" },
  { href: "/models", key: "models" },
  { href: "/benchmarks", key: "benchmarks" },
  { href: "/retrieval", key: "retrieval" },
  { href: "/experiments", key: "experiments" },
  { href: "/admin", key: "dashboard" }
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppNav({ version }: { version?: string }) {
  const pathname = usePathname();
  const currentPath = pathname ?? "/";
  const { locale, setLocale, dictionary } = useLocale();
  const navLabels: Record<string, string> = {
    agent: dictionary.nav.agent,
    compare: locale.startsWith("en") ? "Compare" : "对比",
    fineTune: locale.startsWith("en") ? "Fine-tune" : "微调",
    models: locale.startsWith("en") ? "Models" : "模型",
    benchmarks: locale.startsWith("en") ? "Benchmarks" : "评测",
    retrieval: locale.startsWith("en") ? "Retrieval" : "检索",
    experiments: locale.startsWith("en") ? "Experiments" : "实验",
    dashboard: dictionary.nav.dashboard
  };

  return (
    <nav className="sticky top-0 z-30 w-full overflow-x-auto border-b border-slate-200/70 bg-white/92 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1960px] items-center justify-between gap-4 px-3 py-3 sm:px-5 xl:px-7 2xl:px-8">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-slate-100/90 p-1">
            {links.map((link) => {
              const active = isActive(currentPath, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-slate-950 text-white shadow-[0_6px_20px_rgba(15,23,42,0.16)]"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  {navLabels[link.key]}
                </Link>
              );
            })}
          </div>
          {version ? (
            <span className="hidden rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:inline-flex">
              v{version}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium tracking-[0.18em] text-slate-500">
            {dictionary.nav.language}
          </span>
          <div className="flex items-center gap-1 rounded-full bg-slate-100/90 p-1">
            {APP_LOCALES.map((option) => {
              const active = option === locale;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLocale(option)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-slate-950 text-white shadow-[0_4px_16px_rgba(15,23,42,0.14)]"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  {LOCALE_LABELS[option]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
