import { NextResponse } from "next/server";
import { definirLimite, TEM_BANCO } from "@/lib/leilao-db";

// Lance automático: a pessoa diz o máximo, o sistema disputa por ela.
export const dynamic = "force-dynamic";

const RECADOS: Record<string, string> = {
  "lote-fechado": "Esse lote já fechou.",
  "lote-inexistente": "Esse lote não existe mais.",
  "participante-bloqueado": "Seu acesso ao leilão está bloqueado.",
  "participante-desconhecido": "Entre no leilão de novo para dar lance.",
  "valor-baixo": "Seu limite precisa ser pelo menos o próximo lance.",
};

export async function POST(req: Request) {
  if (!TEM_BANCO) return NextResponse.json({ erro: "O leilão ainda está em demonstração." }, { status: 503 });

  const { loteId, participanteId, nome, centavos } = (await req.json().catch(() => ({}))) as {
    loteId?: string;
    participanteId?: string;
    nome?: string;
    centavos?: number;
  };

  if (!loteId || !participanteId || !nome || !Number.isFinite(centavos)) {
    return NextResponse.json({ erro: "Faltou informação para guardar seu limite." }, { status: 400 });
  }

  try {
    const r = await definirLimite(loteId, participanteId, nome, Math.round(centavos as number));
    if (!r.ok) {
      return NextResponse.json(
        { erro: RECADOS[r.erro ?? ""] ?? "Não consegui guardar seu limite.", motivo: r.erro, minimo: r.minimo },
        { status: 409 },
      );
    }
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ erro: "Não consegui guardar seu limite." }, { status: 500 });
  }
}
