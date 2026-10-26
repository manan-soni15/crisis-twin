const P = {
  dashboard: <path d="M4 19V11M10 19V5M16 19v-6M3 19.5h18" />,
  holdings: <path d="M4 7h16M4 12h16M4 17h9" />,
  twin: (<><circle cx="9" cy="12" r="5.5" /><circle cx="15" cy="12" r="5.5" /></>),
  map: (<><circle cx="5" cy="12" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 11.2l10-4.4M7 12.8l10 4.4" /></>),
  debate: (<><path d="M3.5 5.5h10v7h-5l-3 2.5v-2.5h-2z" /><path d="M16 9.5h4.5v7H19v2.5l-3-2.5h-4.5" /></>),
  mic: (<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" /></>),
  drill: (<><circle cx="12" cy="13.5" r="7" /><path d="M12 13.5V9.5M9.5 3h5" /></>),
  replay: <path d="M11 6.5L4 12l7 5.5zM20 6.5L13 12l7 5.5z" />,
  report: (<><path d="M6 3h9l4 4v14H6z" /><path d="M14.5 3v4.5H19M9 13h7M9 17h5" /></>),
  audit: (<><path d="M4 6h16M4 12h9M4 18h6" /><path d="M14.5 17.5l2 2 4-4" /></>),
  why: (<><path d="M4 4v16h16" /><path d="M8 15v-4h3v4M13.5 17V8h3v9" /></>),
  profile: (<><path d="M4 17a8 8 0 0116 0" /><path d="M12 17l4-5.5" /></>),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  link: <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1" />,
  send: <path d="M4 12l16-8-6 16-3-6.5z" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

export function Icon({ name, size = 20, className = "", strokeWidth = 1.6 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}
