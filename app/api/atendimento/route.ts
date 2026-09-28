import { NextResponse } from "next/server";
import { responder } from "@/lib/atendimento/responder";
import { SUGESTOES_INICIAIS } from "@/lib/atendimento/conhecimento";

// Atendimento da loja. Responde na hora, sem IA e sem chamada externa: a
// resposta sai da base em lib/atendimento/conhecimento.ts. Por isso pode
// rodar na borda e nunca inventa preço nem prazo.
export const runtime = "edge";

const LIMITE_CARACTERES = 500;

export async function GET() {
  // Serve para o widget abrir já com as sugestões, sem precisar perguntar nada.
  return NextResponse.json({ sugestoes: SUGESTOES_INICIAIS });
}

export async function POST(req: Request) {
  let corpo: { pergunta?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "json inválido" }, { status: 400 });
  }

  const pergunta = typeof corpo.pergunta === "string" ? corpo.pergunta.slice(0, LIMITE_CARACTERES) : "";
  const r = responder(pergunta);

  return NextResponse.json(
    { id: r.id, texto: r.texto, acao: r.acao ?? null, sugestoes: r.sugestoes, entendeu: r.entendeu },
    { headers: { "cache-control": "no-store" } },
  );
}
