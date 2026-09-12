import { NextResponse } from "next/server";
import { entrar, TEM_BANCO } from "@/lib/leilao-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!TEM_BANCO) {
    return NextResponse.json({ erro: "O leilão ainda está em demonstração." }, { status: 503 });
  }
  const { nome, whatsapp } = (await req.json().catch(() => ({}))) as { nome?: string; whatsapp?: string };
  const numero = (whatsapp ?? "").replace(/\D/g, "");

  if (!nome?.trim() || nome.trim().length < 2) {
    return NextResponse.json({ erro: "Escreva seu nome." }, { status: 400 });
  }
  if (numero.length < 10 || numero.length > 13) {
    return NextResponse.json({ erro: "WhatsApp com DDD, ex.: 82 99999-0000." }, { status: 400 });
  }

  try {
    const pessoa = await entrar(nome, numero);
    if (pessoa.bloqueado) {
      return NextResponse.json({ erro: "Seu acesso ao leilão está bloqueado." }, { status: 403 });
    }
    return NextResponse.json({ id: pessoa.id, nome: pessoa.nome });
  } catch {
    return NextResponse.json({ erro: "Não consegui te cadastrar agora." }, { status: 500 });
  }
}
