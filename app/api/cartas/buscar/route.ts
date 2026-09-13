import { NextResponse } from "next/server";
import { buscarCarta, cotacoes } from "@/lib/cartas";
import { lerCartas, salvarCarta, TEM_BANCO } from "@/lib/leilao-db";

// Busca da carta pelo código, para o cadastro do lote. Só o painel usa.
export const dynamic = "force-dynamic";

function autorizado(req: Request) {
  const esperado = process.env.METRICAS_TOKEN;
  const enviado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return Boolean(esperado) && enviado === esperado;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ erro: "chave inválida" }, { status: 401 });

  const { codigo, fator } = (await req.json().catch(() => ({}))) as { codigo?: string; fator?: number };
  if (!codigo?.trim()) return NextResponse.json({ erro: "Escreva o código ou o nome da carta." }, { status: 400 });

  try {
    const multiplicador = Number.isFinite(fator) && (fator as number) > 0 ? (fator as number) : 1;
    const achadas = await buscarCarta(codigo, multiplicador);
    const cambio = await cotacoes();

    // Preço que você já definiu na mão vence o preço internacional.
    let salvas: Record<string, { preco_manual_centavos: number | null }> = {};
    if (TEM_BANCO && achadas.length) {
      const base = await lerCartas(achadas.map((c) => c.id));
      salvas = Object.fromEntries(base.map((c: any) => [c.id, c]));
      for (const carta of achadas) {
        await salvarCarta({
          id: carta.id,
          nome: carta.nome,
          colecao: carta.colecao,
          colecaoId: carta.colecaoId,
          numero: carta.numero,
          totalOficial: carta.totalOficial,
          raridade: carta.raridade,
          imagem: carta.imagem,
          precoRefCentavos: carta.precos.referenciaBrl ? Math.round(carta.precos.referenciaBrl * 100) : undefined,
          fonte: carta.precos.fonte,
        }).catch(() => {});
      }
    }

    const comManual = achadas.map((c) => ({
      ...c,
      precoManualCentavos: salvas[c.id]?.preco_manual_centavos ?? null,
    }));

    return NextResponse.json({ cartas: comManual, cambio });
  } catch (e) {
    return NextResponse.json({ erro: String((e as Error).message) }, { status: 500 });
  }
}
