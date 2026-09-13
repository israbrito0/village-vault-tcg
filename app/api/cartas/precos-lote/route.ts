import { NextResponse } from "next/server";
import { buscarCarta } from "@/lib/cartas";
import { definirPrecoManual, lerCartas, salvarCarta, TEM_BANCO } from "@/lib/leilao-db";

// Recebe vários preços de uma vez (o que você leu e me passou) e grava na sua
// base. Cada item vira o "preço da casa" da carta, que manda no leilão.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Item = { nome?: string; codigo?: string; cartaId?: string; centavos: number };

function autorizado(req: Request) {
  const enviado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return Boolean(enviado) && (enviado === process.env.METRICAS_TOKEN || enviado === process.env.RANKING_TOKEN);
}

// Tira acento e caixa para comparar nomes vindos de fontes diferentes.
function simples(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ erro: "chave inválida" }, { status: 401 });
  if (!TEM_BANCO) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 503 });

  const corpo = (await req.json().catch(() => ({}))) as { edicao?: string; fonte?: string; itens?: Item[] };
  const itens = Array.isArray(corpo.itens) ? corpo.itens.slice(0, 300) : [];
  if (!itens.length) return NextResponse.json({ erro: "Mande a lista em 'itens'." }, { status: 400 });

  const edicao = corpo.edicao ? simples(corpo.edicao) : "";
  const salvos: string[] = [];
  const duvidas: { nome?: string; motivo: string }[] = [];

  for (const item of itens) {
    const centavos = Math.round(Number(item.centavos));
    if (!Number.isFinite(centavos) || centavos <= 0) {
      duvidas.push({ nome: item.nome, motivo: "valor inválido" });
      continue;
    }

    let cartaId = item.cartaId;
    let nome = item.nome;

    if (!cartaId) {
      const busca = item.codigo?.trim() || item.nome?.trim();
      if (!busca) {
        duvidas.push({ nome: item.nome, motivo: "sem código e sem nome" });
        continue;
      }
      const achadas = await buscarCarta(busca);
      // Com a edição informada, fica só o que é daquela coleção.
      const daEdicao = edicao ? achadas.filter((c) => simples(c.colecao).includes(edicao)) : achadas;
      const escolhidas = daEdicao.length ? daEdicao : achadas;
      const porNome = item.nome
        ? escolhidas.filter((c) => simples(c.nome) === simples(item.nome!))
        : escolhidas;
      const alvo = (porNome.length ? porNome : escolhidas)[0];
      if (!alvo) {
        duvidas.push({ nome: item.nome, motivo: "não achei a carta" });
        continue;
      }
      if ((porNome.length ? porNome : escolhidas).length > 1) {
        duvidas.push({ nome: item.nome, motivo: `mais de uma carta com esse nome; usei ${alvo.id}` });
      }
      cartaId = alvo.id;
      nome = alvo.nome;
      const conhecida = await lerCartas([alvo.id]);
      if (!conhecida.length) {
        await salvarCarta({
          id: alvo.id,
          nome: alvo.nome,
          colecao: alvo.colecao,
          colecaoId: alvo.colecaoId,
          numero: alvo.numero,
          totalOficial: alvo.totalOficial,
          raridade: alvo.raridade,
          imagem: alvo.imagem,
          precoRefCentavos: alvo.precos.referenciaBrl ? Math.round(alvo.precos.referenciaBrl * 100) : undefined,
          fonte: alvo.precos.fonte,
        }).catch(() => {});
      }
    }

    try {
      await definirPrecoManual(cartaId!, centavos);
      salvos.push(`${nome ?? cartaId}: ${(centavos / 100).toFixed(2)}`);
    } catch {
      duvidas.push({ nome: item.nome, motivo: "não consegui salvar" });
    }
  }

  return NextResponse.json({ ok: true, salvos: salvos.length, duvidas, exemplos: salvos.slice(0, 5) });
}
