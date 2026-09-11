// Título das páginas internas: centralizado, com subtítulo em versalete.
export default function PageTitle({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="text-center">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
      {subtitle && (
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{subtitle}</p>
      )}
    </div>
  );
}
