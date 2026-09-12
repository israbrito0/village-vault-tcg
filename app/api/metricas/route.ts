import { NextResponse } from "next/server";
import { calcularMetricas } from "@/lib/metricas";
import { lerEstado } from "@/lib/ranking";

// Aba privada: só responde com a chave de métricas no cabeçalho.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const esperado = process.env.METRICAS_TOKEN;
  const enviado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!esperado || !enviado || enviado !== esperado) {
    return NextResponse.json({ erro: "chave inválida" }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const estado = await lerEstado();
  return NextResponse.json(calcularMetricas(estado), { headers: { "cache-control": "no-store" } });
}
