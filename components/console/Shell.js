"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import { Icon } from "@/components/Icons";
import { NAV, findRoute } from "@/lib/nav";
import CrisisTwinAssistant from "@/components/CrisisTwinAssistant";

function Rail({ pathname, onNavigate }) {
  return (
    <div className="flex h-full flex-col bg-ink text-ice">
      <div className="px-5 pb-4 pt-5 text-white">
        <Logo />
      </div>
      <nav aria-label="Console" className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.group} className="mt-5 first:mt-2">
            <div className="px-3 pb-1.5 text-[0.82rem] text-ice/55">{g.group}</div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.95rem] transition-colors ${
                        active ? "bg-white/10 text-white" : "text-ice/80 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-ember transition-opacity ${active ? "opacity-100" : "opacity-0"}`} />
                      <Icon name={it.icon} size={18} className={active ? "text-white" : "text-ice/70"} />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-[0.85rem] leading-snug text-ice/70">
        Simulation only. Nothing here places a real trade or gives financial advice.
        <Link href="/" onClick={onNavigate} className="mt-3 flex items-center gap-1.5 font-medium text-white hover:text-ice">
          Back to site
        </Link>
      </div>
    </div>
  );
}

export default function Shell({ children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const route = findRoute(pathname);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh lg:block">
        <Rail pathname={pathname} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <div className="relative h-full w-[280px] max-w-[85vw] shadow-2xl">
            <Rail pathname={pathname} onNavigate={() => setOpen(false)} />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-4 rounded-full p-2 text-ice hover:bg-white/10">
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-mist/85 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" className="rounded-full border border-line p-2 lg:hidden">
              <Icon name="menu" size={18} />
            </button>
            <div className="min-w-0 truncate text-[0.95rem]">
              <span className="text-slate">{route?.group ?? "Console"}</span>
              <span className="mx-2 text-line">/</span>
              <span className="font-semibold">{route?.label ?? "Overview"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="hidden items-center gap-2 rounded-full border border-line bg-bone px-3 py-1.5 text-[0.85rem] sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-mint" />
              Simulation mode
            </span>
            <span className="hidden rounded-full border border-line bg-bone px-3 py-1.5 text-[0.85rem] md:inline-flex">Sample portfolio</span>
            <Link href="/war-room" className="inline-flex items-center gap-2 rounded-full bg-ultra px-4 py-2 text-[0.88rem] font-semibold text-white transition-colors hover:bg-ultra-deep">
              <Icon name="mic" size={16} />
              Talk
            </Link>
          </div>
        </header>
        <main className="px-4 pb-20 pt-8 md:px-8">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>
      </div>
      <CrisisTwinAssistant />
    </div>
  );
}
