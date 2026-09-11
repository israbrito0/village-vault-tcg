import { ShieldCheck, Lock, Award, Package, Headphones } from "lucide-react";

const BADGES = [
  { icon: ShieldCheck, label: "Produtos", sub: "100% originais", color: "text-brand-green" },
  { icon: Lock, label: "Compra", sub: "segura", color: "text-brand-blue" },
  { icon: Award, label: "Qualidade", sub: "premium", color: "text-brand-red" },
  { icon: Package, label: "Envio", sub: "rápido", color: "text-brand-yellow-text" },
  { icon: Headphones, label: "Atendimento", sub: "especializado", color: "text-brand-green" },
];

export default function TrustBadges() {
  return (
    <div className="border-t border-card-border bg-surface px-5 py-6">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-5 sm:grid-cols-5 sm:gap-4">
        {BADGES.map(({ icon: Icon, label, sub, color }) => (
          <div key={label} className="flex items-center gap-2.5 sm:justify-center">
            <Icon size={20} className={`shrink-0 ${color}`} strokeWidth={1.75} />
            <p className="text-[11px] font-bold uppercase leading-tight tracking-wide text-ink">
              {label}
              <br />
              <span className="font-normal normal-case tracking-normal text-muted">{sub}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
