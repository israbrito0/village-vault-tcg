import { NextResponse } from "next/server";
import { participanteDaRequisicao } from "@/lib/auth-servidor";
import { freteJaPagoNoLeilao, pagamentoDoComprador, prepararPagamento, TEM_BANCO } from "@/lib/leilao-db";

// "Pagar agora" do arremate. Com consultar: true, só diz se precisa de frete;
// sem isso, gera o link da InfinitePay com o frete escolhido.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!TEM_BANCO) return NextResponse.json({ erro: "O leilão ainda está em demonstração." }, { status: 503 });

  const pessoa = await participanteDaRequisicao(req);
  if (!pessoa) return NextResponse.json({ erro: "Entre na sua conta para pagar." }, { status: 401 });

  const { loteId, consultar, enderecoId, freteServicoId, leilaoId } = (await req.json().catch(() => ({}))) as {
    loteId?: string;
    consultar?: boolean;
    enderecoId?: string;
    freteServicoId?: number;
    leilaoId?: string;
  };
  if (!loteId) return NextResponse.json({ erro: "Faltou o lote." }, { status: 400 });

  if (consultar) {
    const pagamento = await pagamentoDoComprador(loteId, pessoa.id);
    if (!pagamento) return NextResponse.json({ erro: "Nenhuma cobrança sua neste lote." }, { status: 404 });
    const jaPagouFrete = leilaoId ? await freteJaPagoNoLeilao(leilaoId, pessoa.id) : false;
    return NextResponse.json({ ...pagamento, link: undefined, precisaFrete: !jaPagouFrete });
  }

  try {
    const r = await prepararPagamento({
      loteId,
      participanteId: pessoa.id,
      usuarioId: pessoa.usuarioId,
      enderecoId,
      freteServicoId,
    });
    if ("erro" in r) return NextResponse.json(r, { status: r.status ?? 400 });
    return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ erro: String((e as Error).message).slice(0, 200) }, { status: 502 });
  }
}
