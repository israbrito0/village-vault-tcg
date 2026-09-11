// Link para a live de vendas na Jamble, com a bolinha vermelha de "ao vivo".
export default function LiveLink({ href, className = "" }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex shrink-0 items-center gap-1.5 font-bold uppercase tracking-[0.14em] text-brand-red transition-colors hover:text-ink ${className}`}
    >
      <span aria-hidden className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-red" />
      </span>
      Compre em nossa live
    </a>
  );
}
