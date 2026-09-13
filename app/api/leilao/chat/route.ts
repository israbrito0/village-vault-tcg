import { NextResponse } from "next/server";
import { participanteDaRequisicao } from "@/lib/auth-servidor";
import { mandarMensagem, TEM_BANCO } from "@/lib/leilao-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!TEM_BANCO) return NextResponse.json({ erro: "O chat ainda está em demonstração." }, { status: 503 });

  const pessoa = await participanteDaRequisicao(req);
  if (!pessoa) return NextResponse.json({ erro: "Entre na sua conta para falar no chat." }, { status: 401 });
  if (pessoa.bloqueado) return NextResponse.json({ erro: "Seu acesso ao leilão está bloqueado." }, { status: 403 });

  const { leilaoId, texto } = (await req.json().catch(() => ({}))) as { leilaoId?: string; texto?: string };
  if (!leilaoId || !texto?.trim()) return NextResponse.json({ erro: "Mensagem vazia." }, { status: 400 });

  try {
    await mandarMensagem(leilaoId, pessoa.id, pessoa.nome, texto);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erro: "Não consegui enviar sua mensagem." }, { status: 500 });
  }
}
