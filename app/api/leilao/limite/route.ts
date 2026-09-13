import { NextResponse } from "next/server";
import { participanteDaRequisicao } from "@/lib/auth-servidor";
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

  const pessoa = await participanteDaRequisicao(req);
  if (!pessoa) return NextResponse.json({ erro: "Entre na sua conta para usar o automático." }, { status: 401 });

  const { loteId, centavos } = (await req.json().catch(() => ({}))) as { loteId?: string; centavos?: number };
  if (!loteId || !Number.isFinite(centavos)) {
    return NextResponse.json({ erro: "Faltou informação para guardar seu limite." }, { status: 400 });
  }

  try {
    const r = await definirLimite(loteId, pessoa.id, pessoa.nome, Math.round(centavos as number));
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
