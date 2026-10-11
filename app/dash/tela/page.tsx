import type { Metadata } from "next";
import Tela from "@/components/dash/Tela";

// A tela do OBS: sem login (a chave vai no link), sem menu, sem rodapé.
export const metadata: Metadata = {
  title: "Tela da live",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function PaginaTela({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const parametros = Object.fromEntries(Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? "" : v ?? ""]));
  return <Tela parametros={parametros} />;
}
