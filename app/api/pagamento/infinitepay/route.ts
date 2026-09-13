import { NextResponse } from "next/server";
import { marcarCobrancaPaga, registrarAvisoPagamento, TEM_BANCO } from "@/lib/leilao-db";

// Aviso de pagamento da InfinitePay. Ela chama este endereço quando o cliente
// paga; respondendo 200 a gente confirma que recebeu, e 400 faz ela tentar de
// novo mais tarde.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return NextResponse.json({ erro: "json inválido" }, { status: 400 });

  // O nosso identificador vai no order_nsu quando criamos o link.
  const nsu = String(corpo.order_nsu ?? corpo.orderNsu ?? corpo.nsu ?? "").trim();
  const pago =
    corpo.paid === true ||
    ["paid", "approved", "succeeded", "aprovado", "pago"].includes(String(corpo.status ?? "").toLowerCase());

  // Guarda o aviso cru: se algo não bater, dá para conferir depois o que veio.
  if (TEM_BANCO) await registrarAvisoPagamento(nsu, pago, corpo).catch(() => {});

  if (!nsu) return NextResponse.json({ erro: "sem order_nsu" }, { status: 400 });
  if (!pago) return NextResponse.json({ ok: true, ignorado: "pagamento não confirmado" });

  try {
    const achou = await marcarCobrancaPaga(nsu);
    return NextResponse.json({ ok: true, cobranca: achou ? "paga" : "não encontrada" });
  } catch {
    // 400 faz a InfinitePay tentar de novo, então nada se perde.
    return NextResponse.json({ erro: "falha ao registrar" }, { status: 400 });
  }
}
