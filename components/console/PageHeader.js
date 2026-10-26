export default function PageHeader({ title, description, actions, children }) {
  return (
    <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-[62ch]">
        <h1 className="display text-[clamp(2.4rem,5vw,3.6rem)]">{title}</h1>
        {description && <p className="mt-3 text-[1.05rem] leading-relaxed text-slate">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
