"use client";

import { usePathname } from "next/navigation";

// O rodapé e o botão do WhatsApp são da loja: no Dash (painel da live e tela
// do OBS) eles atrapalham, então somem lá.
export default function SoForaDoDash({ children }: { children: React.ReactNode }) {
  const caminho = usePathname() ?? "";
  if (caminho === "/dash" || caminho.startsWith("/dash/")) return null;
  return <>{children}</>;
}
