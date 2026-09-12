import { NextResponse } from "next/server";
import { lerEstado, topDe } from "@/lib/ranking";

// Sempre lido na hora: a página consulta de poucos em poucos segundos.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const estado = await lerEstado();
  return NextResponse.json(
    {
      live: {
        id: estado.live.id,
        titulo: estado.live.titulo ?? null,
        inicio: estado.live.inicio,
        atualizado: estado.live.atualizado,
        top: topDe(estado.live.compradores),
      },
      acumulado: {
        desde: estado.acumulado.desde,
        atualizado: estado.acumulado.atualizado,
        top: topDe(estado.acumulado.compradores),
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
