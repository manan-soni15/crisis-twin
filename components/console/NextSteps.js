import Link from "next/link";
import { Icon } from "@/components/Icons";
import { neighbours } from "@/lib/nav";

export default function NextSteps({ href }) {
  const { prev, next } = neighbours(href);
  return (
    <nav aria-label="Continue" className="mt-14 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
      {prev ? (
        <Link href={prev.href} className="group flex items-center gap-4 rounded-[10px] border border-line px-5 py-4 transition-colors hover:bg-white">
          <Icon name="arrow" size={18} className="rotate-180 text-slate transition-transform group-hover:-translate-x-0.5" />
          <span>
            <span className="block text-sm text-slate">Previous</span>
            <span className="head text-lg">{prev.label}</span>
          </span>
        </Link>
      ) : <span />}
      {!next && (
        <Link href="/dashboard" className="group flex items-center justify-between gap-4 rounded-[10px] bg-ultra px-5 py-4 text-white transition-colors hover:bg-ultra-deep sm:col-start-2">
          <span>
            <span className="block text-sm text-ice">Start over</span>
            <span className="head text-lg">Back to overview</span>
          </span>
          <Icon name="arrow" size={18} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
      {next && (
        <Link href={next.href} className="group flex items-center justify-between gap-4 rounded-[10px] bg-ultra px-5 py-4 text-white transition-colors hover:bg-ultra-deep sm:col-start-2">
          <span>
            <span className="block text-sm text-ice">Next: {next.group.toLowerCase()}</span>
            <span className="head text-lg">{next.label}</span>
          </span>
          <Icon name="arrow" size={18} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </nav>
  );
}
