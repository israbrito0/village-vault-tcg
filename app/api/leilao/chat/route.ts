import { NextResponse } from "next/server";
import { mandarMensagem, TEM_BANCO } from "@/lib/leilao-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!TEM_BANCO) {
    return NextResponse.json({ erro: "O chat ainda está em demonstração." }, { status: 503 });
  }

  const { leilaoId, participanteId, nome, texto } = (await req.json().catch(() => ({}))) as {
    leilaoId?: string;
    participanteId?: string;
    nome?: string;
    texto?: string;
  };

  if (!leilaoId || !participanteId || !nome || !texto?.trim()) {
    return NextResponse.json({ erro: "Mensagem vazia." }, { status: 400 });
  }

  try {
    await mandarMensagem(leilaoId, participanteId, nome, texto);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erro: "Não consegui enviar sua mensagem." }, { status: 500 });
  }
}
