import { NextResponse } from "next/server";
import { participanteDaRequisicao } from "@/lib/auth-servidor";
import { TEM_BANCO } from "@/lib/leilao-db";

// Entrar na sala: exige estar logado na conta do site. Devolve quem é a
// pessoa como participante do leilão.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!TEM_BANCO) return NextResponse.json({ erro: "O leilão ainda está em demonstração." }, { status: 503 });

  const pessoa = await participanteDaRequisicao(req);
  if (!pessoa) return NextResponse.json({ erro: "Entre na sua conta para participar." }, { status: 401 });
  if (pessoa.bloqueado) return NextResponse.json({ erro: "Seu acesso ao leilão está bloqueado." }, { status: 403 });

  return NextResponse.json({ id: pessoa.id, nome: pessoa.nome, temWhatsapp: Boolean(pessoa.whatsapp) });
}
