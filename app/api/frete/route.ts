import { NextResponse } from "next/server";
import { cotarFrete, limparCep, PACOTES, temMelhorEnvio, type TipoPacote } from "@/lib/frete";

// Cotação de frete para o CEP do cliente, saindo de Maceió.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { cep, pacote, valorCentavos } = (await req.json().catch(() => ({}))) as {
    cep?: string;
    pacote?: string;
    valorCentavos?: number;
  };

  if (!cep || limparCep(cep).length !== 8) {
    return NextResponse.json({ erro: "Digite um CEP com 8 números." }, { status: 400 });
  }
  if (!temMelhorEnvio()) {
    return NextResponse.json({ erro: "O cálculo de frete está sendo configurado." }, { status: 503 });
  }

  const tipo = (pacote && pacote in PACOTES ? pacote : "carta") as TipoPacote;
  try {
    const opcoes = await cotarFrete({
      cepDestino: cep,
      pacote: tipo,
      valorSeguroCentavos: Math.max(0, Math.round(Number(valorCentavos) || 0)),
    });
    return NextResponse.json({ opcoes });
  } catch (e) {
    return NextResponse.json({ erro: String((e as Error).message) }, { status: 502 });
  }
}
