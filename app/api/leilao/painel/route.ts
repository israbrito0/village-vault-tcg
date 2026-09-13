import { NextResponse } from "next/server";
import {
  abrirLote,
  bloquearParticipante,
  caixasDoLeilao,
  cancelarLance,
  criarLeilao,
  criarLote,
  definirPrecoManual,
  fecharLote,
  lerLeilaoAtual,
  ocultarMensagem,
  TEM_BANCO,
} from "@/lib/leilao-db";
import { DURACAO_PADRAO_MS } from "@/lib/leilao";

// Painel do leiloeiro. Mesma chave das métricas.
export const dynamic = "force-dynamic";

function autorizado(req: Request) {
  const esperado = process.env.METRICAS_TOKEN;
  const enviado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return Boolean(esperado) && enviado === esperado;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ erro: "chave inválida" }, { status: 401 });
  if (!TEM_BANCO) return NextResponse.json({ erro: "Supabase ainda não configurado." }, { status: 503 });

  const corpo = (await req.json().catch(() => ({}))) as Record<string, any>;
  const acao = String(corpo.acao ?? "");

  try {
    switch (acao) {
      case "estado":
        return NextResponse.json(await lerLeilaoAtual());

      case "criar-leilao": {
        const id = await criarLeilao(String(corpo.titulo ?? "Leilão"), corpo.descricao);
        const lotes = Array.isArray(corpo.lotes) ? corpo.lotes : [];
        for (const [i, lote] of lotes.entries()) {
          await criarLote(id, {
            ordem: i + 1,
            titulo: String(lote.titulo ?? `Lote ${i + 1}`),
            descricao: lote.descricao,
            imagem: lote.imagem,
            lanceInicialCentavos: Math.round(Number(lote.lanceInicialCentavos)),
            incrementoCentavos: Math.round(Number(lote.incrementoCentavos)),
          });
        }
        return NextResponse.json({ ok: true, leilaoId: id, lotes: lotes.length });
      }

      case "adicionar-lote": {
        // Acrescenta um lote ao leilão que está no ar (cria um se não houver).
        let leilaoId = corpo.leilaoId as string | undefined;
        let proxima = 1;
        const estado = await lerLeilaoAtual();
        if (!leilaoId) {
          if (estado.leilao) {
            leilaoId = estado.leilao.id;
            proxima = estado.lotes.length + 1;
          } else {
            leilaoId = await criarLeilao(String(corpo.tituloLeilao ?? "Leilão Village & Vault"));
          }
        } else {
          proxima = estado.lotes.length + 1;
        }
        await criarLote(leilaoId, {
          ordem: Number(corpo.ordem) || proxima,
          titulo: String(corpo.titulo ?? "Lote"),
          descricao: corpo.descricao,
          imagem: corpo.imagem,
          lanceInicialCentavos: Math.round(Number(corpo.lanceInicialCentavos)),
          incrementoCentavos: Math.round(Number(corpo.incrementoCentavos)),
          cartaId: corpo.cartaId,
          precoRefCentavos: corpo.precoRefCentavos ? Math.round(Number(corpo.precoRefCentavos)) : undefined,
        });
        return NextResponse.json({ ok: true, leilaoId });
      }

      case "preco-manual":
        await definirPrecoManual(
          String(corpo.cartaId),
          corpo.centavos === null ? null : Math.round(Number(corpo.centavos)),
        );
        return NextResponse.json({ ok: true });

      case "abrir-lote":
        await abrirLote(String(corpo.loteId), Number(corpo.duracaoMs) || DURACAO_PADRAO_MS);
        return NextResponse.json({ ok: true });

      case "fechar-lote": {
        const vencedor = await fecharLote(String(corpo.loteId));
        return NextResponse.json({ ok: true, vencedor });
      }

      case "cancelar-lance":
        await cancelarLance(String(corpo.lanceId));
        return NextResponse.json({ ok: true });

      case "bloquear":
        await bloquearParticipante(String(corpo.participanteId), Boolean(corpo.bloqueado));
        return NextResponse.json({ ok: true });

      case "ocultar-mensagem":
        await ocultarMensagem(String(corpo.mensagemId));
        return NextResponse.json({ ok: true });

      case "caixas":
        return NextResponse.json({ caixas: await caixasDoLeilao(String(corpo.leilaoId)) });

      default:
        return NextResponse.json({ erro: `ação desconhecida: ${acao}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ erro: String((e as Error).message) }, { status: 500 });
  }
}
