import { NextResponse } from "next/server";
import { lerPagamentosDoLeilao, TEM_BANCO } from "@/lib/leilao-db";

// Painel: situação do pagamento de cada lote arrematado. A cobrança em si
// nasce sozinha quando o lote fecha; aqui o leiloeiro só acompanha e tem o
// link e o WhatsApp à mão para cobrar quem estiver enrolando.
export const dynamic = "force-dynamic";

function autorizado(req: Request) {
  const esperado = process.env.METRICAS_TOKEN;
  const enviado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return Boolean(esperado) && enviado === esperado;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ erro: "chave inválida" }, { status: 401 });
  if (!TEM_BANCO) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 503 });

  const { leilaoId } = (await req.json().catch(() => ({}))) as { leilaoId?: string };
  if (!leilaoId) return NextResponse.json({ erro: "Falta o leilão." }, { status: 400 });

  return NextResponse.json({ ok: true, cobrancas: await lerPagamentosDoLeilao(leilaoId) });
}
