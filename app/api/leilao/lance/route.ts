import { NextResponse } from "next/server";
import { participanteDaRequisicao } from "@/lib/auth-servidor";
import { darLance, TEM_BANCO } from "@/lib/leilao-db";

export const dynamic = "force-dynamic";

// Mensagens amigáveis para os motivos de recusa que vêm da função do banco.
const RECADOS: Record<string, string> = {
  "lote-fechado": "Esse lote já fechou.",
  "lote-inexistente": "Esse lote não existe mais.",
  "participante-bloqueado": "Seu acesso ao leilão está bloqueado.",
  "participante-desconhecido": "Entre no leilão de novo para dar lance.",
  "ja-esta-ganhando": "Você já está ganhando esse lote.",
  "valor-baixo": "O lance ficou abaixo do mínimo.",
  "valor-alto-demais": "Esse valor é alto demais de uma vez. Confira antes.",
  "confirmar-valor-alto": "Esse lance é bem acima do mínimo. Confirme que é isso mesmo.",
};

export async function POST(req: Request) {
  if (!TEM_BANCO) return NextResponse.json({ erro: "O leilão ainda está em demonstração." }, { status: 503 });

  // Quem dá o lance é quem está logado — nunca o que a tela disser.
  const pessoa = await participanteDaRequisicao(req);
  if (!pessoa) return NextResponse.json({ erro: "Entre na sua conta para dar lance." }, { status: 401 });

  const { loteId, centavos, confirmado } = (await req.json().catch(() => ({}))) as {
    loteId?: string;
    centavos?: number;
    confirmado?: boolean;
  };
  if (!loteId || !Number.isFinite(centavos)) {
    return NextResponse.json({ erro: "Faltou informação para registrar o lance." }, { status: 400 });
  }

  try {
    const r = await darLance(loteId, pessoa.id, pessoa.nome, Math.round(centavos as number), Boolean(confirmado));
    if (!r.ok) {
      return NextResponse.json(
        { erro: RECADOS[r.erro ?? ""] ?? "Lance recusado.", motivo: r.erro, minimo: r.minimo },
        { status: 409 },
      );
    }
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ erro: "Não consegui registrar seu lance." }, { status: 500 });
  }
}
