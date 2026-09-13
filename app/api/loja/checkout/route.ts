import { NextResponse } from "next/server";
import { usuarioDaRequisicao } from "@/lib/auth-servidor";
import { fecharPedido, type ItemCarrinho } from "@/lib/loja";

// Fecha o pedido do carrinho: exige conta, confere tudo no servidor e devolve
// o link de pagamento da InfinitePay.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const usuario = await usuarioDaRequisicao(req);
  if (!usuario) return NextResponse.json({ erro: "Entre na sua conta para finalizar a compra." }, { status: 401 });

  const { itens, enderecoId, freteServicoId } = (await req.json().catch(() => ({}))) as {
    itens?: ItemCarrinho[];
    enderecoId?: string;
    freteServicoId?: number;
  };
  if (!Array.isArray(itens) || !itens.length) return NextResponse.json({ erro: "Seu carrinho está vazio." }, { status: 400 });

  try {
    const r = await fecharPedido({ usuarioId: usuario.id, itens, enderecoId, freteServicoId });
    if ("erro" in r) return NextResponse.json(r, { status: r.status ?? 400 });
    return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ erro: String((e as Error).message).slice(0, 200) }, { status: 502 });
  }
}
