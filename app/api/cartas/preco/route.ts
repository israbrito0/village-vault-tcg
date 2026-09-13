import { NextResponse } from "next/server";
import { definirPrecoManual, lerCartas, salvarCarta, TEM_BANCO } from "@/lib/leilao-db";

// Recebe um preço que VOCÊ leu numa página aberta por você (a extensão manda ao
// clicar no botão). Vira o preço da casa para aquela carta.
export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

function autorizado(req: Request) {
  const enviado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!enviado) return false;
  // Vale tanto a chave do painel quanto a da extensão.
  return enviado === process.env.METRICAS_TOKEN || enviado === process.env.RANKING_TOKEN;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ erro: "chave inválida" }, { status: 401, headers: CORS });
  if (!TEM_BANCO) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 503, headers: CORS });

  const { cartaId, nome, centavos, fonte } = (await req.json().catch(() => ({}))) as {
    cartaId?: string;
    nome?: string;
    centavos?: number;
    fonte?: string;
  };

  const valor = Math.round(Number(centavos));
  if (!cartaId || !Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ erro: "Faltou a carta ou o valor." }, { status: 400, headers: CORS });
  }

  try {
    const conhecida = await lerCartas([cartaId]);
    if (!conhecida.length) {
      // Primeira vez que essa carta aparece: registra o mínimo para o preço ter onde morar.
      await salvarCarta({ id: cartaId, nome: nome ?? cartaId, fonte: fonte ?? "manual" });
    }
    await definirPrecoManual(cartaId, valor);
    return NextResponse.json({ ok: true, cartaId, centavos: valor }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ erro: String((e as Error).message) }, { status: 500, headers: CORS });
  }
}
