import Link from "next/link";
import Logo from "@/components/Logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#debate", label: "Debate" },
  { href: "#voice", label: "Voice" },
  { href: "#proof", label: "Proof" },
  { href: "#how", label: "How it works" },
];

export default function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-[880px] items-center justify-between gap-2 rounded-full bg-ink/90 py-1.5 pl-5 pr-1.5 text-white shadow-[0_8px_30px_rgba(14,20,51,0.25)] backdrop-blur-md">
        <Logo size={24} />
        <nav aria-label="Site" className="hidden items-center gap-0.5 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-[0.92rem] text-ice transition-colors hover:bg-white/10 hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
        <Link href="/dashboard" className="rounded-full bg-white px-4 py-2 text-[0.92rem] font-semibold text-ink transition-colors hover:bg-ice">
          Open console
        </Link>
      </div>
    </header>
  );
}
