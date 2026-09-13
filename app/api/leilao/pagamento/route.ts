import { NextResponse } from "next/server";
import { pagamentoDoComprador, TEM_BANCO } from "@/lib/leilao-db";

// O botão "Pagar agora": devolve o link só para quem arrematou o lote.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!TEM_BANCO) return NextResponse.json({ erro: "O leilão ainda está em demonstração." }, { status: 503 });

  const { loteId, participanteId } = (await req.json().catch(() => ({}))) as {
    loteId?: string;
    participanteId?: string;
  };
  if (!loteId || !participanteId) return NextResponse.json({ erro: "Faltou o lote." }, { status: 400 });

  const pagamento = await pagamentoDoComprador(loteId, participanteId);
  if (!pagamento) return NextResponse.json({ erro: "Nenhuma cobrança sua neste lote." }, { status: 404 });
  return NextResponse.json(pagamento, { headers: { "cache-control": "no-store" } });
}
