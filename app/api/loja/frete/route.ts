import { NextResponse } from "next/server";
import { limparCep, temMelhorEnvio } from "@/lib/frete";
import { conferirCarrinho, cotarFreteCarrinho, type ItemCarrinho } from "@/lib/loja";

// Frete do carrinho inteiro, saindo de Maceió.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { cep, itens } = (await req.json().catch(() => ({}))) as { cep?: string; itens?: ItemCarrinho[] };
  if (!cep || limparCep(cep).length !== 8) return NextResponse.json({ erro: "Digite um CEP com 8 números." }, { status: 400 });
  if (!Array.isArray(itens) || !itens.length) return NextResponse.json({ erro: "Carrinho vazio." }, { status: 400 });

  const { precisaEnvio } = conferirCarrinho(itens);
  if (!precisaEnvio) return NextResponse.json({ opcoes: [], semEnvio: true });
  if (!temMelhorEnvio()) return NextResponse.json({ erro: "O cálculo de frete está sendo configurado." }, { status: 503 });

  try {
    return NextResponse.json({ opcoes: await cotarFreteCarrinho(cep, itens) });
  } catch (e) {
    return NextResponse.json({ erro: String((e as Error).message) }, { status: 502 });
  }
}
