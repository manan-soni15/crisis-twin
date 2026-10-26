// Single source of truth for every console route.
// Add a page here and it appears in the rail, breadcrumbs and "next step" links.
export const NAV = [
  {
    group: "Portfolio",
    items: [
      { href: "/dashboard", label: "Overview", icon: "dashboard", blurb: "Your portfolio and its latest stress test." },
      { href: "/holdings", label: "Holdings", icon: "holdings", blurb: "What you own and how to paper trade it." },
    ],
  },
  {
    group: "Simulate",
    items: [
      { href: "/simulator", label: "Crisis Twin", icon: "twin", blurb: "Describe a crisis and see what it does." },
      { href: "/propagation", label: "Propagation map", icon: "map", blurb: "Follow a shock from cause to holding." },
      { href: "/debate", label: "Debate room", icon: "debate", blurb: "Bull, Bear and Auditor argue the response." },
    ],
  },
  {
    group: "Speak",
    items: [
      { href: "/war-room", label: "Voice war room", icon: "mic", blurb: "Run everything by talking." },
      { href: "/drill", label: "Crisis drill", icon: "drill", blurb: "Decide under a ticking clock." },
    ],
  },
  {
    group: "Prove",
    items: [
      { href: "/replay", label: "Regret replay", icon: "replay", blurb: "Re-run real crashes with and without Crisis Twin." },
      { href: "/report", label: "Report card", icon: "report", blurb: "A one-page result you can share." },
      { href: "/audit", label: "Audit trail", icon: "audit", blurb: "Every run, every number, every reason." },
    ],
  },
  {
    group: "Understand",
    items: [
      { href: "/why", label: "Why it moved", icon: "why", blurb: "Break a day's move into its causes." },
      { href: "/profile", label: "Risk profile", icon: "profile", blurb: "How much loss you can actually stomach." },
    ],
  },
];

export const FLAT = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

export function findRoute(pathname) {
  return FLAT.find((r) => pathname === r.href || pathname.startsWith(r.href + "/"));
}

export function neighbours(href) {
  const i = FLAT.findIndex((r) => r.href === href);
  return { prev: i > 0 ? FLAT[i - 1] : null, next: i >= 0 && i < FLAT.length - 1 ? FLAT[i + 1] : null };
}
