import { NextResponse } from "next/server";
import {
  caixasDoLeilao,
  criarCobranca,
  guardarLinkCobranca,
  lerCobrancas,
  TEM_BANCO,
} from "@/lib/leilao-db";
import { criarLinkPagamento, temInfinitePay } from "@/lib/infinitepay";
import { SITE_URL } from "@/lib/site";

// Fecha o leilão em cobranças: uma por comprador, com todos os lotes dele.
// Um pagamento, um frete, e a baixa acontece sozinha pelo webhook.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const caixas = await caixasDoLeilao(leilaoId);
  if (!caixas.length) return NextResponse.json({ ok: true, cobrancas: [], aviso: "Nada arrematado." });

  const jaFeitas = await lerCobrancas(leilaoId);
  const resultado: {
    nome: string;
    whatsapp: string;
    centavos: number;
    lotes: string[];
    link: string | null;
    estado: string;
    erro?: string;
  }[] = [];

  for (const caixa of caixas) {
    const existente = jaFeitas.find((c) => c.participante_id === caixa.participanteId);
    // Cobrança já paga não se mexe.
    if (existente?.estado === "paga") {
      resultado.push({
        nome: caixa.nome,
        whatsapp: caixa.whatsapp,
        centavos: caixa.centavos,
        lotes: caixa.lotes,
        link: existente.link,
        estado: "paga",
      });
      continue;
    }

    const cobrancaId = existente?.id ?? (await criarCobranca(leilaoId, caixa.participanteId, caixa.centavos));
    let link = existente?.link ?? null;

    if (!link && temInfinitePay()) {
      try {
        link = await criarLinkPagamento({
          nsu: cobrancaId,
          // Cada lote entra como um item, com o valor que ele arrematou: o
          // cliente vê exatamente o que está pagando.
          itens: caixa.lotes.map((l) => ({ nome: l.titulo, centavos: l.centavos })),
          redirecionar: `${SITE_URL}/leiloes`,
          webhook: `${SITE_URL}/api/pagamento/infinitepay`,
        });
        await guardarLinkCobranca(cobrancaId, link);
      } catch (e) {
        resultado.push({
          nome: caixa.nome,
          whatsapp: caixa.whatsapp,
          centavos: caixa.centavos,
          lotes: caixa.lotes,
          link: null,
          estado: "aberta",
          erro: String((e as Error).message).slice(0, 160),
        });
        continue;
      }
    }

    resultado.push({
      nome: caixa.nome,
      whatsapp: caixa.whatsapp,
      centavos: caixa.centavos,
      lotes: caixa.lotes,
      link,
      estado: existente?.estado ?? "aberta",
    });
  }

  return NextResponse.json({ ok: true, comInfinitePay: temInfinitePay(), cobrancas: resultado });
}
