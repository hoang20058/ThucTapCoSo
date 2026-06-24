export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <p className="text-xs uppercase tracking-[0.2em] text-app-muted">{eyebrow}</p> : null}
        <h2 className="text-2xl font-bold">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm text-app-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
