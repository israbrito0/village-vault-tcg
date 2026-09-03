import { ShieldCheck, Lock, Award, Package, Headphones } from "lucide-react";

const BADGES = [
  { icon: ShieldCheck, label: "Produtos", sub: "100% originais" },
  { icon: Lock, label: "Compra", sub: "segura" },
  { icon: Award, label: "Qualidade", sub: "premium" },
  { icon: Package, label: "Envio", sub: "rápido" },
  { icon: Headphones, label: "Atendimento", sub: "especializado" },
];

export default function TrustBadges() {
  return (
    <div className="border-t border-card-border px-5 py-6">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-5 sm:grid-cols-5 sm:gap-4">
        {BADGES.map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex items-center gap-2.5 sm:justify-center">
            <Icon size={18} className="shrink-0 text-gold" strokeWidth={1.5} />
            <p className="text-[11px] leading-tight text-cream/80">
              {label}
              <br />
              <span className="text-muted">{sub}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
